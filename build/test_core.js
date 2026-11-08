#!/usr/bin/env node
'use strict';
// Exercises content/core.js against the three shipped payloads:
//   poe1 (繁體 only), poe2 简体, poe2 繁體
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist', 'poe-trade-cn');
const core = require(path.join(dist, 'content', 'core.js'));

function loadData(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dist, 'data', file), 'utf8'), ctx);
  return ctx.window;
}

const uiCn = loadData('ui.js').__POE_CN_UI__;
const uiTw = loadData('ui.tw.js').__POE_CN_UI_TW__;
const poe1 = loadData('poe1.js').__POE_CN_DATA__;
const poe2cn = loadData('poe2.js').__POE_CN_DATA__;
const poe2tw = loadData('poe2.tw.js').__POE_CN_DATA_TW__;

for (const [D, ui] of [[poe1, uiTw], [poe2cn, uiCn], [poe2tw, uiTw]]) {
  D.ui = Object.assign({}, ui.map, D.ui || {});
  D.patterns = ui.patterns;
}

const LANGS = [['poe1/tw', poe1], ['poe2/cn', poe2cn], ['poe2/tw', poe2tw]];
const CN_CHAR = /[\u4e00-\u9fff]/;
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log('ok  ', name);
  } catch (err) {
    failures++;
    console.error('FAIL', name, err.message);
  }
}

function rawStats(game) {
  return JSON.parse(fs.readFileSync(path.join(root, 'build/raw', game, 'en/stats.json'), 'utf8'));
}
function rawItems(game) {
  return JSON.parse(fs.readFileSync(path.join(root, 'build/raw', game, 'en/items.json'), 'utf8'));
}
function rawFilters(game) {
  return JSON.parse(fs.readFileSync(path.join(root, 'build/raw', game, 'en/filters.json'), 'utf8'));
}

for (const [label, D] of LANGS) {
  check(label + ': stats keep ids and turn Chinese', () => {
    const data = JSON.parse(JSON.stringify(rawStats(D.game)));
    core.translateStats(data, D);
    let checked = 0;
    let untranslated = 0;
    for (const group of data.result) {
      for (const entry of group.entries) {
        if (!entry.id) continue;
        assert.strictEqual(typeof entry.id, 'string');
        checked++;
        /* localized payloads omit some stats upstream; those stay English */
        if (!CN_CHAR.test(entry.text || '')) untranslated++;
      }
    }
    assert.ok(checked > 0, 'no stats at all');
    const ratio = untranslated / checked;
    assert.ok(ratio < 0.35, (ratio * 100).toFixed(1) + '% stats left in English');
  });

  check(label + ': item names and mods turn Chinese', () => {
    const data = JSON.parse(JSON.stringify(rawItems(D.game)));
    core.translateItems(data, D);
    let found = null;
    for (const group of data.result) {
      for (const entry of group.entries) {
        if (entry.name && entry.type) { found = entry; break; }
      }
      if (found) break;
    }
    assert.ok(found, 'no unique entry');
    assert.ok(CN_CHAR.test(found.text), 'no Chinese display text');
    assert.ok(found.name && found.type);
  });

  check(label + ': filters are Chinese', () => {
    const data = JSON.parse(JSON.stringify(rawFilters(D.game)));
    core.translateFilters(data, D);
    assert.ok(data.result.length >= 7);
    assert.ok(CN_CHAR.test(JSON.stringify(data.result)), 'filters not translated');
  });

  check(label + ': stat template renders magnitudes', () => {
    let sample = null;
    for (const group of rawStats(D.game).result) {
      for (const entry of group.entries) {
        if (!entry.text || entry.text.indexOf('#') < 0) continue;
        if (!CN_CHAR.test(D.stats[entry.id] || '')) continue;
        sample = entry;
        break;
      }
      if (sample) break;
    }
    assert.ok(sample, 'no stat template');
    const item = {
      explicitMods: [{
        description: sample.text.replace('#', '17'),
        hash: 'stat.' + sample.id,
        mods: [{ magnitudes: [{ min: 1, max: 20 }] }],
      }],
    };
    core.translateItem(item, D);
    const out = item.explicitMods[0].description;
    assert.ok(CN_CHAR.test(out), out);
    assert.ok(out.indexOf('17') >= 0, out);
    assert.ok(out.indexOf('1-20') < 0, out);
  });
}

