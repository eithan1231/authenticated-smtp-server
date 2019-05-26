const nodemailer = require('nodemailer');
const utilities = require('./utilities');
const config = require('./config');
const smtpConfig = config.readConfigSync('smtp.yaml');
const os = require('os');


module.exports = class SMTPDelivery
{
	static send(sender, recipient, message)
	{
		return new Promise((resolve, reject) => {
			const parsedRecipient = utillities.parseAddress(recipient);
			if(!parsedRecipient) {
				return resolve(false);
			}

			const recipientMXRecords = await utilities.resolveMXRecords(parsedRecipient.domain);
			if(!recipientMXRecords) {
				return resolve(false);
			}

			for(let recipientMXRecord of recipientMXRecords)
			{
				let dkim = null;
				if(smtpConfig.dkim.enabled || false) {
					dkim = {
						domainName: smtpConfig.serverDomain,
						keySelector: smtpConfig.dkim.keySelector,
						privateKey: (await config.reaDConfig(smtpConfig.dkim.key)),
						cacheDir: os.tmpdir(),
					};
				}

				const tramsporter = nodemailer.createTransport({
					secure: false,
					port: 25,
					host: recipientMXRecord.exchange,
					name: smtpConfig.hostname,
					dkim: dkim,
					tls: {
						rejectUnauthorized: false
					}
				});

				// Need to set this on each recipient.
				message.to = recipient;

				if(await transporter.verify()) {
					const info = await transporter.sendMail(message);
					if(info.accepted.includes(recipient)) {
						return resolve(true);
					}
				}
			}
		});
	}
}