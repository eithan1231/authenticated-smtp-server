/**
* Application for handling SMTP.
*/
const SMTPServer = require('./library/SMTPServer')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

function main () {
  const smtpConfig = yaml.load(fs.readFileSync(
    path.join(__dirname, './config/smtp.yaml')
  ))

  const SSLKey = (smtpConfig.SSLEnable && smtpConfig.SSLKey
    ? fs.readFileSync(path.join(__dirname, './config/', smtpConfig.SSLKey))
    : false
  )

  const SSLCert = (smtpConfig.SSLEnable && smtpConfig.SSLCert
    ? fs.readFileSync(path.join(__dirname, './config/', smtpConfig.SSLCert))
    : false
  )

  const SSLCa = (smtpConfig.SSLEnable && smtpConfig.SSLCa
    ? fs.readFileSync(path.join(__dirname, './config/', smtpConfig.SSLCa))
    : false
  )

  const smtpServer = new SMTPServer({
    size: smtpConfig.maxMailSize,
    name: smtpConfig.hostname,

    secure: smtpConfig.SSLEnable,
    key: SSLKey,
    cert: SSLCert,
    ca: SSLCa
  })

  smtpServer.on('error', console.error)
  smtpServer.listen(smtpConfig.port)
}

module.exports = main
