#!/usr/bin/env node
/* End-to-end test without the live (Cloudflare-protected) site:
 * intercept every request for the real trade URL and return a tiny page +
 * API payloads.  This proves content-script injection, MAIN-world data load,
 * fetch rewriting, and DOM text replacement. */
const http = require('http');

const port = 9444;
const url = 'https://www.pathofexile.com/trade/search/TestLeague';

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const pageHtml = `<!doctype html>
<html><head><title>Search</title></head>
<body>
  <h1 id="heading">Search</h1>
  <button id="button" title="Search">Search</button>
  <div id="api">pending</div>
  <div id="fetch">pending</div>
  <div id="item">pending</div>
  <div id="items">pending</div>
  <div id="filter">pending</div>
  <div id="xhr">pending</div>
  <div id="xhrready">pending</div>
  <script>
    fetch('/api/trade/data/stats').then(function (r) { return r.json(); }).then(function (d) {
      document.getElementById('api').textContent =
        d.result[0].label + ' / ' + d.result[1].entries[0].text;
    });
    fetch('/api/trade/fetch/abc').then(function (r) { return r.json(); }).then(function (d) {
      document.getElementById('fetch').textContent =
        d.result[0].item.explicitMods[0].description;
      document.getElementById('item').textContent =
        d.result[0].item.name + ' / ' + d.result[0].item.typeLine;
    });
    fetch('/api/trade/data/items').then(function (r) { return r.json(); }).then(function (d) {
      document.getElementById('items').textContent = d.result[0].entries[0].text;
    });
    fetch('/api/trade/data/filters').then(function (r) { return r.json(); }).then(function (d) {
      var o = d.result[0].filters[0].option.options[0];
      document.getElementById('filter').textContent = o.id + '=' + o.text;
    });
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/trade/data/stats');
    xhr.onload = function () {
      document.getElementById('xhr').textContent = JSON.parse(xhr.responseText).result[0].label;
    };
    xhr.send();
    var xr = new XMLHttpRequest();
    xr.open('GET', '/api/trade/data/stats');
    xr.onreadystatechange = function () {
      if (xr.readyState === 4) {
        document.getElementById('xhrready').textContent = JSON.parse(xr.responseText).result[0].label;
      }
    };
    xr.send();
  </script>
</body></html>`;

const stats = {
  result: [
    { id: 'pseudo', label: 'Pseudo', entries: [] },
    { id: 'explicit', label: 'Explicit', entries: [
      { id: 'pseudo.pseudo_total_cold_resistance', text: '+#% total to Cold Resistance', type: 'pseudo' }
    ] }
  ]
};

const fetched = {
  result: [{
    item: {
      name: 'Tabula Rasa',
      typeLine: 'Simple Robe',
      baseType: 'Simple Robe',
      explicitMods: [{
        description: '+42% total to Cold Resistance',
        hash: 'stat.pseudo.pseudo_total_cold_resistance',
        mods: [{ magnitudes: [{ min: 1, max: 60 }] }]
      }]
    }
  }]
};

const items = {
  result: [{
    id: 'gem', label: 'Gems', entries: [
      { type: 'Bladefall', text: 'Bladefall of Trarthus', disc: 'alt_z' }
    ]
  }]
};

const filters = {
  result: [{
    id: 'status_filters', filters: [{
      id: 'status', option: { options: [
        { id: 'available', text: 'Instant Buyout and In Person' },
        { id: 'onlineleague', text: 'In Person (Online in League)' },
        { id: 'any', text: 'Any' }
      ] }
    }]
  }]
};

(async () => {
  const list = await getJson('/json/list');
  const page = list.find((t) => t.type === 'page' && t.url === 'about:blank') || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Fetch.requestPaused') {
      const req = msg.params;
      const u = req.request.url;
      let body = null;
      let type = 'application/json; charset=utf-8';
      if (u.indexOf('/trade/search/') !== -1 || u.endsWith('/trade/search/TestLeague')) {
        body = pageHtml; type = 'text/html; charset=utf-8';
      } else if (u.indexOf('/api/trade/data/stats') !== -1) {
        body = JSON.stringify(stats);
      } else if (u.indexOf('/api/trade/data/items') !== -1) {
        body = JSON.stringify(items);
      } else if (u.indexOf('/api/trade/data/filters') !== -1) {
        body = JSON.stringify(filters);
      } else if (u.indexOf('/api/trade/fetch/') !== -1) {
        body = JSON.stringify(fetched);
      }
      if (body === null) {
        send('Fetch.fulfillRequest', {
          requestId: req.requestId, responseCode: 404,
          responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
          body: Buffer.from('not found').toString('base64')
        }).catch(() => {});
      } else {
        send('Fetch.fulfillRequest', {
          requestId: req.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: type }],
          body: Buffer.from(body, 'utf8').toString('base64')
        }).catch(() => {});
      }
    }
  };

  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 4000));

  const result = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      href: location.href,
      title: document.title,
      body: document.body ? document.body.innerText : '',
      api: (document.getElementById('api')||{}).textContent,
      fetch: (document.getElementById('fetch')||{}).textContent,
      item: (document.getElementById('item')||{}).textContent,
      items: (document.getElementById('items')||{}).textContent,
      filter: (document.getElementById('filter')||{}).textContent,
      xhr: (document.getElementById('xhr')||{}).textContent,
      xhrready: (document.getElementById('xhrready')||{}).textContent,
      marker: window.__POE_CN__ || null
    })`,
    returnByValue: true
  });
  console.log(result.result && result.result.value);

  const ev = JSON.parse(result.result.value);
  const miss = ['搜尋', '+#% 冰冷抗性', '+42% 冰冷抗性', '無盡之衣', '立即購買或當面交易']
    .filter((s) => !String(ev.body || '').includes(s));
  const mk = ev.marker;
  if (!mk) miss.push('window.__POE_CN__ (数据脚本没加载)');
  else {
    if (mk.game !== 'poe1') miss.push('marker.game=' + mk.game);
    if (mk.lang !== 'tw') miss.push('marker.lang=' + mk.lang);
    if (!(mk.stats >= 15000)) miss.push('marker.stats=' + mk.stats);
  }
  if (miss.length) {
    console.error('FAIL PoE1 页面没有正确繁體化，缺: ' + miss.join(' | '));
    process.exit(1);
  }
  console.error('ok   poe1/tw e2e: ' + mk.lang + ' stats=' + mk.stats + ' items=' + mk.items);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('build/e2e.png', Buffer.from(shot.data, 'base64'));
  ws.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
