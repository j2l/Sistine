const { Command } = require('klasa');
const ModLog = require('../../util/modlog');

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			name: 'ban',
			permLevel: 2,
			botPerms: ['BAN_MEMBERS'],
			runIn: ['text'],

			description: 'Bans the mentioned member.',
			usage: '<user:user> [reason:string] [...]',
			usageDelim: ' '
		});
	}

	async run(msg, [user, ...reason]) {
		reason = reason.length > 0 ? reason.join(' ') : null;

		const member = await msg.guild.members.fetch(user).catch(() => null);

		if (!member);
		else if (!member.bannable) {
			return msg.send(msg.language.get('PUNISH_USER_ERROR', this.name));
		}

		await msg.guild.ban(user, { reason });

		if (msg.guild.settings.modlog) {
			new ModLog(msg.guild)
				.setType('ban')
				.setModerator(msg.author)
				.setUser(user)
				.setReason(reason)
				.send();
		}

		return msg.send(msg.language.get('SUCCESSFUL_PUNISH', 'banned', user.tag, reason));
	}

};