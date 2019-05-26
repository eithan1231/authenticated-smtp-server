const winston = require('winston');
const path = require('path');
const logdir = path.join(__dirname, '../logs');
const argument = require('./argument');

const filenamePrefix = argument.get('id') || 'default';

module.exports = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
			filename: path.join(logdir, `${filenamePrefix}-error.log`),
			level: 'error'
		}),

    new winston.transports.File({
			filename: path.join(logdir, `${filenamePrefix}-log.log`),
		})
	]
});
