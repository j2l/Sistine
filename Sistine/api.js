const { APIServer } = require('http-nextra');

class DashboardHook extends APIServer {

	constructor(client, options = { port: 6565 }) {
		super(async (request, response) => {
			if (!await this.router.runPath(request.url.slice(1).split('/'), request, response, {})) {
				response.end('Hello!');
			}
		});

		this.client = client;

		this.router.get('stats/', async (request, response) => {
			const rethink = await this.client.providers.default.db('test').table('stats').get('ba598836-3e7f-4d46-a8f5-98a8613fe374').run();
			const guilds = (await this.client.shard.fetchClientValues('guilds.size')).reduce((prev, val) => prev + val, 0);
			const users = (await this.client.shard.fetchClientValues('users.size')).reduce((prev, val) => prev + val, 0);
			const channels = (await this.client.shard.fetchClientValues('channels.size')).reduce((prev, val) => prev + val, 0);
			return response.end(JSON.stringify({ guilds, users, channels, ping: this.client.ping, status: this.client.status, uptime: this.client.uptime, memory: process.memoryUsage().heapUsed / 1024 / 1024, commands: rethink.commands, messages: rethink.messages }));
		});

		this.router.get('commands/', (request, response) => {
			const data = {};
			this.client.commands.filter((command) => command.permLevel <= 3).forEach(command => {
				if (!data.hasOwnProperty(command.category)) data[command.category] = {};
				data[command.category][command.name] = {
					name: command.name,
					description: command.description,
					aliases: command.aliases,
					permLevel: command.permLevel,
					cost: command.cost,
					usageString: command.usage.nearlyFullUsage
				};
			});
			return response.end(JSON.stringify(data));
		});

		this.router.get('guilds/', (request, response) => response.end(JSON.stringify(this.client.guilds.keyArray())));

		this.router.get('guilds/:guildID', (request, response, { guildID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) response.end('{}');
			return response.end(JSON.stringify(guild));
		});

		this.router.get('guilds/:guildID/members', (request, response, { guildID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) response.end('[]');
			return response.end(JSON.stringify(guild.members.keyArray()));
		});

		this.router.get('guilds/:guildID/members/:memberID', (request, response, { guildID, memberID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) return response.end('{}');
			const member = guild.members.get(memberID);
			if (!member) return response.end('{}');
			return response.end(JSON.stringify(member));
		});

		this.router.get('guilds/:guildID/roles', (request, response, { guildID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) response.end('[]');
			return response.end(JSON.stringify(guild.roles.keyArray()));
		});

		this.router.get('guilds/:guildID/roles/:roleID', (request, response, { guildID, roleID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) return response.end('{}');
			const role = guild.members.get(roleID);
			if (!role) return response.end('{}');
			return response.end(JSON.stringify(role));
		});

		this.router.get('guilds/:guildID/channels', (request, response, { guildID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) response.end('[]');
			return response.end(JSON.stringify(guild.channels.keyArray()));
		});

		this.router.get('guilds/:guildID/channels/:channelID', (request, response, { guildID, channelID }) => {
			const guild = this.client.guilds.get(guildID);
			if (!guild) return response.end('{}');
			const channel = guild.members.get(channelID);
			if (!channel) return response.end('{}');
			return response.end(JSON.stringify(channel));
		});

		for (const [name, store] of this.client.pieceStores) {
			this.router.get(`${name}/`, (request, response) => response.end(JSON.stringify(store.keyArray())));

			this.router.get(`${name}/:id`, (request, response, { id }) => {
				const piece = store.get(id);
				if (!piece) response.end('{}');
				return response.end(JSON.stringify(piece));
			});
		}

		this.listen(options.port, () => this.client.emit('log', `[API] Started on port ${options.port}.`));
	}

}

module.exports = DashboardHook;
