// Convert the simplified UI dictionary into 繁體 with opencc (twp phrases).
//   node build/convert_ui.js   -> build/out/ui_tw.json
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const cn2t = require(path.join(dir, '..', 'tools', 'openccjs', 'cn2t.js'));
const toTW = cn2t.Converter({ from: 'cn', to: 'twp' });

const srcPath = path.join(dir, 'out', 'ui_cn.json');
const outPath = path.join(dir, 'out', 'ui_tw.json');
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
// entries opencc leaves in a mainland form
const FIXES = {
  'Account': '帳號',
};

const map = {};
let changed = 0;
for (const [k, v] of Object.entries(src.map || {})) {
  const tw = FIXES[k] || toTW(String(v));
  map[k] = tw;
  if (tw !== v) changed++;
}
// replacement halves need the same treatment; the left-hand regex stays ASCII
const patterns = (src.patterns || []).map(([re, out]) => [re, FIXES[out] || toTW(String(out))]);
fs.writeFileSync(outPath, JSON.stringify({ v: 1, lang: 'tw', map, patterns }, null, 0), 'utf8');
console.log('ui_tw:', Object.keys(map).length, 'entries,', changed, 'converted,', fs.statSync(outPath).size, 'bytes');
