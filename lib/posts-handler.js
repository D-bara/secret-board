'use strict';
const pug = require('pug');
const util = require('./handler-util');
const Post = require('./post');

function handle(req, res) {
	switch (req.method) {
		case 'GET':
			res.writeHead(200, {
				'Content-Type': 'text/html; charset=utf-8'
			});
			Post.findAll({ order: [['id', 'DESC']] }).then((posts) => {
				res.end(pug.renderFile('./views/posts.pug', {
					posts
				}));
			});
			break;
		case 'POST':
			let body = '';
			req.on('data', (chunk) => {
				body += chunk;
			}).on('end', () => {
				const decoded = decodeURIComponent(body); //日本語は文字化けするため日本語に戻す
				let content = decoded.split('content=')[1];
				console.info(`投稿されました: ${content}`);
				Post.create({
					content: content,
					trackingCookie: null,
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

function handleRedirectPosts(req, res) {
	res.writeHead(303, {
		'Location': '/posts'
	});
	res.end();
}

module.exports = {
	handle
};