/* MAIN-world page hook: translate trade API JSON before the site renders it,
 * then catch the remaining UI strings in the DOM. */
(function () {
  'use strict';

  /* Language choice: PoE 2 ships 简体 + 繁體 payloads and the popup stores the
   * choice in localStorage via content/lang.js; PoE 1 ships 繁體 only. */
  var LANG_KEY = 'poe-cn-lang';
  var stored = '';
  try { stored = localStorage.getItem(LANG_KEY) || ''; } catch (e) { stored = ''; }

  var D = (stored === 'tw' && window.__POE_CN_DATA_TW__)
    ? window.__POE_CN_DATA_TW__
    : window.__POE_CN_DATA__;
  if (!D || window.__POE_CN_ACTIVE__) return;
  window.__POE_CN_ACTIVE__ = true;

  var C = window.PoeCnCore;
  if (!C) return;

  var lang = D.lang || 'cn';
  var U = lang === 'tw'
    ? (window.__POE_CN_UI_TW__ || window.__POE_CN_UI__)
    : window.__POE_CN_UI__;
  D.lang = lang;
  if (document.documentElement) {
    document.documentElement.setAttribute('data-poe-cn-lang', lang);
  }

  D.ui = Object.assign({}, (U && U.map) || {}, D.ui || {});
  D.patterns = (U && U.patterns) || D.patterns || [];
  D.itemNorms = D.itemNorms || {};

  function pathOf(url) {
    try { return new URL(String(url || ''), location.href).pathname; }
    catch (e) { return ''; }
  }

  function kindOf(url) {
    var path = pathOf(url);
    var m = path.match(/\/api\/trade2?\/data\/(stats|items|static|filters)(?:[\/?]|$)/);
    if (m) return m[1];
    if (/\/api\/trade2?\/fetch(?:\/|$)/.test(path)) return 'fetch';
    return '';
  }

  function patchJson(data, kind) {
    if (kind === 'stats') return C.translateStats(data, D);
    if (kind === 'items') return C.translateItems(data, D);
    if (kind === 'static') return C.translateStatic(data, D);
    if (kind === 'filters') return C.translateFilters(data, D);
    if (kind === 'fetch') return C.translateFetch(data, D);
    return data;
  }

  /* The trade site stores its API payloads in lscache.  A stale English copy
   * would win over our translated network response, so drop those keys once
   * per data version. */
  try {
    var cacheKey = 'poe-cn-cache-version';
    var cacheToken = String(D.version) + ':' + lang;
    if (localStorage.getItem(cacheKey) !== cacheToken) {
      Object.keys(localStorage).forEach(function (key) {
        if (key.indexOf('lscache-trade') === 0) localStorage.removeItem(key);
      });
      localStorage.setItem(cacheKey, cacheToken);
    }
  } catch (e) { /* private mode / storage disabled */ }

  /* fetch hook */
  var nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var kind = kindOf(url);
      var promise = nativeFetch.apply(this, arguments);
      if (!kind) return promise;
      return promise.then(function (response) {
        if (!response || !response.ok) return response;
        var contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('json') === -1) return response;
        return response.clone().json().then(function (data) {
          patchJson(data, kind);
          var headers = new Headers();
          headers.set('content-type', 'application/json; charset=utf-8');
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: headers
          });
        }).catch(function () { return response; });
      });
    };
  }

  /* XHR hook: the trade site has used both transports over its lifetime. */
  try {
    var nativeOpen = XMLHttpRequest.prototype.open;
    var nativeSend = XMLHttpRequest.prototype.send;

    function patchXhr(xhr) {
      if (!xhr || xhr.__poeCnPatched) return;
      var kind = kindOf(xhr.__poeCnUrl);
      if (!kind) return;
      try {
        var isJson = xhr.responseType === 'json';
        var data = isJson ? xhr.response : JSON.parse(xhr.responseText);
        patchJson(data, kind);
        var text = JSON.stringify(data);
        Object.defineProperty(xhr, 'responseText', { configurable: true, get: function () { return text; } });
        if (isJson) {
          Object.defineProperty(xhr, 'response', { configurable: true, get: function () { return data; } });
        }
        xhr.__poeCnPatched = true;
      } catch (e) { /* let the page keep its original response */ }
    }

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__poeCnUrl = url;
      return nativeOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      /* jQuery-style onreadystatechange and plain onload must see Chinese
       * before the page's own callback runs, so wrap both here. */
      var ready = xhr.onreadystatechange;
      if (typeof ready === 'function') {
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) patchXhr(xhr);
          return ready.apply(this, arguments);
        };
      }
      var load = xhr.onload;
      if (typeof load === 'function') {
        xhr.onload = function () {
          patchXhr(xhr);
          return load.apply(this, arguments);
        };
      }
      var loadend = xhr.onloadend;
      if (typeof loadend === 'function') {
        xhr.onloadend = function () {
          patchXhr(xhr);
          return loadend.apply(this, arguments);
        };
      }
      xhr.addEventListener('load', function () { patchXhr(xhr); });
      return nativeSend.apply(this, arguments);
    };
  } catch (e) { /* very old browser */ }

  /* DOM translation */
  var SKIP = 'script,style,noscript,textarea,input,code,pre,[contenteditable="true"],[data-poe-cn-skip]';
  var scheduled = false;

  function isSkipped(node) {
    var parent = node.parentElement;
    if (!parent) return true;
    try { return !!parent.closest(SKIP); } catch (e) { return true; }
  }

  function translateTextNode(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var text = raw.trim();
    if (!text || text.length > 200) return;
    if (!/[A-Za-z]/.test(text)) return;
    var out = C.translateItemText(text, D);
    if (out && out !== text) {
      node.nodeValue = raw.replace(text, out);
    }
  }

  function translateAttribute(element) {
    var attrs = ['placeholder', 'title', 'aria-label'];
    for (var i = 0; i < attrs.length; i++) {
      var value = element.getAttribute(attrs[i]);
      if (!value || value.length > 160 || !/[A-Za-z]/.test(value)) continue;
      var out = C.translateItemText(value, D);
      if (out && out !== value) element.setAttribute(attrs[i], out);
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      if (!isSkipped(root)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) translateAttribute(root);

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return isSkipped(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) translateTextNode(node);

    if (root.querySelectorAll) {
      var elements = root.querySelectorAll('[placeholder],[title],[aria-label]');
      for (var i = 0; i < elements.length; i++) translateAttribute(elements[i]);
    }
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      scan(document.body || document.documentElement);
      if (document.title) {
        var title = C.translateItemText(document.title, D);
        if (title && title !== document.title) document.title = title;
      }
    }, 50);
  }

  if (document.documentElement) {
    new MutationObserver(scheduleScan).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  document.addEventListener('DOMContentLoaded', scheduleScan);
  scheduleScan();

  window.__POE_CN__ = {
    version: D.version,
    game: D.game,
    lang: lang,
    stats: Object.keys(D.stats || {}).length,
    items: Object.keys(D.items || {}).length,
    translateItemText: function (s) { return C.translateItemText(s, D); }
  };

  try {
    console.info('[PoE CN] active', D.game, lang, D.version, window.__POE_CN__.stats, 'stats,', window.__POE_CN__.items, 'items');
  } catch (e) { /* ignore */ }
})();