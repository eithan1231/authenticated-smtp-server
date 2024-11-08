import { SMTPServer } from "./server.js";
import { readFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

const main = () => {
  const smtpConfig = yaml.load(readFileSync("./config/smtp.yaml"));

  const secureServerEnabled = smtpConfig.secureServerEnabled;

  const secureServerPrivateKey = smtpConfig.secureServerPrivateKey
    ? readFileSync(path.join("./config/", smtpConfig.secureServerPrivateKey))
    : false;

  const secureServerCertificate = smtpConfig.secureServerCertificate
    ? readFileSync(path.join("./config/", smtpConfig.secureServerCertificate))
    : false;

  const smtpServer = new SMTPServer({
    size: smtpConfig.maxMailSize,
    name: smtpConfig.hostname,

    secure: smtpConfig.secureServerEnabled && smtpConfig.secureServerForced,
    key: secureServerEnabled ? secureServerPrivateKey : null,
    cert: secureServerEnabled ? secureServerCertificate : null,
  });

  smtpServer.on("error", (err) => {
    console.error(err);
  });

  smtpServer.once("close", () => {
    console.log("[main] Server is closed");
  });

  smtpServer.listen(smtpConfig.port, () => {
    console.log("[main] Listening on port", smtpConfig.port);
  });
};

main();
