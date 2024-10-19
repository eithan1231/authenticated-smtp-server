import { parseAddress } from "./util.js";

import assert from "assert";
import yaml from "js-yaml";
import fs from "fs";
import fsPromise from "fs/promises";
import path from "path";
import os from "os";

const authorizationConfig = yaml.load(
  fs.readFileSync("./config/authorization.yaml")
);

const domainsConfig = yaml.load(fs.readFileSync("./config/domains.yaml"));

/**
 * gets dkim information for specific domain
 * @param {string} domain
 **/
export const getDkim = async (domain) => {
  assert(typeof domain === "string");

  if (typeof domainsConfig[domain] === "undefined") {
    throw new Error("Domain not found");
  }

  // dkim disabled, return null.
  if (!domainsConfig[domain].dkim.enabled) {
    return false;
  }

  const dkimKey = await fsPromise.readFile(
    path.join("./config/dkim/", domainsConfig[domain].dkim.key)
  );

  if (!dkimKey) {
    return false;
  }

  return {
    domainName: domain,
    keySelector: domainsConfig[domain].dkim.keySelector,
    privateKey: dkimKey,
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
  const address = parseAddress(email);

  // check domain exists
  if (typeof authorizationConfig[address.domain] !== "object") {
    throw new Error("Domain not found");
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
        name: profile.name,
      };
    }
  }

  throw new Error("Authorization Failed");
};
