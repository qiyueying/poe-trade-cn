#!/usr/bin/env node
/* Edge 157 起品牌版忽略 --load-extension（构建期实测：日志里根本没有 unpacked 扩展的装载记录，
 * 页面保持英文、marker=null），但 CDP 的 Extensions.loadUnpacked 仍然可用。
 * e2e 先启动浏览器再调这个脚本把 dist 装进去，避免再次假通过。 */
const http = require('http');
const path = require('path');
const port = Number(process.env.E2E_PORT || 9444);

function getJson(p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'poe-trade-cn'));
  const version = await getJson('/json/version');
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const result = await send('Extensions.loadUnpacked', { path: dir });
  ws.close();
  console.log('loaded extension ' + result.id + ' from ' + dir);
})().catch((err) => {
  console.error('FAIL load extension: ' + err.message);
  process.exit(1);
});
