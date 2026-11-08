// Convert merged Chinese source values into simplified / traditional dictionaries.
//   node build/convert.js [srcJson] [outJs] [outTwJson] [globalName]
// 默认（PoE1）：build/out/merged_src.json -> extension/data/dict.js + dict.tw.json
// PoE2：build/out/merged_src_p2.json -> extension/data/dict.poe2.js + dict.poe2.tw.json
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const t2cn = require(path.join(dir, '..', 'tools', 'openccjs', 't2cn.js'));
const cn2t = require(path.join(dir, '..', 'tools', 'openccjs', 'cn2t.js'));

const toCN = t2cn.Converter({ from: 'tw', to: 'cn' });
const toTW = cn2t.Converter({ from: 'cn', to: 'twp' });

const srcPath = process.argv[2] || path.join(dir, 'out', 'merged_src.json');
const jsOut = process.argv[3] || path.join(dir, '..', 'extension', 'data', 'dict.js');
const twOut = process.argv[4] || path.join(dir, '..', 'extension', 'data', 'dict.tw.json');
const globalName = process.argv[5] || 'FBZH_DICT';

const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const cn = {};
const tw = {};
let sameAsKey = 0;
for (const [k, v] of Object.entries(src)) {
  const c = toCN(v);
  const t = toTW(c);
  if (c === k && t === k) { sameAsKey++; continue; }
  cn[k] = c;
  tw[k] = t;
}
fs.mkdirSync(path.dirname(jsOut), { recursive: true });
const js = '/* FilterBlade 汉化词典（简体）—— 由 build/convert.js 生成，请勿手改 */\n' +
  'self.' + globalName + '=' + JSON.stringify({ v: 1, cn }) + ';\n';
fs.writeFileSync(jsOut, js, 'utf8');
fs.writeFileSync(twOut, JSON.stringify(tw), 'utf8');
console.log('src', path.basename(srcPath), '->', path.basename(jsOut),
  '| entries', Object.keys(cn).length, '| dropped(same)', sameAsKey,
  '| cn bytes', Buffer.byteLength(js), '| tw bytes', fs.statSync(twOut).size);
