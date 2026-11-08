// Validate the built payloads: coverage, untranslated residue, script purity,
// locale wording, UI maps and filter completeness.
//   node build/check_data.js
// Exit code 0 = our own guarantees hold; upstream gaps are reported as WARN.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dir = __dirname;
const root = path.join(dir, '..');
const distData = path.join(root, 'dist', 'poe-trade-cn', 'data');

const problems = [];
const warns = [];
const notes = [];

function load(file) {
  const sandbox = { window: {} };
  const code = fs.readFileSync(path.join(distData, file), 'utf8');
  vm.runInNewContext(code, sandbox, { timeout: 30000 });
  return sandbox.window;
}

function raw(game, lang, kind) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'raw', game, lang, kind + '.json'), 'utf8'));
}
function entryMap(payload) {
  const map = {};
  for (const group of payload.result || []) for (const e of group.entries || []) map[e.id] = e;
  return map;
}

const hasCjk = (s) => /[\u4e00-\u9fff]/.test(s);
const isLatin = (s) => /^[A-Za-z0-9 '\-&.,()%+:]*$/.test(s) && /[A-Za-z]/.test(s);

const poe1 = load('poe1.js').__POE_CN_DATA__;
const poe2cn = load('poe2.js').__POE_CN_DATA__;
const poe2tw = load('poe2.tw.js').__POE_CN_DATA_TW__;
const uiCn = load('ui.js').__POE_CN_UI__;
const uiTw = load('ui.tw.js').__POE_CN_UI_TW__;

// ---- 1. identity --------------------------------------------------------
function identity(label, payload, game, lang) {
  if (payload.game !== game) problems.push(label + ': game=' + payload.game);
  if (payload.lang !== lang) problems.push(label + ': lang=' + payload.lang);
  if (!payload.version) problems.push(label + ': missing version');
  notes.push(label + ': v' + payload.version + ' game=' + payload.game + ' lang=' + payload.lang);
}
identity('poe1', poe1, 'poe1', 'tw');
identity('poe2(cn)', poe2cn, 'poe2', 'cn');
identity('poe2(tw)', poe2tw, 'poe2', 'tw');
if (poe2cn.version !== poe2tw.version) problems.push('poe2: cn/tw payload versions differ');

// ---- 2. coverage and English fallback -----------------------------------
function coverage(label, payload, game, locLang, limit) {
  const en = entryMap(raw(game, 'en', 'stats'));
  const loc = entryMap(raw(game, locLang, 'stats'));
  let latin = 0;
  const samples = [];
  for (const [id, text] of Object.entries(payload.stats)) {
    if (!isLatin(text)) continue;
    latin++;
    if (samples.length < 3) samples.push(id + ' => ' + text);
  }
  const total = Object.keys(payload.stats).length;
  const pct = total ? (latin / total) * 100 : 0;
  const upstream = Object.keys(en).filter((id) => !(id in loc)).length;
  notes.push(label + ': stats ' + total + ' / EN ' + Object.keys(en).length +
    ', English fallback ' + latin + ' (' + pct.toFixed(2) + '%), upstream missing ' + upstream);
  if (latin && samples.length) notes.push('   e.g. ' + samples.join(' | '));
  if (total < Object.keys(en).length - upstream - 5) {
    problems.push(label + ': stats ' + total + ' do not match EN minus upstream gaps');
  }
  const nameLatin = Object.values(payload.names).filter(isLatin).length;
  if (nameLatin) problems.push(label + ': ' + nameLatin + ' item names left in English');
  if (pct > limit) warns.push(label + ': ' + pct.toFixed(2) + '% stat options stay English (upstream gap, exceeds ' + limit + '%)');
}

coverage('poe1(tw)', poe1, 'poe1', 'tw', 2);
coverage('poe2(cn)', poe2cn, 'poe2', 'cn', 10);
coverage('poe2(tw)', poe2tw, 'poe2', 'tw', 30);

// ---- 3. script purity ---------------------------------------------------
// opencc normalizes variant glyphs (祕→秘, 里→裡), so conversion is not a purity
// test.  Instead scan for simplified/traditional-only characters that never
// appear in the other script.
const SIMPLIFIED = [...'们这说时伤击护过还给与统计电闪术单双变强转换杀战类项饰灵级动对应该现实际开关间显图标记认让词缀层数长门问队险验试觉观见规则条线组续终结经编语读写运进远连选递释钢铁银铜锁阵阳阴隐难装备获'];
const TRADITIONAL = [...'們這說時傷擊護過還給與統計電閃術單雙變強轉換殺戰類項飾靈級動對應該現實際開關間顯圖標記認讓詞綴層數長門問隊險驗試覺觀見規則條線組續終結經編語讀寫運進遠連選遞釋鋼鐵銀銅鎖陣陽陰隱難裝備獲'];

function purity(label, payload, badChars) {
  const set = new Set(badChars);
  const hits = new Map();
  const samples = [];
  for (const kind of ['stats', 'names', 'items']) {
    for (const [id, value] of Object.entries(payload[kind] || {})) {
      let found = '';
      for (const ch of value) if (set.has(ch)) found += ch;
      if (!found) continue;
      for (const ch of found) hits.set(ch, (hits.get(ch) || 0) + 1);
      if (samples.length < 4) samples.push(kind + ' ' + id + ' [' + found + '] ' + value.slice(0, 40));
    }
  }
  const count = [...hits.values()].reduce((a, b) => a + b, 0);
  notes.push(label + ': wrong-script characters ' + count +
    (hits.size ? ' [' + [...hits.keys()].join('') + ']' : ''));
  if (count) {
    notes.push('   e.g. ' + samples.join(' | '));
    problems.push(label + ': ' + count + ' characters in the wrong script');
  }
}
purity('poe2(cn)', poe2cn, TRADITIONAL);
purity('poe2(tw)', poe2tw, SIMPLIFIED);
purity('poe1(tw)', poe1, SIMPLIFIED);

// ---- 4. locale wording by stat id --------------------------------------
const COLD = 'pseudo.pseudo_total_cold_resistance';
function coldOf(label, payload, expect) {
  const text = payload.stats[COLD] || '';
  notes.push(label + ' ' + COLD + ': ' + (text || 'MISSING'));
  if (!text.includes(expect)) problems.push(label + ': cold resistance should read ' + expect + ', got ' + text);
}
coldOf('poe1(tw)', poe1, '冰冷');
coldOf('poe2(tw)', poe2tw, '冰冷');
coldOf('poe2(cn)', poe2cn, '冰霜');

// ---- 5. UI maps ---------------------------------------------------------
for (const [label, ui] of [['ui(cn)', uiCn], ['ui(tw)', uiTw]]) {
  const n = Object.keys((ui && ui.map) || {}).length;
  notes.push(label + ': ' + n + ' entries, ' + ((ui && ui.patterns) || []).length + ' patterns');
  if (n < 1500) problems.push(label + ': only ' + n + ' entries');
}
if (uiCn && uiTw) {
  const missing = Object.keys(uiCn.map || {}).filter((k) => !uiTw.map || !(k in uiTw.map));
  if (missing.length) problems.push('ui(tw): missing ' + missing.length + ' keys, e.g. ' + missing.slice(0, 3).join(','));
}

// ---- 6. filters and static ---------------------------------------------
for (const [label, payload] of [['poe1(tw)', poe1], ['poe2(cn)', poe2cn], ['poe2(tw)', poe2tw]]) {
  const groups = payload.filters || [];
  let options = 0;
  for (const group of groups) for (const f of group.filters || []) {
    options += ((f.option || {}).options || []).length;
  }
  const ids = groups.map((g) => g.id);
  notes.push(label + ': filters ' + groups.length + ' groups / ' + options + ' options [' + ids.join(',') + ']' +
    ', staticText ' + Object.keys(payload.staticText || {}).length +
    ', types ' + Object.keys(payload.types || {}).length +
    ', uniques ' + Object.keys(payload.names || {}).length);
  if (!groups.length) problems.push(label + ': no filters');
  if (!options) problems.push(label + ': filters carry no options');
  if (ids.indexOf('status_filters') < 0) problems.push(label + ': status_filters missing');
  if (ids.indexOf('trade_filters') < 0) problems.push(label + ': trade_filters missing');
  const statusGroup = groups.filter((g) => g.id === 'status_filters')[0] || {};
  const statusOptions = ((((statusGroup.filters || [])[0] || {}).option || {}).options) || [];
  const statusText = statusOptions.map((o) => o.text).join(' / ');
  notes.push('   status wording: ' + (statusText || 'none'));
  if (!hasCjk(statusText)) problems.push(label + ': status filter options are not localized');
  if (payload.lang === 'tw' && /[购买当]/.test(statusText)) problems.push(label + ': simplified wording in status options');
  if (payload.lang === 'cn' && /[購買當]/.test(statusText)) problems.push(label + ': traditional wording in status options');
}

// ---- 7. poedb sample ----------------------------------------------------
const maps = JSON.parse(fs.readFileSync(path.join(dir, 'out', 'poedb_maps.json'), 'utf8'));
function poedbSample(label, mine) {
  const entries = Object.entries(mine || {}).filter(([k, v]) => v && /^[A-Za-z]/.test(k));
  notes.push(label + ': poedb ' + entries.length + ' names, e.g. ' +
    entries.slice(0, 4).map(([k, v]) => k + '=' + v).join(', '));
}
poedbSample('poe1.tw', maps.poe1 && maps.poe1.tw);
poedbSample('poe2.tw', maps.poe2 && maps.poe2.tw);
poedbSample('poe2.cn', maps.poe2 && maps.poe2.cn);

// ---- report -------------------------------------------------------------
console.log(notes.join('\n'));
if (warns.length) {
  console.log('\nWARN (' + warns.length + ')');
  for (const w of warns) console.log(' - ' + w);
}
if (problems.length) {
  console.error('\nFAIL (' + problems.length + ')');
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('\nOK: payload identity, script purity, locale wording, UI maps and filters hold');