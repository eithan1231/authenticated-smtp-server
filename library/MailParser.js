const BackendMailParser = require('mailparser').MailParser;
const EventEmitter = require('events');
const libmime = require('libmime');


module.exports = class MailParser extends BackendMailParser
{
	constructor(config)
	{
		super();
		this._rawHeaders = [];
	}

	/**
	* Gets raw headers
	*/
	getHeaders()
	{
		return this._rawHeaders;
	}

	processHeaders(lines) {
		// Getting & doing what we need
		(lines || []).forEach(line => {
			let value = ((libmime.decodeHeader(line.line) || {}).value || '').toString().trim();
			value = Buffer.from(value, 'binary').toString();
			this._rawHeaders.push({
				key: line.key,
				value: value
			});
		});

		// Continue on with normal behaviour.
		return super.processHeaders(lines);
	}
}
