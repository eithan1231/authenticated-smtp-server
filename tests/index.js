const assert = require('assert');
const argument = require('../library/argument');
const MailParser = require('../library/MailParser');
const SMTPDelivery = require('../library/SMTPDelivery');
const SMTPServer = require('../library/SMTPServer');
const utilities = require('../library/utilities');


describe('utilities', () => {
	describe('parseAddress', () => {
		it('should return false when \'@\' is not found', () => {
			assert.equal(
				utilities.parseAddress('testtest.com'),
				false
			);
		});

		it('should return false when localpart or domain is not found', () => {
			assert.equal(
				utilities.parseAddress('test@'),
				false
			);

			assert.equal(
				utilities.parseAddress('@gmail.com'),
				false
			);
		});

		it('should return localpart and domain in a object when localpart and domain are seperated by \'@\'', () => {
			const addr = utilities.parseAddress('test@gmail.com');
			assert.equal(typeof addr, 'object');
			assert.equal(addr.localpart, 'test');
			assert.equal(addr.domain, 'gmail.com');
		});

		it('should return false if multiple \'@\'s are found', () => {
			assert.equal(utilities.parseAddress('test@@gmail.com'), false);
		});
	});
});
