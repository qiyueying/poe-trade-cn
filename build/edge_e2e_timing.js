#!/usr/bin/env node
const http = require('http');
const port = 9444;
const url = 'https://www.pathofexile.com/trade/search/TestLeague2';
function getJson(path) { return new Promise((resolve, reject) => { http.get({host:'127.0.0.1',port,path},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b))}catch(e){reject(e)}});}).on('error',reject); }); }
const pageHtml = `<!doctype html><html><head><title>Search</title></head><body>
<h1 id="heading">Search</h1><button id="button" title="Search">Search</button>
<div id="api">pending</div><div id="fetch">pending</div>
<script>
fetch('/api/trade/data/stats').then(r=>r.json()).then(d=>{document.getElementById('api').textContent=d.result[0].label+' / '+d.result[1].entries[0].text;});
fetch('/api/trade/fetch/abc').then(r=>r.json()).then(d=>{document.getElementById('fetch').textContent=d.result[0].item.explicitMods[0].description;});
</script></body></html>`;
const stats={result:[{id:'pseudo',label:'Pseudo',entries:[]},{id:'explicit',label:'Explicit',entries:[{id:'pseudo.pseudo_total_cold_resistance',text:'+#% total to Cold Resistance',type:'pseudo'}]}]};
const fetched={result:[{item:{name:'Tabula Rasa',typeLine:'Simple Robe',baseType:'Simple Robe',explicitMods:[{description:'+42% total to Cold Resistance',hash:'pseudo.pseudo_total_cold_resistance',mods:[{magnitudes:[{min:42,max:42}]}]}]}}]};
(async()=>{
  const list=await getJson('/json/list');
  const page=list.find(t=>t.type==='page'&&t.url==='about:blank')||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const mid=++id;pending.set(mid,{resolve,reject});ws.send(JSON.stringify({id:mid,method,params}));});
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
    if(m.method==='Runtime.exceptionThrown') console.log('EXC', JSON.stringify(m.params.exceptionDetails).slice(0,800));
    if(m.method==='Runtime.consoleAPICalled') console.log('CONSOLE', m.params.type, m.params.args.map(a=>a.value||a.description).join(' ').slice(0,300));
    if(m.method==='Log.entryAdded') console.log('LOG', m.params.entry.level, m.params.entry.text.slice(0,300));
    if(m.method==='Fetch.requestPaused'){
      const u=m.params.request.url; let body=null,type='application/json; charset=utf-8';
      if(u.includes('/trade/search/')){body=pageHtml;type='text/html; charset=utf-8';}
      else if(u.includes('/api/trade/data/stats'))body=JSON.stringify(stats);
      else if(u.includes('/api/trade/fetch/'))body=JSON.stringify(fetched);
      const responseCode=body===null?404:200;
      if(body===null)body='not found';
      send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')}).catch(e=>console.log('fulfill err',e.message));
    }
  };
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Page.navigate',{url});
  for (const ms of [300,800,1500,3000,5000]) {
    await new Promise(r=>setTimeout(r,ms - (global.__last||0))); global.__last=ms;
    const r=await send('Runtime.evaluate',{expression:`JSON.stringify({t:${ms},body:document.body?document.body.innerText.slice(0,80):'',title:document.title,marker:window.__POE_CN_ACTIVE__||false})`,returnByValue:true});
    console.log(r.result.value);
  }
  ws.close();
})().catch(e=>{console.error(e);process.exit(1);});
