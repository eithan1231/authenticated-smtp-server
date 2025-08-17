import { parseAddress } from "./util.js";

import assert from "assert";
import yaml from "js-yaml";
import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import os from "os";
import { getConfig } from "./config.js";

/**
 * gets dkim information for specific domain
 * @param {string} domain
 **/
export const getDkim = async (domain) => {
  const config = getConfig();

  const configDomain = config.domains.find((d) => d.domain === domain);

  if (!configDomain) {
    throw new Error("Domain not found in config");
  }

  if (!configDomain.dkim.enabled) {
    throw new Error("DKIM not enabled for domain");
  }

  return {
    domainName: configDomain.domain,
    keySelector: configDomain.dkim.selector,
    privateKey: configDomain.dkim.key,
    cacheDir: os.tmpdir(),
  };
};

/**
 * Authoirzes a profile
 * @param {string} email
 * @param {string} password
 * @returns {object} keys: address, localpart, domain, name
 * @throws {Error} on failure
 */
export const authorise = (email, password) => {
  const config = getConfig();

  const address = parseAddress(email);

  if (!address) {
    throw new Error("Domain not found");
  }

  for (const domain of config.domains) {
    if (domain.domain !== address.domain) {
      continue;
    }

    for (const user of domain.users) {
      if (user.email !== address.address) {
        continue;
      }

      if (user.password !== password) {
        continue;
      }

      return {
        address: user.email,
        addressFormatted: `${user.name} <${user.email}>`,
        localpart: address.localpart,
        domain: address.domain,
        name: user.name,
      };
    }
  }

  throw new Error("Authorization Failed");
};
