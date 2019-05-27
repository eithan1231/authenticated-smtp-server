const PromiseDNSResolver = require('dns').promises.Resolver;


module.exports = class utilities
{
	/**
	* Resolves MX hostnames and sorts by priority.
	* NOTE: On exception, it just resolves false.
	* @param hostname The domain which we want to retreive mx records of.
	*/
	static resolveMXRecords(hostname)
	{
		return new Promise(async (resolve, reject) => {
			try {
				const resolver = new PromiseDNSResolver();
				let records = await resolver.resolveMx(hostname);
				if(!records || !records.length) {
					return resolve(false);
				}

				// Sorting MX priorities
				records.sort((a, b) => {
					if (a.priority < b.priority) {
						return -1;
					}
					if (a.priority > b.priority) {
						return 1;
					}
					return 0;
				});

				return resolve(records);
			}
			catch(err) {
				// More than probable that there are just no mx records.
				return resolve(false);
			}
		});
	}

	/**
	* Simplistic email parser
	* NOTE: Not to specification
	* @param address to parse
	* @return on error, false, on success, an object with two keys. a key for domain, and localpart.
	*/
	static parseAddress(address)
	{
		const lpe = address.lastIndexOf('@');//localpart end
		const firstLpe = address.indexOf('@');
		if(lpe < 0 || firstLpe != lpe) {
			return false;
		}

		const localpart = address.substring(0, lpe);
		const domain = address.substring(lpe + 1);

		if(!localpart || !domain) {
			return false;
		}

		return {
			localpart: localpart,
			domain: domain
		};
	}
}
