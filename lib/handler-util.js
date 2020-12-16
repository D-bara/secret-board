'use strict';
const fs = require('fs');

// ログアウト処理
function handleLogout(req, res) {
	res.writeHead(401, {
		'Content-Type': 'text/html; charset=utf-8'
	});
	res.end(`<!DOCTYPE html><html lang="ja"><body> 
	<h1>ログアウトしました</h1>
	<a href="/posts">ログイン</a>
	</body></html>`);
}

// 実装されていないページ(404)
function handleNotFound(req, res) {
	res.writeHead(404, {
		'Content-Type': 'text/plain; charset=utf-8'
	});
	res.end('ページが見つかりません');
}

// 実装されてないメソッドがきた場合
function handleBadRequest(req, res) {
	res.writeHead(400, {
		'Content-Type': 'text/plain; charset=utf-8'
	});
	res.end('未対応のリクエストです');
}

//faviconの実装
function handleFavicon(req, res) {
	res.writeHead(200, {
		'Content-Type': 'image/vnd.mictosoft.icon'
	});
	const favicon = fs.readFileSync('./favicon.ico');
	res.end(favicon);
}

module.exports = {
	handleLogout,
	handleNotFound,
	handleBadRequest,
	handleFavicon
};