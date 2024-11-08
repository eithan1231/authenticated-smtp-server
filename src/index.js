import { SMTPServer } from "./server.js";
import { readFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

const main = () => {
  const smtpConfig = yaml.load(readFileSync("./config/smtp.yaml"));

  const SSLKey =
    smtpConfig.SSLEnable && smtpConfig.SSLKey
      ? readFileSync(path.join("./config/", smtpConfig.SSLKey))
      : false;

  const SSLCert =
    smtpConfig.SSLEnable && smtpConfig.SSLCert
      ? readFileSync(path.join("./config/", smtpConfig.SSLCert))
      : false;

  const SSLCa =
    smtpConfig.SSLEnable && smtpConfig.SSLCa
      ? readFileSync(path.join("./config/", smtpConfig.SSLCa))
      : false;

  const smtpServer = new SMTPServer({
    size: smtpConfig.maxMailSize,
    name: smtpConfig.hostname,

    secure: smtpConfig.SSLEnable,
    key: SSLKey,
    cert: SSLCert,
    ca: SSLCa,
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
