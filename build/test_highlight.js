#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'highlight.js'), 'utf8');
const ctx = {};
vm.runInNewContext(src, ctx, { filename: 'highlight.js' });
const H = ctx.PoeTradeCnHighlight;
let pass = 0;
function check(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' :: ' + extra : ''));
    process.exit(1);
  }
  pass++;
}
function nums(text) {
  return H.segments(text).filter((s) => s.num).map((s) => s.text);
}

check('api', H && typeof H.segments === 'function');
check('cn mod', JSON.stringify(nums('+42% 总冰霜抗性')) === JSON.stringify(['+42%']), JSON.stringify(nums('+42% 总冰霜抗性')));
check('tw mod', JSON.stringify(nums('+42% 冰冷抗性')) === JSON.stringify(['+42%']));
check('no percent roll', JSON.stringify(nums('增加 30 最大生命')) === JSON.stringify(['30']));
check('range', JSON.stringify(nums('+(20-30)% 火焰伤害')) === JSON.stringify(['20-30']), JSON.stringify(nums('+(20-30)% 火焰伤害')));
check('decimal', JSON.stringify(nums('1.8% 每秒再生')) === JSON.stringify(['1.8%']));
check('identifier skip', JSON.stringify(nums('每秒 1.5m 范围')) === JSON.stringify([]), JSON.stringify(nums('每秒 1.5m 范围')));
check('gate percent', H.interesting('+42% 冰冷抗性') === true);
check('gate signed', H.interesting('+42 冰冷抗性') === true);
check('gate price excluded', H.interesting('1.8 混沌石') === false);
check('gate long text excluded', H.interesting('x'.repeat(200) + ' 42%') === false);
check('gate pure number excluded', H.interesting('42%') === false);

console.log(pass + ' highlight checks passed');
