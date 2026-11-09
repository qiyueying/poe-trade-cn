(function (root) {
  'use strict';

  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : null;
  }

  function computeRates(payload) {
    var lines = (payload && payload.lines) || [];
    var byId = {};
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] && lines[i].id) byId[lines[i].id] = lines[i];
    }
    var chaos = byId.chaos;
    var divine = byId.divine;
    var exalted = byId.exalted;
    var chaosValue = num(chaos && chaos.primaryValue);
    if (!chaosValue) return null;
    var divineValue = num(divine && divine.primaryValue);
    var exaltedValue = num(exalted && exalted.primaryValue);
    var chaosPerDivine = divineValue ? divineValue / chaosValue : null;
    var chaosPerExalted = exaltedValue ? exaltedValue / chaosValue : null;
    return {
      chaosPerDivine: chaosPerDivine,
      chaosPerExalted: chaosPerExalted,
      divinePerExalted: chaosPerDivine && chaosPerExalted ? chaosPerDivine / chaosPerExalted : null,
      benchmark: chaosValue === 1 ? 'chaos' : (divineValue === 1 ? 'divine' : '')
    };
  }

  function fmt(v) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 100) return v.toFixed(1).replace(/\.0$/, '');
    if (v >= 1) return v.toFixed(2).replace(/0$/, '');
    return v.toPrecision(3).replace(/0+$/, '');
  }

  root.PoeCnRates = { computeRates: computeRates, fmt: fmt };
})(typeof globalThis !== 'undefined' ? globalThis : this);
