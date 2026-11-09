#!/usr/bin/env node
const http = require('http');
const port = 9444;
const url = 'https://www.pathofexile.com/trade2/search/TestLeague';
function getJson(path) { return new Promise((resolve, reject) => { http.get({host:'127.0.0.1',port,path},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b))}catch(e){reject(e)}});}).on('error',reject); }); }

const pageHtml = `<!doctype html><html><head><title>Search</title></head><body>
<div id="trade"><h1 id="heading">Search</h1><button id="button" title="Search">Search</button>
<div id="stats">pending</div><div id="fetch">pending</div><div id="item">pending</div>
<div id="items">pending</div><div id="filters">pending</div>
<div id="hl">+42% 总冰霜抗性</div>
<script>
fetch('/api/trade2/data/stats').then(r=>r.json()).then(d=>{document.getElementById('stats').textContent=d.result[0].label+' / '+d.result[1].entries[0].text;});
fetch('/api/trade2/fetch/abc').then(r=>r.json()).then(d=>{const it=d.result[0].item;document.getElementById('fetch').textContent=it.explicitMods[0].description;document.getElementById('item').textContent=it.name+' / '+it.typeLine;});
fetch('/api/trade2/data/items').then(r=>r.json()).then(d=>{document.getElementById('items').textContent=d.result[0].entries[0].text;});
fetch('/api/trade2/data/filters').then(r=>r.json()).then(d=>{const o=d.result[0].filters[0].option.options[0];document.getElementById('filters').textContent=o.id+'='+o.text;});
</script></div></body></html>`;

const stats={result:[
  {id:'pseudo',label:'Pseudo',entries:[]},
  {id:'explicit',label:'Explicit',entries:[{id:'pseudo.pseudo_total_cold_resistance',text:'+#% total to Cold Resistance',type:'pseudo'}]}
]};
const fetched={result:[{item:{
  name:"Adonia's Ego",typeLine:'Siphoning Wand',baseType:'Siphoning Wand',
  explicitMods:[{description:'+42% total to Cold Resistance',hash:'stat.pseudo.pseudo_total_cold_resistance',mods:[{magnitudes:[{min:1,max:60}]}]}]
}}]};
const items={result:[{id:'weapon',label:'Weapons',entries:[{type:'Siphoning Wand',text:"Adonia's Ego",name:"Adonia's Ego",flags:{unique:true}}]}]};
const filters={result:[{id:'status_filters',filters:[{id:'status',option:{options:[
  {id:'available',text:'Instant Buyout and In Person'},
  {id:'onlineleague',text:'In Person (Online in League)'},
  {id:'any',text:'Any'}
]}}]}]};

