const winston = require('winston');
const winstonFileRotator = require('winston-daily-rotate-file');
const path = require('path');
const logdir = path.join(__dirname, '../logs');
const argument = require('./argument');

const filenamePrefix = argument.get('id') || 'default';

module.exports = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winstonFileRotator({
			filename: `${filenamePrefix}-%DATE%-error.log`,
			dirname: logdir,
			level: 'error',
			zippedArchive: true,
			maxFiles: 32,
		}),

    new winstonFileRotator({
			filename: `${filenamePrefix}-%DATE%-log.log`,
			dirname: logdir,
			zippedArchive: true,
			maxFiles: 32,
		})
	]
});
