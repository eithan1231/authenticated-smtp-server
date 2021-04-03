const Utilities = require('./Utilities')

const assert = require('assert')
const yaml = require('js-yaml')
const fs = require('fs')
const fsPromise = require('fs/promises')
const path = require('path')
const os = require('os')

// loading Authorization YAML configuration
const authorizationConfig = yaml.load(fs.readFileSync(
  path.join(__dirname, '../config/authorization.yaml')
))

// loading domains configuration
const domainsConfig = yaml.load(fs.readFileSync(
  path.join(__dirname, '../config/domains.yaml')
))

/**
  * Class for handling Authorization and verification.
  * interfaces with authorization.yaml
  */
class Authorization {
  /**
    * gets dkim information for specific domain
    * @param {string} domain
    **/
  static async getDkim (domain) {
    assert(typeof domain === 'string')

    if (typeof domainsConfig[domain] === 'undefined') {
      throw new Error('Domain not found')
    }

    // dkim disabled, return null.
    if (!domainsConfig[domain].dkim.enabled) {
      return false
    }

    const dkimKey = await fsPromise.readFile(
      path.join(__dirname, '../config/dkim/', domainsConfig[domain].dkim.key)
    )

    if (!dkimKey) {
      return false
    }

    return {
      domainName: domain,
      keySelector: domainsConfig[domain].dkim.keySelector,
      privateKey: dkimKey,
      cacheDir: os.tmpdir()
    }
  }

  /**
    * Authoirzes a profile
    * @param {string} email
    * @param {string} password
    * @returns {object} keys: address, localpart, domain, name
    * @throws {Error} on failure
    */
  static authorize (email, password) {
    const address = Utilities.parseAddress(email)

    // check domain exists
    if (typeof authorizationConfig[address.domain] !== 'object') {
      throw new Error('Domain not found')
    }

    // find local part in the domain index
    for (const profile of authorizationConfig[address.domain]) {
      if (
        profile.localpart === address.localpart &&
        profile.password === password
      ) {
        return {
          address: `${profile.localpart}@${address.domain}`,
          addressFormatted: `${profile.name} <${profile.localpart}@${address.domain}>`,
          localpart: profile.localpart,
          domain: address.domain,
          name: profile.name
        }
      }
    }

    throw new Error('Authorization Failed')
  }
}

module.exports = Authorization