(async()=>{
  const list=await getJson('/json/list');
  const page=list.find(t=>t.type==='page'&&t.url==='about:blank')||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0;const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const mid=++id;pending.set(mid,{resolve,reject});ws.send(JSON.stringify({id:mid,method,params}));});
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);
    if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
    if(m.method==='Fetch.requestPaused'){
      const u=m.params.request.url;let body=null,type='application/json; charset=utf-8';
      if(u.includes('/trade2/search/')){body=pageHtml;type='text/html; charset=utf-8';}
      else if(u.includes('/api/trade2/data/stats'))body=JSON.stringify(stats);
      else if(u.includes('/api/trade2/data/items'))body=JSON.stringify(items);
      else if(u.includes('/api/trade2/data/filters'))body=JSON.stringify(filters);
      else if(u.includes('/api/trade2/fetch/'))body=JSON.stringify(fetched);
      const responseCode=body===null?404:200;if(body===null)body='not found';
      send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode,responseHeaders:[{name:'Content-Type',value:type}],body:Buffer.from(body).toString('base64')}).catch(()=>{});
    }
  };
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  await send('Page.enable');await send('Runtime.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await send('Page.navigate',{url});
  await new Promise(r=>setTimeout(r,6000));
  const r=await send('Runtime.evaluate',{expression:`JSON.stringify({
    href:location.href,title:document.title,body:document.body.innerText,
    stats:(document.getElementById('stats')||{}).textContent,
    fetch:(document.getElementById('fetch')||{}).textContent,
    item:(document.getElementById('item')||{}).textContent,
    items:(document.getElementById('items')||{}).textContent,
    filters:(document.getElementById('filters')||{}).textContent,
    marker:window.__POE_CN__||null})`,returnByValue:true});
  console.log(r.result.value);

  const ev=JSON.parse(r.result.value);
  const miss=['搜索','+#% 总冰霜抗性','+42% 总冰霜抗性','阿多尼娅的自我','立即购买或当面交易']
    .filter(s=>!String(ev.body||'').includes(s));
  const mk=ev.marker;
  if(!mk) miss.push('window.__POE_CN__ (数据脚本没加载)');
  else {
    if(mk.game!=='poe2') miss.push('marker.game='+mk.game);
    if(mk.lang!=='cn') miss.push('marker.lang='+mk.lang);
    if(!(mk.items>=4000)) miss.push('marker.items='+mk.items);
  }
  if(miss.length){console.error('FAIL PoE2 页面没有正确简体化，缺: '+miss.join(' | '));process.exit(1);}

  const hl=await send('Runtime.evaluate',{expression:`JSON.stringify((function(){
    const line=document.getElementById('hl');
    const spans=line?line.querySelectorAll('.poe-cn-num'):[];
    const style=document.getElementById('poe-cn-hl-style');
    return {count:spans.length,first:spans.length?spans[0].textContent:null,text:line?line.textContent:null,
      style:!!style,whole:document.querySelectorAll('.poe-cn-num').length};
  })())`,returnByValue:true});
  const hlv=JSON.parse(hl.result.value);
  if(!hlv.style||!hlv.count||hlv.first!=='+42%'||hlv.text!=='+42% 总冰霜抗性'){
    console.error('FAIL 数值高亮没有生效: '+hl.result.value);process.exit(1);
  }
  console.log('ok highlight: spans='+hlv.whole+' first='+hlv.first);

  const panel=await send('Runtime.evaluate',{expression:`JSON.stringify((function(){
    const host=document.getElementById('poe-cn-panel-host');
    const frame=document.getElementById('poe-cn-panel-frame');
    const toggle=document.getElementById('poe-cn-panel-toggle');
    if(!host||!frame||!toggle) return {found:false};
    const before=frame.style.display;
    toggle.click();
    const after=frame.style.display;
    toggle.click();
    return {found:true,src:frame.getAttribute('src'),width:frame.style.width,before:before,after:after,restored:frame.style.display};
  })())`,returnByValue:true});
  const pn=JSON.parse(panel.result.value);
  const targets=await getJson('/json/list');
  const panelTarget=targets.find(t=>t.type==='iframe'&&String(t.url).includes('panel/panel.html'));
  let panelText='';
  if(panelTarget){
    panelText=await new Promise((resolve,reject)=>{
      const w=new WebSocket(panelTarget.webSocketDebuggerUrl);
      const timer=setTimeout(()=>{try{w.close()}catch(e){}resolve('');},4000);
      w.onopen=()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'document.body.innerText',returnByValue:true}}));
      w.onerror=()=>{clearTimeout(timer);reject(new Error('panel target connect failed'));};
      w.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id===1){clearTimeout(timer);resolve(String((m.result&&m.result.result&&m.result.result.value)||''));w.close();}};
    });
  }
  const frameUrls=targets.map(t=>String(t.url));
  const panelMiss=[];
  if(!pn.found) panelMiss.push('宿主元素未注入');
  else {
    if(!String(pn.src||'').includes('panel/panel.html')) panelMiss.push('iframe src='+pn.src);
    if(pn.before!=='block') panelMiss.push('默认未展开: '+pn.before);
    if(pn.after!=='none') panelMiss.push('折叠无效: '+pn.after);
    if(pn.restored!=='block') panelMiss.push('再次展开无效: '+pn.restored);
  }
  if(!panelTarget) panelMiss.push('iframe 未真正加载: '+frameUrls.join(','));
  else {
    for(const want of ['市集助手','汇率','词缀','关于']) if(!panelText.includes(want)) panelMiss.push('面板缺文字: '+want);
  }
  if(panelMiss.length){console.error('FAIL 侧栏面板异常: '+panelMiss.join(' | '));process.exit(1);}
  console.error('ok   panel host: '+pn.width+' text='+panelText.replace(/\s+/g,' ').slice(0,80));
  console.error('ok   poe2/cn e2e: '+mk.lang+' stats='+mk.stats+' items='+mk.items);
  ws.close();
})().catch(e=>{console.error(e);process.exit(1);});
