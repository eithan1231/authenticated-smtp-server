const MailParser = require('../MailParser')
const Utilities = require('../Utilities')
const Authorization = require('../Authorization')

const nodemailer = require('nodemailer')
const assert = require('assert')

const yaml = require('js-yaml')
const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const tmp = require('tmp')
const util = require('util')

// promisify tmp
const tmpPromise = util.promisify(tmp.file)

const smtpConfig = yaml.load(fs.readFileSync(
  path.join(__dirname, '../../config/smtp.yaml')
))

// headers that should be ignored from the received mail object. They are ignored
// due to their debug tracing, exposure of backend infastrucutre, are manually
// set elsewhere, or potentially other reasons.
const ignoreHeaders = [
  // exposes backend infastructure
  'x-sender-id',
  'x-php-script',
  'x-authentication-warning',
  'x-mailer',
  'received',

  // set elsewhere:
  'content-type',
  'to',
  'from'
]

/**
  * parserHeaderEvent handles event triggered by parser.
  * @param {object} headers
  * @param {object} message nodemailer message
  */
const parserHeaderEvent = (headers, message) => {
  for (const header of headers) {
    if (ignoreHeaders.indexOf(header.key) !== -1) {
      continue// skip header
    } else if (header.key === 'subject') {
      message.subject = header.value
    } else {
      message.headers.push(header)
    }
  }
}

/**
  * parserDataEvent handles event triggered by parser.
  * @param {object} data
  * @param {object} message nodemailer message
  */
const parserDataEvent = (data, message) => {
  if (data.type === 'text') {
    // text type (html/text)

    if (data.html) {
      message.html = data.html
    }

    if (data.text) {
      message.text = data.text
    }
  } else if (data.type === 'attachment') {
    // handling attachment.. create temporary file for it
    tmp.file((err, path) => {
      if (err) throw err

      // write attachment to temp file
      const writeStream = fs.createWriteStream(path)
      data.content.pipe(writeStream)

      // once complete, release data and push attachment to new message
      data.content.on('end', () => {
        data.release()

        message.attachments.push({
          contentType: data.type,
          contentDisposition: data.contentDisposition,
          cid: data.cid,
          contentId: data.contentId,
          filename: data.filename,
          path: path
        })
      })
    })
  }
}

/**
  * helper function for delivering mail to a recipient
  * @param {object} sender Authenticated user
  * @param {object} recipient Recipient of mail {localpart, domain, address}
  * @param {object} message nodemailer message
  */
const deliverMail = async (sender, recipient, message) => {
  try {
    const mxRecords = await Utilities.resolveMXRecords(recipient.domain)

    for (const mxRecord of mxRecords) {
      // getting dkim for specified domain
      const dkim = await Authorization.getDkim(sender.domain)

      const transporter = nodemailer.createTransport({
        // logger: true,
        secure: false,
        port: 25,
        host: mxRecord.exchange,
        name: smtpConfig.hostname,
        dkim: dkim,
        tls: {
          // self signed servers. most aren't really signed, security mostly
          // comes from dkim/spf signing than TLS.
          rejectUnauthorized: false
        }
      })

      if (!await transporter.verify()) {
        throw new Error('Transporter verification failed')
      }

      const info = await transporter.sendMail(message)
      if (!info.accepted.includes(recipient.address)) {
        throw new Error('info does not include recipient, failed to send')
      }
    }
  } catch (err) {
    throw err
  }
}

class JobsMail {
  /**
    * mailSend job
    * copies mail object for each recipient, and queues email delivery for all
    * recipients with jobDeliverMail
    * @param {object} job
    */
  static async jobDistributeMail (job) {
    try {
      // parameters for this job
      const id = job.attrs.data.id
      const user = job.attrs.data.authenticatedUser
      const envelope = job.attrs.data.envelope
      const mailPath = job.attrs.data.mailPath

      console.log(`jobDistributeMail ${id} from ${user.addressFormatted}`)

      // Distributing delivery to each recipient.
      for (const recipient of envelope.rcptTo) {
        // parsing recipient address
        const recipientParsed = Utilities.parseAddress(recipient.address)
        if (!recipientParsed) {
          // failed to parse recipient, therefore unable to deliver mail.. next
          continue
        }

        // make copy of mail for this user
        const mailDestination = await tmpPromise()
        await fsPromises.copyFile(mailPath, mailDestination)

        // queueing mail for recipient
        job.agenda.now('jobDeliverMail', {
          id,
          user,
          recipient: recipientParsed,
          mailPath: mailDestination
        })
      }

      // cleanup this job, deleting mailpath. it has been copied for all
      // recipients
      await fsPromises.unlink(mailPath)
    } catch (err) {
      throw err
    }
  }

