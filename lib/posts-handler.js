'use strict';
const crypto = require('crypto'); //暗号化
const pug = require('pug');
const Cookies = require('cookies');
const moment = require('moment-timezone');
const util = require('./handler-util');
const Post = require('./post');
const trackingIdKey = 'tracking_id';

const oneTimeTokenMap = new Map(); // キーをユーザー名、値をトークンとする連想配列

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
				const oneTimeToken = crypto.randomBytes(8).toString('hex');
				oneTimeTokenMap.set(req.user, oneTimeToken);
				res.end(pug.renderFile('./views/posts.pug', {
					posts: posts,
					user: req.user,
					oneTimeToken: oneTimeToken
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
				const matchResult = decoded.match(/content=(.*)&oneTimeToken=(.*)/);
				if (!matchResult) return util.handleBadRequest(req, res);
				const content = matchResult[1];
				const requestedOneTimeToken = matchResult[2];
				if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
					console.info(`投稿されました: ${content} \n`);
					Post.create({
						content: content,
						trackingCookie: trackingId,
						postedBy: req.user
					}).then(() => { //then 完了してから先に進む
						oneTimeTokenMap.delete(req.user);
						handleRedirectPosts(req, res);
					});
				} else {
					util.handleBadRequest(req, res);
				}
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
				console.log(decoded);
				const matchResult = decoded.match(/id=(.*)&oneTimeToken=(.*)/);
				if (!matchResult) return util.handleBadRequest(req, res);
				const id = matchResult[1];
				const requestedOneTimeToken = matchResult[2];
				if (oneTimeTokenMap.get(req.user) === requestedOneTimeToken) {
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
				} else {
					util.handleBadRequest(req, res);
				}
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
		const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
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

const secretKey = 
`5640d6fda5a2a0cecdf7db3b0625c9341e159092ca18f7244214c54a1
894abf861038e22a1884d7fee2920be02e9859224a47153680da155c79
5000892c679f819167676ad3284be554358222c5e45028cfa3f27a3c56
10a498bb7bf0d4f5d2df1126a109aea64ae7e121fcedf7ffecdba98ae1
55e857e3138193bd482854217bdd246dc7cac040758658b33c4b1c6151
8135374126d0326f70e131106c4a07fb3e986d3d8648ea765569bca41e
4913f873a9e07d37eba2e35d2c226fde39b36cc829a31ed09d480d31fa
256be48904ceefa4763c29cf876505ed74d2ecf47b686f6ac2ad753626
22b2904e114ff1d8f4111be584d44b34f8e66475ac002a10a`;
function createValidHash(originalId, userName) {
	const sha1sum = crypto.createHash('sha1'); // sha1でハッシュ化
	sha1sum.update(originalId + userName + secretKey);
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
