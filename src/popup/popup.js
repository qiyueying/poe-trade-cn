'use strict';

const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reload');
const langBox = document.getElementById('langBox');
const langNote = document.getElementById('langNote');
const langButtons = Array.from(document.querySelectorAll('.segbtn'));
document.getElementById('version').textContent = chrome.runtime.getManifest().version;

const LANG_KEY = 'lang';

function activeTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve((tabs && tabs[0]) || null));
  });
}

function reloadTab(tab) {
  if (tab && tab.id) chrome.tabs.reload(tab.id);
}

function markLang(lang) {
  langButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === lang));
}

async function init() {
  const tab = await activeTab();
  const url = (tab && tab.url) || '';
  const isPoe2 = /^https:\/\/www\.pathofexile\.com\/trade2\//.test(url);
  const isPoe1 = /^https:\/\/www\.pathofexile\.com\/trade\//.test(url);

  if (isPoe2) {
    statusEl.textContent = '已连接 PoE 2 市集页面';
    statusEl.className = 'status ok';
    langBox.hidden = false;
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get({ lang: 'cn' }, (values) => resolve(values && values.lang === 'tw' ? 'tw' : 'cn'));
    });
    markLang(stored);
    langButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang === 'tw' ? 'tw' : 'cn';
        markLang(lang);
        chrome.storage.local.set({ [LANG_KEY]: lang }, () => reloadTab(tab));
      });
    });
  } else if (isPoe1) {
    statusEl.textContent = '已连接 PoE 1 市集页面';
    statusEl.className = 'status ok';
    langNote.hidden = false;
  } else {
    statusEl.textContent = '请先打开官方市集页面，再使用本扩展';
    statusEl.className = 'status warn';
  }
}

reloadBtn.addEventListener('click', async () => {
  reloadTab(await activeTab());
  window.close();
});

init();