  /**
    * jobDistributeMail job failure
    * @param {Error} error
    * @param {object} job
    */
  static jobDistributeMailFailure (error, job) {
    console.log('jobDistributeMailFailure')
    console.error(error)
  }

  /**
    * jobDeliverMail job
    * Sends mail for each of the recipients. This is invoked by jobDistributeMail
    * @param {object} job
    */
  static jobDeliverMail (job, done) {
    try {
      // parameters for this job
      const id = job.attrs.data.id
      const user = job.attrs.data.user
      const recipient = job.attrs.data.recipient
      const mailPath = job.attrs.data.mailPath

      // validating parameter types
      assert(typeof id === 'string')
      assert(typeof user === 'object')
      assert(typeof recipient === 'object')
      assert(typeof mailPath === 'string')

      console.log(`jobDeliverMail ${id} from ${user.addressFormatted} to ${recipient.address}`)

      // mail parser object
      const mailParser = new MailParser()

      // generated messaged for node-mailer
      const message = {
        from: user.addressFormatted,
        to: recipient.address,

        headers: [],
        attachments: []
      }

      // Process headers on the parsed mail object, and push them
      mailParser.on('headers', () => parserHeaderEvent(mailParser.getHeaders(), message))

      // handling all content types (attachments, text, html)
      mailParser.on('data', (data) => parserDataEvent(data, message))

      // deliver mail to all users
      mailParser.on('end', () => {
        deliverMail(user, recipient, message)
          .then(done)
          .catch(done)
          .finally(() => job.agenda.now('jobDeliverMailCleanup', {
            ...job.attrs.data,
            attachments: message.attachments
          }))
      })

      // starting file stream into mail parser
      const mailReadStream = fs.createReadStream(mailPath)
      mailReadStream.on('open', () => mailReadStream.pipe(mailParser))
    } catch (err) {
      done(err)
    }
  }

  /**
    * jobDeliverMail job failure
    * @param {Error} error
    * @param {object} job
    */
  static jobDeliverMailFailure (error, job) {
    console.log('jobDeliverMailFailure')
    console.error(error)
  }

  /**
    * jobDeliverMailCleanup job
    * cleans up attachments and mail object once mail has been sent
    * @param {object} job
    */
  static async jobDeliverMailCleanup (job) {
    try {
      const id = job.attrs.data.id
      const user = job.attrs.data.user
      const recipient = job.attrs.data.recipient
      const mailPath = job.attrs.data.mailPath
      const attachments = job.attrs.data.attachments

      console.log(`jobDeliverMailCleanup for ${id} from ${user.addressFormatted} to ${recipient.address}`)

      // unlinking mail object
      await fsPromises.unlink(mailPath)

      // removing attachments
      for (const attachment of attachments) {
        await fsPromises.unlink(attachment.path)
      }
    } catch (err) {
      throw err
    }
  }

  /**
    * jobDeliverMailCleanup job failure
    * @param {Error} error
    * @param {object} job
    */
  static jobDeliverMailCleanupFailure (error, job) {
    console.log('jobDeliverMailCleanupFailure')
    console.error(error)
  }
}

// registers all jobs for mail related things
const agendaHandler = (agenda) => {
  agenda.define('jobDistributeMail', JobsMail.jobDistributeMail)
  agenda.on('fail:jobDistributeMail', JobsMail.jobDistributeMailFailure)
  agenda.define('jobDeliverMail', JobsMail.jobDeliverMail)
  agenda.on('fail:jobDeliverMail', JobsMail.jobDeliverMailFailure)
  agenda.define('jobDeliverMailCleanup', JobsMail.jobDeliverMailCleanup)
  agenda.on('fail:jobDeliverMailCleanup', JobsMail.jobDeliverMailCleanupFailure)
}

module.exports = agendaHandler
