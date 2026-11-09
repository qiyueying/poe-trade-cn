#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const source = fs.readFileSync(path.join(ROOT, 'src/panel/rates.js'), 'utf8');
new Function('globalThis', source)(globalThis);
const { computeRates, fmt } = globalThis.PoeCnRates;

let failed = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? ' :: ' + detail : ''));
}
function near(a, b, tol) { return typeof a === 'number' && Math.abs(a - b) <= tol; }

// Fixtures mirror the live poe.ninja payloads probed on 2026-11-09.
const poe1 = { lines: [
  { id: 'chaos', primaryValue: 1 },
  { id: 'divine', primaryValue: 624.3 },
  { id: 'exalted', primaryValue: 8.28 }
] };
const poe2 = { lines: [
  { id: 'divine', primaryValue: 1 },
  { id: 'chaos', primaryValue: 0.5562 },
  { id: 'exalted', primaryValue: 0.004609 }
] };

const r1 = computeRates(poe1);
check('poe1 chaos benchmark', r1 && r1.benchmark === 'chaos', JSON.stringify(r1));
check('poe1 D/C = 624.3', near(r1.chaosPerDivine, 624.3, 0.01), String(r1.chaosPerDivine));
check('poe1 E/C = 8.28', near(r1.chaosPerExalted, 8.28, 0.01), String(r1.chaosPerExalted));
check('poe1 D/E = 75.4', near(r1.divinePerExalted, 624.3 / 8.28, 0.05), String(r1.divinePerExalted));

const r2 = computeRates(poe2);
check('poe2 divine benchmark', r2 && r2.benchmark === 'divine', JSON.stringify(r2));
check('poe2 D/C = 1.798', near(r2.chaosPerDivine, 1 / 0.5562, 0.01), String(r2.chaosPerDivine));
check('poe2 E/C = 0.00829', near(r2.chaosPerExalted, 0.004609 / 0.5562, 1e-5), String(r2.chaosPerExalted));

check('missing chaos -> null', computeRates({ lines: [{ id: 'divine', primaryValue: 1 }] }) === null);
check('empty payload -> null', computeRates(null) === null);
check('partial payload keeps nulls', (() => {
  const r = computeRates({ lines: [{ id: 'chaos', primaryValue: 1 }] });
  return r && r.chaosPerDivine === null && r.divinePerExalted === null;
})(), '');

check('fmt 624.3 -> 624', fmt(624.3) === '624.3', fmt(624.3));
check('fmt 8.28 -> 8.28', fmt(8.28) === '8.28', fmt(8.28));
check('fmt null -> dash', fmt(null) === '—', fmt(null));

console.log(failed ? 'FAILED ' + failed : 'rates checks passed');
process.exit(failed ? 1 : 0);
