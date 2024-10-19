import assert from "assert";

import { Resolver } from "dns/promises";

/**
 * Resolves MX records and automatically sorts them.
 * @param {string} hostname
 */
export const resolveMXRecords = async (hostname) => {
  try {
    const dnsResolver = new Resolver();

    const records = await dnsResolver.resolveMx(hostname);
    if (!records) {
      throw new Error("Domain Records not found");
    }

    // sorting domain records, highest priority first.
    records.sort((a, b) => {
      if (a.priority < b.priority) {
        return -1;
      } else if (a.priority > b.priority) {
        return 1;
      } else {
        return 0;
      }
    });

    return records;
  } catch (err) {
    throw err;
  }
};

/**
 * Parses email address into local part and domain
 * @param {string} address
 */
export const parseAddress = (address) => {
  assert(typeof address === "string");

  const localpartEnd = address.lastIndexOf("@");
  const localpartFirst = address.indexOf("@");
  if (localpartEnd < 0 || localpartFirst !== localpartEnd) {
    return false;
  }

  const localpart = address.substring(0, localpartEnd);
  const domain = address.substring(localpartEnd + 1);

  if (!localpart || !domain) {
    return false;
  }

  return {
    localpart: localpart,
    domain: domain.toLowerCase(),
    address,
  };
};
