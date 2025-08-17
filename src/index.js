import { getConfig } from "./config.js";
import { SMTPServer } from "./server.js";

const main = () => {
  const config = getConfig();

  const smtpServer = new SMTPServer({
    size: config.maxMailSize,
    name: config.hostname,

    secure: config.secureServerEnabled && config.secureServerForced,
    key: config.secureServerPrivateKey,
    cert: config.secureServerCertificate,
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
