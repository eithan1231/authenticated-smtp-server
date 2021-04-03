const MailParser = require('mailparser').MailParser

/**
  * Overwriting MailParser getHeaders method as we require un-parsed headers.
  */
class CustomMailParser extends MailParser {
  /**
    * @returns {array} Unmodified headers
    */
  getHeaders () {
    const ret = []

    if (!this.headerLines) {
      return ret
    }

    for (const header of this.headerLines) {
      let value = ((this.libmime.decodeHeader(header.line) || {}).value || '').toString().trim()
      value = Buffer.from(value, 'binary').toString()

      ret.push({
        key: header.key,
        value
      })
    }

    return ret
  }
}

module.exports = CustomMailParser
