'use strict';
const pug = require('pug');
const Cookies = require('cookies');
const moment = require('moment-timezone');
const util = require('./handler-util');
const Post = require('./post');
const trackingIdKey = 'tracking_id';

// 投稿機能
function handle(req, res) {
	const cookies = new Cookies(req, res);
	addTrackingCookie(cookies);

	switch (req.method) {
		case 'GET':
			res.writeHead(200, {
				'Content-Type': 'text/html; charset=utf-8'
			});
			Post.findAll({ order: [['id', 'DESC']] }).then((posts) => {
				posts.forEach(post => {
					post.content = post.content.replace(/\n/g, '<br>');
					post.formattedCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
				});
				res.end(pug.renderFile('./views/posts.pug', {
					posts: posts,
					user: req.user
				}));
				console.info(
					`閲覧されました: user: ${req.user}, ` +
					`trackingId: ${cookies.get(trackingIdKey)}, ` +
					`IPアドレス: ${req.connection.remoteAddress}, ` +
					`useragent: ${req.headers['user-agent']} \n`
				);
			});
			break;
		case 'POST':
			let body = '';
			req.on('data', (chunk) => {
				body += chunk;
			}).on('end', () => {
				const decoded = decodeURIComponent(body); //日本語は文字化けするため日本語に戻す
				let content = decoded.split('content=')[1];
				console.info(`投稿されました: ${content} \n`);
				Post.create({
					content: content,
					trackingCookie: cookies.get(trackingIdKey),
					postedBy: req.user
				}).then(() => { //then 完了してから先に進む
					handleRedirectPosts(req, res);
				});
			});
			break;
		default:
			util.handleBadRequest(req, res);
			break;
	}
}

// 削除機能
function handleDelete(req, res) {
	switch (req.method) {
		case 'POST':
			let body = '';
			req.on('data', (chunk) => {
				body += chunk;
			}).on('end', () => {
				const decoded = decodeURIComponent(body);
				const id = decoded.split('id=')[1];
				Post.findByPk(id).then((post) => {
					if (req.user === post.postedBy || req.user === 'admin') {
						post.destroy().then(() => {
							console.info(
								`削除されました: user: ${req.user}, ${id} ` +
								`remoteAddress: ${req.connection.remoteAddress}, ` +
								`userAgent: ${req.headers['user-agent']} \n`
							)
							handleRedirectPosts(req, res);
						});
					}
				});
			});
			break;
		default:
			util.handleBadRequest(req, res);
			break;
	}
}

function addTrackingCookie(cookies) {
	if (cookies.get(trackingIdKey)) return;

	const trackingId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
	const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
	cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
}

function handleRedirectPosts(req, res) {
	res.writeHead(303, {
		'Location': '/posts'
	});
	res.end();
}

module.exports = {
	handle,
	handleDelete
};
