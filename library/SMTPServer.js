const SMTPServerExtendable = require("smtp-server").SMTPServer;
const utillities = require('./utilities');
const MailParser = require('./MailParser');
const SMTPDelivery = require('./SMTPDelivery');
const tmp = require('tmp');
const fs = require('fs');

module.exports = class SMTPServer extends SMTPServerExtendable
{
	constructor(options)
	{
		options.banner = 'authenticated-smtp-server';
		options.authMethods = ['LOGIN'];
		options.allowInsecureAuth = true;
		options.authOptional = false;

		super(options);

		this.logger = options.logger || {
			debug: console.log,
			silly: console.log,
			info: console.log,
			warn: console.error,
			error: console.error,
		};
	}

	/**
	* By default any client connection is allowed. If you want to check the
	* remoteAddress or clientHostname before any other command, you can set a
	* handler for it with onConnect
	* @param session includes the remoteAddress and clientHostname values
	* @param cb is the function to run after validation. If you return an error
	*		object, the connection is rejected, otherwise it is accepted
	*/
	onConnect(session, cb)
	{
		cb();
	}

	/**
	* Authentication calls can be handled with onAuth handler
	* @param auth is an authentication object
	*		method: indicates the authentication method used, ‘PLAIN’, ‘LOGIN’ or ‘XOAUTH2’
	*		username: is the username of the user
	*		password: is the password if LOGIN or PLAIN was used
	*		accessToken: is the OAuth2 bearer access token if ‘XOAUTH2’ was used as the authentication method
	*		validatePassword: is a function for validating CRAM-MD5 challenge responses. Takes the password of the user as an argument and returns true if the response matches the password
	* @param session includes information about the session like remoteAddress for the remote IP, see details here
	* @param cb is the function to run once the user is authenticated. Takes 2 arguments: (error, response)
	*		error: is an error to return if authentication failed. If you want to set custom error code, set responseCode to the error object
	*		response: is an object with the authentication results
	*		user: can be any value - if this is set then the user is considered logged in and this value is used later with the session data to identify the user. If this value is empty, then the authentication is considered failed
	*		data: is an object to return if XOAUTH2 authentication failed (do not set the error object in this case). This value is serialized to JSON and base64 encoded automatically, so you can just return the object
	*/
	onAuth(auth, session, cb)
	{
		const genericErrorPhrase = 'Invalid Credentials';
		const parsedAddress = utillities.parseAddress(auth.username);
		if(!parsedAddress) {
			this.logger.info({
				txn: 'auth',
				ip: session.remoteAddress,
				address: auth.username,
				status: 'bad-address'
			});
			return cb(new Error(genericErrorPhrase));
		}

		if(parsedAddress.domain != smtpConfig.serverDomain) {
			// Logging in with an account which isn't even associated with this mail
			// server
			this.logger.info({
				txn: 'auth',
				ip: session.remoteAddress,
				address: auth.username,
				status: 'bad-address'
			});
			return cb(new Error(genericErrorPhrase));
		}

		this.options.auth.validate(parsedAddress.localpart, auth.password, (err, data) => {
			if(err) {
				return cb(err);
			}

			if(!data.valid) {
				this.logger.info({
					txn: 'auth',
					ip: session.remoteAddress,
					address: auth.username,
					status: (data.badPassword ? 'bad-password' : 'bad-address')
				});
				return cb(new Error(genericErrorPhrase));
			}

			this.logger.info({
				txn: 'auth',
				ip: session.remoteAddress,
				address: auth.username,
				status: 'okay'
			});

			return cb(null, {
				user: {
					id: data.localpart,
					localpart: data.localpart,
					name: data.name
				}
			});
		});
	}

	/**
	* handles mail from event
	* @param address is an address object with the provided email address from MAIL FROM: command
	* @param session includes the envelope object and user data if logged in, see details here
	* @param callback is the function to run after validation. If you return an error object, the address is rejected, otherwise it is accepted
	*/
	onMailFrom(address, session, cb)
	{
		const genericMessage = 'Bad Address';
		const parsedAddress = utillities.parseAddress(address.address);

		// basically a big if-statement for checking whether the sender address is
		// valid
		if(
			!parsedAddress ||
			parsedAddress.domain != smtpConfig.domain ||
			typeof session.user == 'undefined' ||
			session.user === null ||
			parsedAddress.localpart != session.user.localpart
		) {
			return cb(new Error(genericMessage));
		}

		return cb();
	}

	/**
	* Handles on recipient event.
	* @param address is an address object with the provided email address from RCPT TO: command
	* @param session includes the envelope object and user data if logged in, see details here
	* @param callback is the function to run after validation. If you return an error object, the address is rejected, otherwise it is accepted
	*/
	onRcptTo(address, session, cb)
	{
		cb();
	}

	/**
	* You can get the stream for the incoming message with onData handler
	* @param stream is a readable stream for the incoming message
	* @param session includes the envelope object and user data if logged in, see details here
	* @param callback is the on to run once the stream is ended and you have processed the outcome. If you return an error object, the message is rejected, otherwise it is accepted
	*/
	onData(stream, session, cb)
	{
		if(stream.sizeExceeded) {
			return cb(this._errorWithRespnse('Message too big', 552));
		}

		// Creating the MailParser.
		const parser = new MailParser();
		parser.on('error', this.logger.error);

		// Piping to the mail parser.
		stream.pipe(parser);

		let message = {
			from: `${session.user.name} <${session.user.localpart}@${smtpConfig.serverDomain}>`,
			attachments: [],
		};

		parser.on('headers', () => {
			this._onHeaders(parser.getHeaders(), message);
		});

		parser.on('data', data => {
			this._onBody(data, message);
		});

		parser.on('end', () => {
			cb();
			this._onEnd(session, message);
		});
	}

	/**
	* Processes headers and sets headers for a message
	* @param headers Array of headers (each index of array is an object with a key/value)
	* @param message Message which we can alter.
	*/
	_onHeaders(headers, message)
	{
		message.headers = [];
		message.headers.push({
			key: 'X-Powerd-By',
			value: 'github.com/eithan1231/authenticated-smtp-server'
		});

		for(let header in message.headers) {
			switch (header.key.toLowerCase()) {
				case 'subject': {
					message.subject = header.value;
					break;
				}

				// Ones we want to remove (Generally expose other backends)
				case 'x-sender-id':
				case 'x-authentication-warning':
				case 'x-php-script':
				case 'x-mailer':
				case 'received': {
					break;
				}

				// Set elsewhere
				case 'content-type':
				case 'to':
				case 'from': {
					break;
				}

				default: {
					message.headers.push({
						key: header.key,
						value: header.value
					});
					break;
				}
			}
		}
	}

	/**
	* Handles a new body (may be an attachment, html body, text body, or others.)
	* @param data Dat and the type
	* @param message the messsage we are building
	*/
	_onBody(data, message)
	{
		switch (data.type) {
			case 'text': {

				if(data.html) {
					message.html = data.html;
				}

				if(data.text) {
					message.text = data.text;
				}

				break;
			}

			case 'attachment': {
				// Create temporary file, write content of attachment to it. Once it's
				// done, add the attachment to the attachment list.

				tmp.file((err, path, fd, cleanupCallback) => {
					if(err) {
						throw Err;
					}

					// Creating write stream for temp file and then piping attachment to
					// it.
					const writeStream = fs.createWriteStream(path);
					data.content.pipe(writeStream);

					// Event for when the attachment has been entirely received.
					data.content.on('end', () => {

						// Releasing the data.
						data.release();

						// Copying the data object and assiging new data to it.
						let attachment = Object.assign({}, data);
						attachment.cid = attachment.contentId;
						attachment.path = path;

						// Removing all properties that aren't needed.
						['content', 'related', 'release', 'contentId', 'headers', 'size', 'checksum', 'type'].forEach(k => {
							delete attachment[k];
						});

						// Adding this attachment to the attachment list.
						message.attachments.push(attachment);
					});
				});

				break;
			}

			default: return;
		}
	}

	/**
	* The end of a SMTP session. Handle the forwarding of mail here.
	* @param session session which has come to an end
	* @param message the message which we are relaying.
	*/
	async _onEnd(session, message)
	{
		let preserveAttachments = false;

		for(let recipient of session.envelope.rcptTo) {
			if(await SMTPDelivery.send(session.user, recipient.address, message)) {
				this.logger.info({
					txn: 'send',
					success: true,
					sender: session.user.localpart,
					recipient: recipient.address,
					subject: message.subject
				});
			}
			else {
				//preserveAttachments = true;
				this.logger.info({
					txn: 'send',
					success: false,
					sender: session.user.localpart,
					recipient: recipient.address,
					subject: message.subject
				});
			}
		}

		// Cleanup attachments
		if(preserveAttachments) {
			// TODO: Attempt to resend at a later time.
		}
		else {
			message.attachments.forEach(attachment => {
				fs.unlink(attachment.path, err => {
					this.logger.error(err);
				});
			});
		}
	}

	/**
	* Creates an error object
	* @param msg error message
	* @param code sets the 'responseCode' variable.
	*/
	_errorWithRespnse(msg, code)
	{
		let error = new Error(msg);
		error.responseCode = code;
		return error;
	}
}
