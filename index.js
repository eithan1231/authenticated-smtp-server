const SMTPServer = require('./library/SMTPServer');
const logger = require('./library/logger');
const argument = require('./library/argument');
const config = require('./library/config');
const smtpConfig = config.readConfigSync('smtp.yaml');

const port = argument.get('port') || 587;
const maxMailSize = argument.get('max-size') || 1024 * 1024 * 16;
const secure = (argument.get('secure') || 'true') === 'true';
const authplugin = (argument.get('authplugin') || 'confauth');

const smtpServer = new SMTPServer({
	logger: logger,
	secure: secure,
	size: maxMailSize,
	name: smtpConfig.hostname,


	// `authplugin` is trusted input, though technically its vulnerable to
	// directory traversal attacks
	auth: require(`./authplugins/${authplugin}`),
});

smtpServer.on('error', (err) => {

});
smtpServer.listen(port);
