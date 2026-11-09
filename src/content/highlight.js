/* Number emphasis for trade result mods.
 * The trade site paints a mod line as one text node, so the only way to colour
 * the rolled value is to wrap it. Wrapping is deliberately conservative: only
 * short leaf text containing a percentage or a leading sign is touched, and the
 * pass is idempotent plus reversible (off = unwrap). */
(function (root) {
  'use strict';

  var NUM_SOURCE = '[+-]?(?:(?:\\d{1,3}(?:,\\d{3})+)|(?:\\d+(?:\\.\\d+)?)|(?:\\.\\d+))';
  var NUM = new RegExp(NUM_SOURCE + '(?:\\s*(?:-|\u2013|~|\u81f3)\\s*' + NUM_SOURCE + ')?%?', 'g');
  var CLS = 'poe-cn-num';
  var STYLE_ID = 'poe-cn-hl-style';
  var KEY = 'poe-cn-highlight';
  var SKIP_TAGS = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/;

  function segments(text) {
    var source = String(text || '');
    var out = [];
    var cursor = 0;
    var match;
    NUM.lastIndex = 0;
    while ((match = NUM.exec(source))) {
      var start = match.index;
      var value = match[0];
      var end = start + value.length;
      if (start > cursor) out.push({ text: source.slice(cursor, start), num: false });
      var glued = /[A-Za-z]/.test(source.charAt(start - 1)) || /[A-Za-z]/.test(source.charAt(end));
      out.push({ text: value, num: !glued && /\d/.test(value) });
      cursor = end;
    }
    if (cursor < source.length) out.push({ text: source.slice(cursor), num: false });
    return out.length ? out : [{ text: source, num: false }];
  }

  var api = { segments: segments, interesting: interesting, CLS: CLS };
  root.PoeTradeCnHighlight = api;
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  var enabled = true;
  var styled = false;
  var timer = 0;

  function injectStyle() {
    if (styled || !document.head) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.' + CLS + '{color:#e6b85c;font-weight:700}';
    document.head.appendChild(style);
    styled = true;
  }

  function interesting(text) {
    if (!text || text.length > 160) return false;
    if (text.indexOf('%') < 0 && !/^[+\-\u00b1]\s*\d/.test(text.trim())) return false;
    if (!/[A-Za-z\u4e00-\u9fff]/.test(text)) return false;
    var parts = segments(text);
    for (var i = 0; i < parts.length; i++) if (parts[i].num) return true;
    return false;
  }

  function acceptable(node) {
    var parent = node.parentNode;
    if (!parent || parent.nodeType !== 1) return false;
    if (SKIP_TAGS.test(parent.tagName)) return false;
    if (parent.classList && parent.classList.contains(CLS)) return false;
    if (parent.closest && parent.closest('#poe-cn-panel-host')) return false;
    if (parent.getAttribute && parent.getAttribute('data-poe-cn-hl') === '1') return false;
    return interesting(node.nodeValue);
  }

  function wrap(node) {
    var parts = segments(node.nodeValue);
    var fragment = document.createDocumentFragment();
    var wrapped = 0;
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i].num) {
        fragment.appendChild(document.createTextNode(parts[i].text));
        continue;
      }
      var span = document.createElement('span');
      span.className = CLS;
      span.textContent = parts[i].text;
      fragment.appendChild(span);
      wrapped++;
    }
    node.parentNode.replaceChild(fragment, node);
    return wrapped;
  }

  function scan(root) {
    if (!enabled || !root) return 0;
    var target = root.nodeType === 1 || root.nodeType === 9 ? root : root.parentNode;
    if (!target || !document.createTreeWalker) return 0;
    injectStyle();
    var walker = document.createTreeWalker(target, 4 /* SHOW_TEXT */, null);
    var pending = [];
    var node;
    while ((node = walker.nextNode())) if (acceptable(node)) pending.push(node);
    var total = 0;
    for (var i = 0; i < pending.length; i++) {
      var parent = pending[i].parentNode;
      if (!parent || !parent.getAttribute) continue;
      total += wrap(pending[i]);
      parent.setAttribute('data-poe-cn-hl', '1');
    }
    return total;
  }

  function unwrap() {
    var spans = document.querySelectorAll('.' + CLS);
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var text = document.createTextNode(span.textContent);
      if (span.parentNode) span.parentNode.replaceChild(text, span);
    }
    var marked = document.querySelectorAll('[data-poe-cn-hl]');
    for (var j = 0; j < marked.length; j++) marked[j].removeAttribute('data-poe-cn-hl');
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      scan(document.body);
    }, 200);
  }

  function apply(flag) {
    enabled = flag !== false;
    if (enabled) schedule();
    else unwrap();
  }

  try {
    chrome.storage.local.get({ 'poe-cn-highlight': true }, function (stored) {
      apply(stored[KEY]);
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[KEY]) apply(changes[KEY].newValue);
    });
  } catch (e) {
    apply(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
