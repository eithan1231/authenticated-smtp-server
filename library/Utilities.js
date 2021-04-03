const assert = require('assert')

const { Resolver } = require('dns').promises
const dnsResolver = new Resolver()

class Utilities {
  /**
    * Resolves MX records and automatically sorts them.
    * @param {string} hostname
    * @returns {false|array} false on failure, array with exchange and priority on success.
    */
  static async resolveMXRecords (hostname) {
    try {
      const records = await dnsResolver.resolveMx(hostname)
      if (!records) {
        throw new Error('Domain Records not found')
      }

      // sorting domain records, highest priority first.
      records.sort((a, b) => {
        if (a.priority < b.priority) {
          return -1
        } else if (a.priority > b.priority) {
          return 1
        } else {
          return 0
        }
      })

      return records
    } catch (err) {
      throw err
    }
  }

  /**
  * Parses email address into local part and domain
  * @param {string} address
  * @return on error, false, on success, an object with two keys. a key for domain, and localpart.
  */
  static parseAddress (address) {
    assert(typeof address === 'string')

    const localpartEnd = address.lastIndexOf('@')
    const localpartFirst = address.indexOf('@')
    if (localpartEnd < 0 || localpartFirst !== localpartEnd) {
      return false
    }

    const localpart = address.substring(0, localpartEnd)
    const domain = address.substring(localpartEnd + 1)

    if (!localpart || !domain) {
      return false
    }

    return {
      localpart: localpart,
      domain: domain.toLowerCase(),
      address
    }
  }
}

module.exports = Utilities
