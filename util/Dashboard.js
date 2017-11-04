const url = require('url');
const path = require('path');

// Used for Permission Resolving...
const Discord = require('discord.js');

// Express Session
const express = require('express');
const app = express();
const moment = require('moment');
require('moment-duration-format');

// Express Plugins
// Specifically, passport helps with oauth2 in general.
// passport-discord is a plugin for passport that handles Discord's specific implementation.
const passport = require('passport');
const session = require('express-session');
const LevelStore = require('level-session-store')(session);
const { Strategy } = require('passport-discord');
// Used to parse Markdown from things like ExtendedHelp
const md = require('marked');
const helmet = require('helmet');
// Get Dashboard settings file
const settings = require('../keys/dashboard.json');


class Dashboard {

	/* eslint-disable consistent-return */
	static async startDashboard(client) {
		String.prototype.toProperCase = function prop() {
			return this.replace(/([^\W_]+[^\s-]*) */g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
		};

		const dataDir = path.resolve(`${process.cwd()}${path.sep}dashboard`);
		const templateDir = path.resolve(`${dataDir}${path.sep}templates`);

		app.use('/public', express.static(path.resolve(`${dataDir}${path.sep}public`)));

		passport.serializeUser((user, done) => {
			done(null, user);
		});
		passport.deserializeUser((obj, done) => {
			done(null, obj);
		});

		passport.use(new Strategy({
			clientID: settings.clientID,
			clientSecret: settings.clientSecret,
			callbackURL: settings.callbackURL,
			scope: ['identify', 'guilds']
		},
		(accessToken, refreshToken, profile, done) => {
			process.nextTick(() => done(null, profile));
		}));


		// Session data, used for temporary storage of your visitor's session information.
		// the `secret` is in fact a "salt" for the data, and should not be shared publicly.
		app.use(session({
			store: new LevelStore('./bwd/dashboard-session/'),
			secret: settings.sessionSecret,
			resave: false,
			saveUninitialized: false
		}));

		// Initializes passport and session.
		app.use(passport.initialize());
		app.use(passport.session());
		app.use(helmet());

		// The domain name used in various endpoints to link between pages.
		app.locals.domain = settings.domainName;

		// The EJS templating engine gives us more power
		app.engine('html', require('ejs').renderFile);
		app.set('view engine', 'html');

		// body-parser reads incoming JSON or FORM data and simplifies their
		// use in code.
		var bodyParser = require('body-parser');
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: true }));

		/*
  Authentication Checks. checkAuth verifies regular authentication,
  whereas checkAdmin verifies the bot owner. Those are used in url
  endpoints to give specific permissions.
  */
		function checkAuth(req, res, next) {
			if (req.isAuthenticated()) { return next(); }
			req.session.backURL = req.url;
			res.redirect('/login');
		}

		// This function simplifies the rendering of the page, since every page must be rendered
		// with the passing of these 4 variables, and from a base path.
		// Objectassign(object, newobject) simply merges 2 objects together, in case you didn't know!
		const renderTemplate = (res, req, template, data = {}) => {
			const baseData = {
				bot: client,
				path: req.path,
				auth: !!req.isAuthenticated(),
				user: req.isAuthenticated() ? req.user : null
			};
			res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
		};

		// Index page. If the user is authenticated, it shows their info
		// at the top right of the screen.
		app.get('/', (req, res) => {
			renderTemplate(res, req, 'index.ejs');
		});

		// The login page saves the page the person was on in the session,
		// then throws the user to the Discord OAuth2 login page.
		app.get('/login', (req, res, next) => {
			if (req.session.backURL) {
				req.session.backURL = req.session.backURL;
			} else if (req.headers.referer) {
				const parsed = url.parse(req.headers.referer);
				if (parsed.hostname === app.locals.domain) {
					req.session.backURL = parsed.path;
				}
			} else {
				req.session.backURL = '/';
			}
			next();
		},
		passport.authenticate('discord'));

		app.get('/callback', passport.authenticate('discord', { failureRedirect: '/autherror' }), (req, res) => {
			if (req.user.id === client.config.ownerID) {
				req.session.isAdmin = true;
			} else {
				req.session.isAdmin = false;
			}
			if (req.session.backURL) {
				const backUrl = req.session.backURL;
				req.session.backURL = null;
				res.redirect(backUrl);
			} else {
				res.redirect('/');
			}
		});

		app.get('/autherror', (req, res) => {
			renderTemplate(res, req, 'autherror.ejs');
		});

		app.get('/logout', (req, res) => {
			req.session.destroy(() => {
				req.logout();
				res.redirect('/');
				// Inside a callback… bulletproof!
			});
		});

		// The Admin dashboard is similar to the one above, with the exception that
		// it shows all current guilds the bot is on, not *just* the ones the user has
		// access to. Obviously, this is reserved to the bot's owner for security reasons.
		app.get('/admin', checkAuth, (req, res) => {
			if (!req.session.isAdmin) return res.redirect('/');
			renderTemplate(res, req, 'admin.ejs');
		});

		app.get('/dashboard', checkAuth, (req, res) => {
			const perms = Discord.EvaluatedPermissions;
			renderTemplate(res, req, 'dashboard.ejs', { perms });
		});

		// Simple redirect to the "Settings" page (aka "manage")
		app.get('/dashboard/:guildID', checkAuth, (req, res) => {
			res.redirect(`/dashboard/${req.params.guildID}/manage`);
		});

		app.get('/dashboard/:guildID/members', checkAuth, async (req, res) => {
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			renderTemplate(res, req, 'guild/members.ejs', {
				guild: guild,
				members: guild.members.array()
			});
		});

		app.get('/dashboard/:guildID/members/list', checkAuth, async (req, res) => {
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			if (req.query.fetch) {
				await guild.fetchMembers();
			}
			const totals = guild.members.size;
			const start = parseInt(req.query.start, 10) || 0;
			const limit = parseInt(req.query.limit, 10) || 50;
			let { members } = guild;

			if (req.query.filter && req.query.filter !== 'null') {
				// if (!req.query.filtervalue) return res.status(400);
				members = members.filter(meme => {
					meme = req.query.filterUser ? meme.user : meme;
					return meme.displayName.toLowerCase().includes(req.query.filter.toLowerCase());
				});
			}

			if (req.query.sortby) {
				members = members.sort((a, b) => a[req.query.sortby] > b[req.query.sortby]);
			}
			const memberArray = members.array().slice(start, start + limit);

			const returnObject = [];
			for (let i = 0; i < memberArray.length; i++) {
				const meme = memberArray[i];
				returnObject.push({
					id: meme.id,
					status: meme.user.presence.status,
					bot: meme.user.bot,
					username: meme.user.username,
					displayName: meme.displayName,
					tag: meme.user.tag,
					discriminator: meme.user.discriminator,
					joinedAt: meme.joinedTimestamp,
					createdAt: meme.user.createdTimestamp,
					highestRole: { hexColor: meme.highestRole.hexColor },
					memberFor: moment.duration(Date.now() - meme.joinedAt).format(' D [days], H [hrs], m [mins], s [secs]'),
					roles: meme.roles.map(rollingDownTheHill => ({
						name: rollingDownTheHill.name,
						id: rollingDownTheHill.id,
						hexColor: rollingDownTheHill.hexColor
					}))
				});
			}
			res.json({
				total: totals,
				page: (start / limit) + 1,
				pageof: Math.ceil(members.size / limit),
				members: returnObject
			});
		});

		app.get('/dashboard/:guildID/manage', checkAuth, (req, res) => {
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
			if (!isManaged && !req.session.isAdmin) res.redirect('/');
			renderTemplate(res, req, 'guild/manage.ejs', { guild });
		});

		app.post('/dashboard/:guildID/manage', checkAuth, (req, res) => {
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
			if (!isManaged && !req.session.isAdmin) res.redirect('/');
			const gsettings = client.settings.guilds.getEntry(guild.id);
			for (const key in settings) {
				gsettings[key] = req.body[key];
			}
			client.settings.set(guild.id, settings);
			res.redirect(`/dashboard/${req.params.guildID}/manage`);
		});

		app.get('/dashboard/:guildID/manage', checkAuth, (req, res) => {
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
			if (!isManaged && !req.session.isAdmin) res.redirect('/');
			renderTemplate(res, req, 'guild/manage.ejs', { guild });
		});

		app.get('/dashboard/:guildID/leave', checkAuth, async (req, res) => {
			client.stats.increment('client.httpreq');
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
			if (!isManaged && !req.session.isAdmin) res.redirect('/');
			await guild.leave();
			if (req.user.id === client.config.ownerID) {
				return res.redirect('/admin');
			}
			res.redirect('/dashboard');
		});

		app.get('/dashboard/:guildID/reset', checkAuth, async (req, res) => {
			client.stats.increment('client.httpreq');
			const guild = client.guilds.get(req.params.guildID);
			if (!guild) return res.status(404);
			const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
			if (!isManaged && !req.session.isAdmin) res.redirect('/');
			client.settings.set(guild.id, client.settings.get('default'));
			res.redirect(`/dashboard/${req.params.guildID}`);
		});


		app.get('/commands', (req, res) => {
			renderTemplate(res, req, 'commands.ejs', { md });
		});

		// Bot statistics. Notice that most of the rendering of data is done through this code,
		// not in the template, to simplify the page code. Most of it **could** be done on the page.
		app.get('/stats', (req, res) => {
			res.redirect('https://p.datadoghq.com/sb/82a5d5fef-1a21d0b3a5');
		});

		client.site = app.listen(settings.dashboardPort, () => {
			client.emit('log', `Dashboard started on ${settings.dashboardPort}`);
		});
	}

}
module.exports = Dashboard;
