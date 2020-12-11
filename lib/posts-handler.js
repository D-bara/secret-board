'use strict';
const crypto = require('crypto'); //暗号化
const pug = require('pug');
const Cookies = require('cookies');
const moment = require('moment-timezone');
const util = require('./handler-util');
const Post = require('./post');
const trackingIdKey = 'tracking_id';

// 投稿機能
function handle(req, res) {
	const cookies = new Cookies(req, res);
	const trackingId = addTrackingCookie(cookies, req.user);

	switch (req.method) {
		case 'GET':
			res.writeHead(200, {
				'Content-Type': 'text/html; charset=utf-8'
			});
			Post.findAll({ order: [['id', 'DESC']] }).then((posts) => {
				posts.forEach(post => {
					post.content = post.content.replace(/\+/g, ' ');
					post.formattedCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
				});
				res.end(pug.renderFile('./views/posts.pug', {
					posts: posts,
					user: req.user
				}));
				console.info(
					`閲覧されました: user: ${req.user}, ` +
					`trackingId: ${trackingId}, ` +
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
					trackingCookie: trackingId,
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

/**
 * Cookieに含まれているトラッキングIDに異常がなければその値を返し、
 * 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
 * @param {Cookies} cookies 
 * @param {String} userName 
 * @return {String} トラッキングID
 */
function addTrackingCookie(cookies, userName) {
	const requestedTrackingId = cookies.get(trackingIdKey);
	if (isValidTrackingId(requestedTrackingId, userName)){
		return requestedTrackingId;
	} else {
		const originalId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
		const trackingId = originalId + '_' + createValidHash(originalId, userName);
		cookies.set(trackingIdKey, trackingId, { expires: tomorrow });
		return trackingId;
	}
}

function isValidTrackingId(trackingId, userName) { //Valid 有効な
	if (!trackingId) return false;
	const splitted = trackingId.split('_');
	const originalId = splitted[0];
	const requestedHash = splitted[1];
	return createValidHash(originalId, userName) === requestedHash;
}

function createValidHash(originalId, userName) {
	const sha1sum = crypto.createHash('sha1'); // sha1でハッシュ化
	sha1sum.update(originalId + userName);
	return sha1sum.digest('hex'); // sha1sumを16進数化
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
