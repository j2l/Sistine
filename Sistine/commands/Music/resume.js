const { Command } = require('klasa');

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			runIn: ['text'],

			description: 'Resumes the current song.'
		});

		this.requireMusic = true;
	}

	async run(msg) {
		const { music } = msg.guild;
		if (music.status === 'idle') throw '<:eww:393547594690986018> There is no music loaded right now. :thinking:';
		if (music.status === 'playing') throw ':headphones: Music is already being played. :thinking:';

		music.resume();
		return msg.send(`▶ Music was resumed by **${msg.author.tag}**.`);
	}

};