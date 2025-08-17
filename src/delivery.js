import nodemailer from "nodemailer";

import { MailParser } from "./parser.js";
import { parseAddress, resolveMXRecords } from "./util.js";
import { getDkim } from "./auth.js";
import { createWriteStream, createReadStream, readFileSync } from "fs";
import { copyFile, unlink } from "fs/promises";
import { promisify } from "util";
import tmp from "tmp";
import yaml from "js-yaml";
import path from "path";
import assert from "assert";
import { getConfig } from "./config.js";

// promisify tmp
const tmpPromise = promisify(tmp.file);

// headers that should be ignored from the received mail object. They are ignored
// due to their debug tracing, exposure of backend infastrucutre, are manually
// set elsewhere, or potentially other reasons.
const ignoreHeaders = [
  // exposes backend infastructure
  "x-sender-id",
  "x-php-script",
  "x-authentication-warning",
  "x-mailer",
  "received",

  // set elsewhere:
  "content-type",
  "to",
  "from",
];

/**
 * parserHeaderEvent handles event triggered by parser.
 * @param {object} headers
 * @param {object} message nodemailer message
 */
const parserHeaderEvent = (headers, message) => {
  for (const header of headers) {
    if (ignoreHeaders.indexOf(header.key) !== -1) {
      continue; // skip header
    } else if (header.key === "subject") {
      message.subject = header.value;
    } else {
      message.headers.push(header);
    }
  }
};

/**
 * parserDataEvent handles event triggered by parser.
 * @param {object} data
 * @param {object} message nodemailer message
 */
const parserDataEvent = (data, message) => {
  if (data.type === "text") {
    // text type (html/text)

    if (data.html) {
      message.html = data.html;
    }

    if (data.text) {
      message.text = data.text;
    }
  } else if (data.type === "attachment") {
    // handling attachment.. create temporary file for it
    tmp.file((err, path) => {
      if (err) throw err;

      // write attachment to temp file
      const writeStream = createWriteStream(path);
      data.content.pipe(writeStream);

      // once complete, release data and push attachment to new message
      data.content.on("end", () => {
        data.release();

        message.attachments.push({
          contentType: data.type,
          contentDisposition: data.contentDisposition,
          cid: data.cid,
          contentId: data.contentId,
          filename: data.filename,
          path: path,
        });
      });
    });
  }
};

/**
 * helper function for delivering mail to a recipient
 * @param {object} sender Authenticated user
 * @param {object} recipient Recipient of mail {localpart, domain, address}
 * @param {object} message nodemailer message
 */
const deliverMail = async (sender, recipient, message) => {
  try {
    const config = getConfig();

    console.log(`[deliverMail] Started`);

    const mxRecords = await resolveMXRecords(recipient.domain);

    const mxRecordsPriority = mxRecords.sort((a, b) => b.priority - a.priority);

    if (mxRecordsPriority.length <= 0) {
      throw new Error("no mail exchanges found");
    }

    for (const mxRecord of mxRecordsPriority) {
      // getting dkim for specified domain
      const dkim = await getDkim(sender.domain);

      const transporter = nodemailer.createTransport({
        logger: true,
        secure: false,
        port: 25,
        host: mxRecord.exchange,
        name: config.hostname,
        dkim: dkim,
        tls: {
          // self signed servers. most aren't really signed, security mostly
          // comes from dkim/spf signing than TLS.
          rejectUnauthorized: false,
        },
      });

      if (!(await transporter.verify())) {
        console.error(`[deliverMail] Transporter verification failed`);

        continue;
      }

      const info = await transporter.sendMail(message);
      if (!info.accepted.includes(recipient.address)) {
        console.error(
          `[deliverMail] info does not include recipient, attempting next mail exchange record`
        );

        continue;
      }

      console.log(`[deliverMail] Completed, presumed successfully`);

      return;
    }
  } catch (err) {
    throw err;
  }

  throw new Error(
    "Unexpected, reached end of function. Something did not go okay! uh oh! =("
  );
};

/**
 * mailSend job
 * copies mail object for each recipient, and queues email delivery for all
 * recipients with jobDeliverMail
 * @param {object} payload
 */
export const jobDistributeMail = async (payload) => {
  try {
    const id = payload.id;
    const user = payload.authenticatedUser;
    const envelope = payload.envelope;
    const mailPath = payload.mailPath;

    console.log(`jobDistributeMail ${id} from ${user.addressFormatted}`);

    // Distributing delivery to each recipient.
    for (const recipient of envelope.rcptTo) {
      // parsing recipient address
      const recipientParsed = parseAddress(recipient.address);
      if (!recipientParsed) {
        // failed to parse recipient, therefore unable to deliver mail.. next
        continue;
      }

      // make copy of mail for this user
      const mailDestination = await tmpPromise();
      await copyFile(mailPath, mailDestination);

      jobDeliverMail({
        id,
        user,
        recipient: recipientParsed,
        mailPath: mailDestination,
      });
    }

    // cleanup this job, deleting mailpath. it has been copied for all
    // recipients
    await unlink(mailPath);
  } catch (err) {
    throw err;
  }
};

/**
 * jobDeliverMail job
 * Sends mail for each of the recipients. This is invoked by jobDistributeMail
 * @param {object} payload
 */
export const jobDeliverMail = async (payload) => {
  const id = payload.id;
  const user = payload.user;
  const recipient = payload.recipient;
  const mailPath = payload.mailPath;

  assert(typeof id === "string");
  assert(typeof user === "object");
  assert(typeof recipient === "object");
  assert(typeof mailPath === "string");

  console.log(
    `jobDeliverMail ${id} from ${user.addressFormatted} to ${recipient.address}`
  );

  // mail parser object
  const mailParser = new MailParser();

  // generated messaged for node-mailer
  const message = {
    from: user.addressFormatted,
    to: recipient.address,

    headers: [],
    attachments: [],
  };

  // Process headers on the parsed mail object, and push them
  mailParser.on("headers", () =>
    parserHeaderEvent(mailParser.getHeaders(), message)
  );

  // handling all content types (attachments, text, html)
  mailParser.on("data", (data) => parserDataEvent(data, message));

  // deliver mail to all users
  mailParser.on("end", async () => {
    await deliverMail(user, recipient, message);

    jobDeliverMailCleanup({
      ...payload,
      attachments: message.attachments,
    });
  });

  // starting file stream into mail parser
  const mailReadStream = createReadStream(mailPath);
  mailReadStream.on("open", () => mailReadStream.pipe(mailParser));
};

/**
 * jobDeliverMailCleanup job
 * cleans up attachments and mail object once mail has been sent
 * @param {object} payload
 */
export const jobDeliverMailCleanup = async (payload) => {
  try {
    const id = payload.id;
    const user = payload.user;
    const recipient = payload.recipient;
    const mailPath = payload.mailPath;
    const attachments = payload.attachments;

    console.log(
      `jobDeliverMailCleanup for ${id} from ${user.addressFormatted} to ${recipient.address}`
    );

    // unlinking mail object
    await unlink(mailPath);

    // removing attachments
    for (const attachment of attachments) {
      await unlink(attachment.path);
    }
  } catch (err) {
    throw err;
  }
};