check('poe1/tw: quality prefix on item type', () => {
  const out = core.translateItemText('Superior Coral Amulet', poe1);
  assert.ok(CN_CHAR.test(out), out);
  assert.notStrictEqual(out, 'Superior Coral Amulet');
});

check('poe2/cn: unique composite text', () => {
  const out = core.translateItemText("Adonia's Ego Siphoning Wand", poe2cn);
  assert.ok(CN_CHAR.test(out), out);
});

check('poe2/tw: unique composite text', () => {
  const out = core.translateItemText("Adonia's Ego Siphoning Wand", poe2tw);
  assert.ok(CN_CHAR.test(out), out);
});

check('result listing time follows the language', () => {
  assert.strictEqual(core.translateItemText('Listed 2 days ago', poe2cn), '上架于 2 天前');
  assert.strictEqual(core.translateItemText('Listed 2 days ago', poe2tw), '上架於 2 天前');
});

check('poe1/tw: less Duration stays a reduction', () => {
  const item = {
    explicitMods: [{
      description: '42% less Duration',
      hash: 'stat.explicit.stat_1506355899',
      mods: [{ magnitudes: [{ min: '-44', max: '-40' }] }],
    }],
  };
  core.translateItem(item, poe1);
  assert.strictEqual(item.explicitMods[0].description, '持續時間減少 42%');
  const more = {
    explicitMods: [{
      description: '42% more Duration',
      hash: 'stat.explicit.stat_1506355899',
      mods: [{ magnitudes: [{ min: '40', max: '44' }] }],
    }],
  };
  core.translateItem(more, poe1);
  /* the official 繁體 stat string already reads 「#% 更多持續時間」 */
  assert.strictEqual(more.explicitMods[0].description, '42% 更多持續時間');
});

check('poe1/tw: reduced keeps its direction', () => {
  const item = {
    explicitMods: [{
      description: '54% reduced Amount Recovered',
      hash: 'stat.explicit.stat_700317374',
      mods: [{ magnitudes: [{ min: '-55', max: '-52' }] }],
    }],
  };
  core.translateItem(item, poe1);
  /* 繁體 template reads 「增加 #% 恢復量」, which must flip to 減少, not 减少 */
  assert.strictEqual(item.explicitMods[0].description, '減少 54% 恢復量');
});

check('poe2/cn: polarity stays simplified', () => {
  const item = {
    explicitMods: [{
      description: '42% less Duration',
      hash: 'stat.explicit.stat_1506355899',
      mods: [{ magnitudes: [{ min: '-44', max: '-40' }] }],
    }],
  };
  core.translateItem(item, poe2cn);
  assert.strictEqual(item.explicitMods[0].description, '持续时间减少 42%');
});

function statusOptions(D) {
  const data = JSON.parse(JSON.stringify(rawFilters(D.game)));
  core.translateFilters(data, D);
  for (const group of data.result) {
    if (group.id !== 'status_filters') continue;
    for (const filter of group.filters) {
      if (filter.id === 'status') return ((filter.option || {}).options || []).map((o) => o.id + '=' + o.text);
    }
  }
  return [];
}

check('status filter options follow the language', () => {
  const cn = statusOptions(poe2cn).join(' ');
  const tw = statusOptions(poe2tw).join(' ');
  assert.ok(cn.indexOf('securable=立即购买') >= 0, cn);
  assert.ok(tw.indexOf('securable=立即購買') >= 0, tw);
  assert.ok(tw.indexOf('available=立即購買或當面交易') >= 0, tw);
});

console.log('data counts:', LANGS.map(([label, D]) => label + ' stats=' + Object.keys(D.stats).length +
  ' items=' + Object.keys(D.items).length).join(', '));

if (failures) {
  console.error(failures + ' check(s) failed');
  process.exit(1);
}
console.log('all core checks passed');
