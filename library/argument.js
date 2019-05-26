module.exports = class argument
{
	static get(key)
	{
		const args = process.argv.slice(2);
		const pos = args.indexOf(`--${key}`);
		if(pos <= -1) {
			return false;
		}

		if(args.length - 1 <= pos) {
			return true;
		}

		if(args[pos + 1].substring(0, 2) == '--') {
			return true;
		}

		return args[pos + 1];
	}
};
