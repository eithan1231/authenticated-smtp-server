import { readFileSync } from "fs";
import assert from "assert";

let cachedConfig = null;

/**
 * @returns {{
 *  hostname: string,
 *  port: number,
 *  maxMailSize: number,
 *  secureServerEnabled: boolean,
 *  secureServerForced: boolean,
 *  secureServerPrivateKey: string|null,
 *  secureServerCertificate: string|null,
 *  domains: Array<{
 *    domain: string,
 *    dkim: {
 *      enabled: true,
 *      selector: string,
 *      key: string,
 *    } | { enabled: false},
 *    users: Array<{
 *      email: string,
 *      name: string,
 *      password: string,
 *    }>
 *  }>
 * }}
 */
export const getConfig = () => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configFile = process.env.CONFIG_FILE || "./config.json";

  const configContent = readFileSync(configFile, "utf8");

  cachedConfig = JSON.parse(configContent);

  assert(
    typeof cachedConfig.hostname === "string",
    "Hostname is required in config"
  );
  assert(typeof cachedConfig.port === "number", "Port is required in config");
  assert(
    typeof cachedConfig.maxMailSize === "number",
    "Max mail size is required in config"
  );

  assert(
    typeof cachedConfig.secureServerEnabled === "boolean",
    "Secure server enabled is required in config"
  );
  assert(
    typeof cachedConfig.secureServerForced === "boolean",
    "Secure server forced is required in config"
  );

  assert(
    cachedConfig.secureServerEnabled === false ||
      typeof cachedConfig.secureServerPrivateKey === "string",
    "Secure server private key is required in config when secure server is enabled"
  );
  assert(
    cachedConfig.secureServerEnabled === false ||
      typeof cachedConfig.secureServerCertificate === "string",
    "Secure server certificate is required in config when secure server is enabled"
  );

  assert(
    Array.isArray(cachedConfig.domains),
    "Domains must be an array in config"
  );

  cachedConfig.domains.forEach((domain) => {
    assert(typeof domain.domain === "string", "Domain name is required");
    assert(typeof domain.dkim === "object", "DKIM configuration is required");

    assert(
      typeof domain.dkim.enabled === "boolean",
      "DKIM enabled must be a boolean"
    );

    if (domain.dkim.enabled === true) {
      assert(
        typeof domain.dkim.selector === "string",
        "DKIM selector is required when DKIM is enabled"
      );
      assert(
        typeof domain.dkim.key === "string",
        "DKIM key is required when DKIM is enabled"
      );
    }

    assert(
      Array.isArray(domain.users),
      "Users must be an array in domain configuration"
    );

    domain.users.forEach((user) => {
      assert(typeof user.email === "string", "User email is required");
      assert(typeof user.name === "string", "User name is required");
      assert(typeof user.password === "string", "User password is required");
    });
  });

  return cachedConfig;
};
