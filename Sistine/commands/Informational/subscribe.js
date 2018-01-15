const { Command } = require('klasa');
const { announcement } = require('../../lib/Util');

module.exports = class Subscribe extends Command {

	constructor(...args) {
		super(...args, {
			runIn: ['text'],
			description: 'Subscribe to this servers\' announcements.'
		});
	}

	async run(msg) {
		const role = await announcement(msg);
		if (msg.member.roles.has(role)) return msg.send(msg.language.get('ALREADY_SUBSCRIBE', true, msg.guild.name));
		await msg.member.addRole(role);
		return msg.send(msg.language.get('COMMAND_SUBSCRIBE_SUCCESS', role.name));
	}

};