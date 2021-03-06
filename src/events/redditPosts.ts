import { Event, EventStore } from 'klasa';
import he from 'he';
import * as Snoowrap from 'snoowrap';
import { CommentStream, SubmissionStream } from 'snoostorm';

import { MessageEmbed, TextChannel } from 'discord.js';

import { GuildSettings } from '../lib/GuildSettings';
import JagexMods from '../../data/jagexMods';
import { JMod } from '../lib/types';
const { redditApp } = require('../../config/private');

const jmodAccounts = JagexMods.filter(jmod => jmod.redditUsername).map(jmod => jmod.redditUsername);

interface RedditPost {
	jmod?: JMod;
	text: string;
	url: string;
	title?: string;
}

export default class extends Event {
	public _redditIdCache: Set<any> = new Set();

	public constructor(store: EventStore, file: string[], directory: string) {
		super(store, file, directory, { once: true, event: 'klasaReady' });
		this.enabled = this.client.production;
	}

	async init() {
		const redditClient = new Snoowrap(redditApp);

		if (!redditApp || !redditApp.password) {
			this.disable();
			this.client.emit(
				'log',
				`Disabling Reddit Posts because there is no reddit credentials.`
			);
			return;
		}

		this.client.commentStream = new CommentStream(redditClient, {
			subreddit: '2007scape',
			limit: 30,
			pollTime: 15_000
		});

		this.client.commentStream.on('item', comment => {
			if (!jmodAccounts.includes(comment.author.name.toLowerCase())) return;
			if (this._redditIdCache.has(comment.id)) return;
			this._redditIdCache.add(comment.id);
			this.sendEmbed({
				text: comment.body.slice(0, 1950),
				url: `https://www.reddit.com${comment.permalink}?context=1`,
				jmod: JagexMods.find(
					mod => mod.redditUsername.toLowerCase() === comment.author.name.toLowerCase()
				)
			});
		});

		this.client.commentStream.on('error', console.error);

		this.client.submissionStream = new SubmissionStream(redditClient, {
			subreddit: '2007scape',
			limit: 20,
			pollTime: 60_000
		});

		this.client.submissionStream.on('item', post => {
			if (!jmodAccounts.includes(post.author.name.toLowerCase())) return;
			if (this._redditIdCache.has(post.id)) return;
			this._redditIdCache.add(post.id);
			this.sendEmbed({
				text: post.selftext,
				url: `https://www.reddit.com${post.permalink}`,
				title: post.title,
				jmod: JagexMods.find(
					mod => mod.redditUsername.toLowerCase() === post.author.name.toLowerCase()
				)
			});
		});

		this.client.submissionStream.on('error', console.error);
	}

	run() {}

	sendEmbed({ text, url, title, jmod }: RedditPost) {
		const embed = new MessageEmbed().setDescription(he.decode(text)).setColor(1942002);

		if (jmod) {
			embed.setAuthor(
				jmod.formattedName,
				undefined,
				`https://www.reddit.com/user/${jmod.redditUsername}`
			);
		}

		if (title) {
			embed.setTitle(title);
			embed.setURL(url);
		}

		this.client.guilds
			.filter(guild => !!guild.settings.get(GuildSettings.JMODComments))
			.map(guild => {
				const channel = guild.channels.get(guild.settings.get(GuildSettings.JMODComments));
				if (channel && channel instanceof TextChannel && channel.postable) {
					channel.send(`<${url}>`, { embed }).catch(() => null);
				}
			});
	}
}
