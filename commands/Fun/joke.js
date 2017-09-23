const { Command } = require('klasa');
const snekfetch = require('snekfetch');

module.exports = class extends Command {

  constructor(...args) {
    super(...args, {
      name: 'joke',
      enabled: true,
      runIn: ['text'],
      cooldown: 0,
      aliases: [],
      permLevel: 0,
      botPerms: ['SEND_MESSAGES'],
      requiredSettings: [],
      description: 'Responds with a random joke.',
      usage: '',
      usageDelim: undefined,
      extendedHelp: 'No extended help available.',
    });
    this.requireMusic = false;
  }

  async run(msg) {

    try {
      const { body } = await snekfetch
        .get('https://icanhazdadjoke.com/')
        .set({ Accept: 'application/json' });
      return msg.send(`≧◡≦ ${body.joke}`);
    } catch (err) {
      return msg.send(msg.language.get('ERROR_OCCURED', err.message));
    }
  }
};
