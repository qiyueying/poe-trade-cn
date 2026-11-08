/* ISOLATED-world bridge: chrome.storage (popup) -> page localStorage, so the
 * MAIN-world hook can pick 简体 or 繁體 before the trade site renders.  If the
 * page already started with the other language, reload it once. */
(function () {
  'use strict';
  var KEY = 'poe-cn-lang';
  var GUARD = 'poe-cn-lang-applied';

  function apply(stored) {
    var lang = stored === 'tw' ? 'tw' : 'cn';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage disabled */ }
    var el = document.documentElement;
    var applied = el && el.getAttribute('data-poe-cn-lang');
    if (!applied || applied === lang) return;
    try {
      if (sessionStorage.getItem(GUARD) === lang) return;
      sessionStorage.setItem(GUARD, lang);
    } catch (e) { return; }
    location.reload();
  }

  try {
    chrome.storage.local.get({ lang: 'cn' }, function (values) {
      apply(values && values.lang);
    });
  } catch (e) { /* extension context lost (reload) */ }
})();
