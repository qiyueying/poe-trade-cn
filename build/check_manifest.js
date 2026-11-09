#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const DIST = path.join(ROOT, 'dist', 'poe-trade-cn');
const SRC = path.join(ROOT, 'src');

let failed = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
}

function readManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
}

const srcManifest = readManifest(SRC);
const distManifest = readManifest(DIST);

check('src and dist manifest agree', JSON.stringify(srcManifest) === JSON.stringify(distManifest));

function exists(rel) { return fs.existsSync(path.join(DIST, rel)); }

const scripts = [];
for (const entry of distManifest.content_scripts || []) {
  for (const rel of entry.js || []) scripts.push(rel);
}
const badScripts = scripts.filter((rel) => !exists(rel));
check('every content script exists in dist', badScripts.length === 0, badScripts.join(', '));
check('panel host is registered', scripts.includes('panel/host.js'));

const warPattern = new RegExp('^(https?|\\*)://[^/]+/\\*$');
const war = [];
for (const entry of distManifest.web_accessible_resources || []) {
  const matches = entry.matches || [];
  const bad = matches.filter((p) => !warPattern.test(p) || !p.endsWith('/*'));
  check('war match patterns are valid', bad.length === 0, bad.join(', '));
  for (const rel of entry.resources || []) war.push(rel);
}
const badWar = war.filter((rel) => !exists(rel));
check('every war resource exists in dist', badWar.length === 0, badWar.join(', '));
check('panel page is web accessible', war.includes('panel/panel.html'));

const popup = (distManifest.action || {}).default_popup;
check('popup page exists', !!popup && exists(popup), String(popup));

const icons = Object.values(distManifest.icons || {});
check('every icon exists', icons.every((rel) => exists(rel)), icons.join(', '));

check('host permission covers poe.ninja', (distManifest.host_permissions || []).some((p) => p.includes('poe.ninja')));

console.log(failed ? 'FAILED ' + failed : 'manifest checks passed');
process.exit(failed ? 1 : 0);
