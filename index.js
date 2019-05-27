const SMTPServer = require('./library/SMTPServer');
const logger = require('./library/logger');
const argument = require('./library/argument');
const config = require('./library/config');
const smtpConfig = config.readConfigSync('smtp.yaml');

const port = argument.get('port') || 587;
const maxMailSize = argument.get('max-size') || 1024 * 1024 * 16;
const secure = (argument.get('secure') || 'true') === 'true';
const authplugin = (argument.get('authplugin') || 'confauth');

logger.info({
	txn: 'general',
	cause: 'welcome',
	port: port,
	maxMailSize : maxMailSize,
	secure: secure,
	authplugin: authplugin,
});

const smtpServer = new SMTPServer({
	logger: logger,
	secure: secure,
	size: maxMailSize,
	name: smtpConfig.hostname,

	key: (smtpConfig.serverSSL.key
		? config.readConfigSync(smtpConfig.serverSSL.key)
		: false
	),

	cert: (smtpConfig.serverSSL.cert
		? config.readConfigSync(smtpConfig.serverSSL.cert)
		: false
	),

	ca: (smtpConfig.serverSSL.ca
		? config.readConfigSync(smtpConfig.serverSSL.ca)
		: false
	),

	// `authplugin` is trusted input, though technically its vulnerable to
	// directory traversal attacks
	auth: require(`./authplugins/${authplugin}`),
});

smtpServer.on('error', (err) => {
	// Check if its the type of erro that will kill the smtpServer.
	logger.error(err);
});
smtpServer.listen(port);

process.on("SIGINT", () => {
	logger.info({
		txn: 'general',
		cause: 'sigint'
	});

	smtpServer.close(() => {
		process.ext(1);
	});
});
