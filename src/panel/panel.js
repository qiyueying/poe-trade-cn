(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var game = params.get('game') === 'poe2' ? 'poe2' : 'poe1';
  var leagueInput = document.getElementById('league');
  var status = document.getElementById('rateStatus');
  var button = document.getElementById('refresh');
  var CACHE_TTL = 15 * 60 * 1000;

  leagueInput.value = params.get('league') || 'Standard';
  document.getElementById('realm').textContent =
    (game === 'poe2' ? 'PoE 2' : 'PoE 1') + ' · 国际服';
  document.getElementById('version').textContent =
    (chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '—');

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
        t.classList.toggle('on', t === tab);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.pane'), function (p) {
        p.classList.toggle('on', p.getAttribute('data-pane') === tab.getAttribute('data-tab'));
      });
    });
  });

  var hlToggle = document.getElementById('hlToggle');
  chrome.storage.local.get({ 'poe-cn-highlight': true }, function (stored) {
    hlToggle.checked = stored['poe-cn-highlight'] !== false;
  });
  hlToggle.addEventListener('change', function () {
    chrome.storage.local.set({ 'poe-cn-highlight': hlToggle.checked });
  });

  function cacheKey() { return 'poe-cn-rates:' + game + ':' + leagueInput.value.trim(); }

  function render(rates, when) {
    var R = window.PoeCnRates;
    document.getElementById('d2c').textContent = R.fmt(rates.chaosPerDivine);
    document.getElementById('e2c').textContent = R.fmt(rates.chaosPerExalted);
    document.getElementById('d2e').textContent = R.fmt(rates.divinePerExalted);
    status.textContent = '更新于 ' + new Date(when).toLocaleString();
  }

  function fail(text) {
    status.textContent = text;
  }

  function load(cached) {
    var league = leagueInput.value.trim();
    if (!league) { fail('请填写赛季名'); return; }
    button.disabled = true;
    fetch('https://poe.ninja/' + game + '/api/economy/exchange/current/overview?league=' +
      encodeURIComponent(league) + '&type=Currency')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        var rates = window.PoeCnRates.computeRates(payload);
        if (!rates) throw new Error('该赛季没有混沌石报价，请确认赛季名');
        var now = Date.now();
        var store = {};
        store[cacheKey()] = { rates: rates, at: now };
        chrome.storage.local.set(store);
        render(rates, now);
      })
      .catch(function (err) {
        fail('获取失败：' + err.message + (err.message.indexOf('赛季') >= 0 ? '' : '（国际服限定，可检查网络或稍后重试）'));
      })
      .then(function () { button.disabled = false; });
  }

  button.addEventListener('click', function () { load(false); });

  chrome.storage.local.get([cacheKey()], function (got) {
    var hit = got[cacheKey()];
    if (hit && hit.rates && Date.now() - hit.at < CACHE_TTL) {
      render(hit.rates, hit.at);
      return;
    }
    if (hit && hit.rates) render(hit.rates, hit.at);
  });
})();
