#!/usr/bin/env node
/* lang.js bridges the popup's chrome.storage choice into page localStorage and
 * reloads once when the page already rendered the other language. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'lang.js'), 'utf8');

function run(stored, attr, guard) {
  const store = {};
  const session = {};
  if (guard) session['poe-cn-lang-applied'] = guard;
  const state = { reloads: 0 };
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    },
    sessionStorage: {
      getItem: (k) => (k in session ? session[k] : null),
      setItem: (k, v) => { session[k] = String(v); }
    },
    document: {
      documentElement: { getAttribute: (n) => (n === 'data-poe-cn-lang' ? attr : null) }
    },
    location: { reload: () => { state.reloads++; } },
    chrome: { storage: { local: { get: (defaults, cb) => cb({ lang: stored === undefined ? defaults.lang : stored }) } } }
  };
  vm.runInNewContext(SRC, ctx);
  return { store, session, reloads: state.reloads, lang: store['poe-cn-lang'] };
}

let n = 0;
function check(name, fn) {
  try { fn(); n++; console.log('ok   ' + name); }
  catch (e) { console.error('FAIL ' + name, e.message); process.exitCode = 1; }
}

check('first visit with 简体: stores cn, no reload', () => {
  const r = run('cn', null, null);
  assert.strictEqual(r.lang, 'cn');
  assert.strictEqual(r.reloads, 0);
});

check('missing storage entry defaults to cn', () => {
  const r = run(undefined, null, null);
  assert.strictEqual(r.lang, 'cn');
  assert.strictEqual(r.reloads, 0);
});

check('first visit with 繁體: stores tw, no reload (main.js reads storage later)', () => {
  const r = run('tw', null, null);
  assert.strictEqual(r.lang, 'tw');
  assert.strictEqual(r.reloads, 0);
  assert.strictEqual(r.session['poe-cn-lang-applied'], undefined);
});

check('switching to 繁體 reloads exactly once', () => {
  const r = run('tw', 'cn', null);
  assert.strictEqual(r.lang, 'tw');
  assert.strictEqual(r.reloads, 1);
  assert.strictEqual(r.session['poe-cn-lang-applied'], 'tw');
});

check('page already in 繁體 does not reload', () => {
  const r = run('tw', 'tw', null);
  assert.strictEqual(r.reloads, 0);
});

check('reload guard prevents a loop', () => {
  const r = run('tw', 'cn', 'tw');
  assert.strictEqual(r.reloads, 0);
});

check('unknown stored value falls back to cn', () => {
  const r = run('kr', null, null);
  assert.strictEqual(r.lang, 'cn');
  assert.strictEqual(r.reloads, 0);
});

check('storage disabled does not throw', () => {
  const ctx = {
    localStorage: { getItem: () => null, setItem: () => { throw new Error('denied'); } },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    document: { documentElement: { getAttribute: () => null } },
    location: { reload: () => {} },
    chrome: { storage: { local: { get: (d, cb) => cb({ lang: 'tw' }) } } }
  };
  vm.runInNewContext(SRC, ctx);
});

console.log(n + ' lang checks passed');
