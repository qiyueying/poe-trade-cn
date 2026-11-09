(function () {
  'use strict';
  var HOST_ID = 'poe-cn-panel-host';
  var OPEN_KEY = 'poe-cn-panel-open';
  var PANEL_WIDTH = 380;
  var POLL_MS = 250;
  var POLL_MAX = 60;

  if (document.getElementById(HOST_ID)) return;

  function game() {
    return location.pathname.indexOf('/trade2/') === 0 ? 'poe2' : 'poe1';
  }

  function league() {
    var m = location.pathname.match(/^\/trade2?\/search\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function mount() {
    if (document.getElementById(HOST_ID)) return;
    if (!document.querySelector('#trade')) return;

    var el = document.createElement('div');
    el.id = HOST_ID;
    el.setAttribute('data-game', game());
    el.style.cssText = [
      'position:fixed', 'top:0', 'right:0', 'height:100vh',
      'display:flex', 'align-items:stretch', 'z-index:2147483000',
      'font:13px/1.5 "Microsoft YaHei","Noto Sans SC",system-ui,sans-serif',
      'pointer-events:auto'
    ].join(';');

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'poe-cn-panel-toggle';
    toggle.title = '展开 / 收起市集助手';
    toggle.textContent = '市集';
    toggle.style.cssText = [
      'width:24px', 'padding:0', 'border:1px solid #3a2d20', 'border-right:0',
      'border-radius:6px 0 0 6px', 'background:#17130f', 'color:#c8a45c',
      'cursor:pointer', 'writing-mode:vertical-rl', 'letter-spacing:.35em',
      'font-size:12px', 'align-self:center', 'height:96px'
    ].join(';');

    var frame = document.createElement('iframe');
    frame.id = 'poe-cn-panel-frame';
    frame.setAttribute('allowtransparency', 'true');
    frame.style.cssText = [
      'width:' + PANEL_WIDTH + 'px', 'height:100%', 'border:0',
      'border-left:1px solid #3a2d20', 'background:#0d0b09',
      'box-shadow:-8px 0 24px rgba(0,0,0,.45)'
    ].join(';');
    frame.src = chrome.runtime.getURL('panel/panel.html') +
      '?game=' + game() + '&league=' + encodeURIComponent(league());

    el.appendChild(toggle);
    el.appendChild(frame);
    (document.body || document.documentElement).appendChild(el);

    var isOpen = true;
    function apply(open) {
      isOpen = open;
      frame.style.display = open ? 'block' : 'none';
      toggle.style.borderRight = open ? '0' : '1px solid #3a2d20';
      toggle.style.borderRadius = open ? '6px 0 0 6px' : '6px';
      chrome.storage.local.set({ [OPEN_KEY]: open });
    }
    toggle.addEventListener('click', function () { apply(!isOpen); });
    chrome.storage.local.get({ [OPEN_KEY]: true }, function (got) {
      apply(got[OPEN_KEY] !== false);
    });
  }

  var tries = 0;
  (function poll() {
    if (document.querySelector('#trade')) { mount(); return; }
    if (++tries > POLL_MAX) return;
    setTimeout(poll, POLL_MS);
  })();
})();
