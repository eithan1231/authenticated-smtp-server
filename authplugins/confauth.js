/**
* this authentication plugin works by comparing credentials against a file which
* contains all usernames and passwords.
*/
const config = require('../library/config');
const accountsConfig = config.readConfigSync('confauth.yaml');

module.exports = class conf
{
	static validate(username, password, cb)
	{
		for (let acc of accountsConfig) {
			if(acc.localpart == username) {
				if(acc.password == password) {
					return cb(null, {
						valid: true,
						id: acc.localpart,
						localpart: acc.localpart,
						name: acc.name
					});
				}
				else {
					return cb(null, {
						valid: false,
						badPassword: true,
					});
				}
			}
		}

		return cb(null, {
			valid: false,
			badPassword: true,
		});
	}
}
