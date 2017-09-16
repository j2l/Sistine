const {
  Command,
} = require('klasa');
const snekfetch = require('snekfetch');

module.exports = class extends Command {

  constructor(...args) {
    super(...args, {
      name: 'whosthatpokemon',
      enabled: true,
      runIn: ['text'],
      cooldown: 0,
      aliases: ['wtp', 'whosethatpokemon'],
      permLevel: 0,
      botPerms: ['SEND_MESSAGES'],
      requiredSettings: [],
      description: 'Guess that Pokemon!',
      usage: '',
      extendedHelp: 'No Additional Arguments, just use the command.',
    });
    this.requireMusic = false;
  }

  async run(msg) {
    function filterPkmn(arr) {
      const filtered = arr.filter(entry => entry.language.name === 'en');
      return filtered[Math.floor(Math.random() * filtered.length)];
    }

    const pokemon = Math.floor(Math.random() * 721) + 1;
    const results = await snekfetch
      .get(`https://pokeapi.co/api/v2/pokemon-species/${pokemon}`, { followRedirects: true });
    const name = filterPkmn(results.body.names).name.toLowerCase();
    const id = `${'000'.slice(results.body.id.toString().length)}${results.body.id}`;
    const done = new this.client.methods.Embed()
      .setTitle(msg.language.get('WTP_EMBED_TITLE'))
      .setColor(0xED1C24)
      .setImage(`https://www.serebii.net/sunmoon/pokemon/${id}.png`);
    await msg.send('', { embed: done });
    const msgs = await msg.channel.awaitMessages(res => res.author.id === msg.author.id, {
      max: 1,
      time: 15000,
    });
    if (!msgs.size) return msg.send(msg.language.get('WTP_OUT_TIME', name));
    if (msgs.first().content.toLowerCase() !== name) return msg.send(msg.language.get('WTP_INCORRECT', name));
    return msg.send(msg.language.get('WTP_CORRECT', msg.author.tag));
  }

};
