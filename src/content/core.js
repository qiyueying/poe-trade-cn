/* Pure translation helpers shared by the page hook and the Node tests.
 * No DOM access here: everything takes plain API JSON plus the generated
 * dictionary object. */
(function (global) {
  'use strict';

  var CN_RE = /[\u3400-\u9fff]/;
  var MOD_KEYS = [
    'explicitMods', 'implicitMods', 'craftedMods', 'fracturedMods',
    'enchantMods', 'scourgeMods', 'veiledMods', 'utilityMods',
    'crucibleMods', 'sanctumMods'
  ];
  var PREFIXES = [
    ['Superior ', '精良的'],
    ['Synthesised ', '合成的'],
    ['Fractured ', '破碎的'],
    ['Blighted ', '枯萎的'],
    ['Anomalous ', '异常的'],
    ['Divergent ', '分歧的'],
    ['Phantasmal ', '幻影的'],
    ['Awakened ', '觉醒的'],
    ['Exceptional ', '卓越的']
  ];

  /* A few trade stats are shared by the "more" and "less" versions of the same
   * modifier, with the direction carried only by the rolled item description.
   * The official Chinese stat string can therefore say "总增" for an item that
   * actually has "less".  Override the known cases and flip obvious polarity
   * mismatches instead of showing the opposite modifier. */
  var MOD_TEXT = {
    num_less_duration: '持续时间减少 #%'
  };
  var MOD_TEXT_TW = {
    num_less_duration: '持續時間減少 #%'
  };

  function modKey(value) {
    return norm(stripMarkup(value).replace(/[+-]?\d+(?:\.\d+)?/g, 'num'));
  }

  function flipWord(template, from, to) {
    if (template.indexOf(from) === -1) return template;
    if (template.split(from).length !== 2) return template;
    if (template.indexOf(to) !== -1) return template;
    return template.replace(from, to);
  }

  /* [more, less] pairs per script: flipping with the other script's word would
   * mix 简体 into a 繁體 line (增加 -> 减少). */
  var POLARITY_CN = [['总增', '总降'], ['提高', '降低'], ['增加', '减少'], ['延长', '缩短'], ['加快', '减慢']];
  var POLARITY_TW = [['總增', '總降'], ['提高', '降低'], ['增加', '減少'], ['延長', '縮短'], ['加快', '減慢'], ['更多', '更少']];

  function fixPolarity(template, description, tw) {
    if (!template) return template;
    var d = String(description || '').toLowerCase();
    var down = /\b(less|reduced)\b/.test(d);
    var up = /\b(more|increased)\b/.test(d);
    if (down === up) return template; /* neither, or a mixed multi-effect line */
    var pairs = tw ? POLARITY_TW : POLARITY_CN;
    for (var i = 0; i < pairs.length; i++) {
      template = down
        ? flipWord(template, pairs[i][0], pairs[i][1])
        : flipWord(template, pairs[i][1], pairs[i][0]);
    }
    return template;
  }

  function norm(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/\u2019/g, "'")
      .replace(/'/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function stripMarkup(value) {
    return String(value == null ? '' : value)
      .replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2')
      .replace(/\[([^\]]+)\]/g, '$1');
  }

  function cleanText(value) {
    var s = stripMarkup(value).trim();
    if (!s) return '';
    /* Some old dictionary values carry " (English Name)" for context. */
    if (CN_RE.test(s)) {
      s = s.replace(/\s*\([A-Za-z][^)]*\)\s*$/, '').trim();
    }
    return s;
  }

  function formatNumber(value) {
    if (value == null || value === '') return '';
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    if (Number.isInteger(n)) return String(n);
    return String(parseFloat(n.toFixed(2)));
  }

  function renderTemplate(template, magnitudes) {
    var i = 0;
    var values = magnitudes || [];
    return String(template).replace(/#/g, function () {
      var m = values[i++];
      if (!m) return '#';
      var min = m.min == null ? m.max : m.min;
      var max = m.max == null ? m.min : m.max;
      if (min == null && max == null) return '#';
      if (min != null && max != null && min !== max) {
        return formatNumber(min) + '-' + formatNumber(max);
      }
      return formatNumber(min == null ? max : min);
    });
  }

  /* Trade fetch descriptions carry the actual rolled values ("+74 to maximum
   * Mana"), while the stat template only has placeholders.  The old code used
   * the roll range from mods[].magnitudes, which showed "60-80" on a 74 roll.
   * Pull the numbers straight out of the description instead. */
  function descriptionNumbers(description) {
    var text = stripMarkup(description);
    var out = [];
    var re = /([+-]?)(\d+(?:\.\d+)?)/g;
    var m;
    while ((m = re.exec(text))) out.push({ sign: m[1], value: m[2] });
    return out;
  }

  function renderDescription(template, description) {
    var text = stripMarkup(template);
    var placeholders = (text.match(/#/g) || []).length;
    if (!placeholders) return text;
    var numbers = descriptionNumbers(description);
    if (numbers.length !== placeholders) return '';

    var i = 0;
    var out = text.replace(/#/g, function (match, offset) {
      var number = numbers[i++];
      if (!number) return '#';
      var before = text.slice(0, offset).replace(/\s+$/, '');
      var alreadySigned = /[+-]$/.test(before);
      /* PoE2's Chinese stat data often drops the "+" that the English
       * description carries ("+74 to maximum Mana" -> "# 魔力上限").  Put the
       * sign back unless the template already supplies one. */
      var sign = alreadySigned ? '' : number.sign;
      return sign + number.value;
    });
    return out.indexOf('#') === -1 ? out : '';
  }

  function modMagnitudes(mod) {
    var out = [];
    var groups = mod && mod.mods;
    if (!Array.isArray(groups)) return out;
    for (var i = 0; i < groups.length; i++) {
      var mags = groups[i] && groups[i].magnitudes;
      if (Array.isArray(mags)) {
        for (var j = 0; j < mags.length; j++) out.push(mags[j]);
      }
    }
    return out;
  }

  function translateStats(data, D) {
    if (!data || !Array.isArray(data.result)) return data;
    for (var g = 0; g < data.result.length; g++) {
      var group = data.result[g];
      if (!group) continue;
      if (D.statGroups && D.statGroups[group.id]) group.label = D.statGroups[group.id];
      var entries = group.entries || [];
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry) continue;
        if (D.stats && D.stats[entry.id]) entry.text = D.stats[entry.id];
        var options = entry.option && entry.option.options;
        if (Array.isArray(options) && D.statOptions) {
          for (var j = 0; j < options.length; j++) {
            var option = options[j];
            if (!option) continue;
            var key = entry.id + '\u0000' + option.id;
            if (D.statOptions[key]) option.text = D.statOptions[key];
          }
        }
      }
    }
    return data;
  }

  function translateItems(data, D) {
    if (!data || !Array.isArray(data.result)) return data;
    for (var g = 0; g < data.result.length; g++) {
      var group = data.result[g];
      if (!group) continue;
      if (D.itemGroups && D.itemGroups[group.id]) group.label = D.itemGroups[group.id];
      var entries = group.entries || [];
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry) continue;
        var type = entry.type || '';
        var name = entry.name || '';
        var original = entry.text || '';
        var cnType = (D.types && D.types[type]) || '';
        var cnName = name ? ((D.names && D.names[name]) || '') : '';
        var translated = '';

        if (original) {
          if (D.items && D.items[original]) {
            translated = D.items[original];
          } else if (name) {
            var suffix = entry.disc === 'legacy' ? '（遗产）' : '';
            if (cnName) translated = cnName + (cnType ? ' ' + cnType + suffix : suffix);
          } else if (D.variants) {
            var variantKey = (cnType || type) + '\u0000' + (entry.disc || '');
            translated = D.variants[variantKey] || D.variants[type + '\u0000' + (entry.disc || '')] || '';
            if (!translated && cnType && original === type) translated = cnType;
          } else if (cnType && original === type) {
            translated = cnType;
          }
          /* Never put a numeric/opaque `type` into the dropdown: an untranslated
           * variant must keep its readable English text. */
          if (translated) entry.text = translated;
        } else if (cnType) {
          entry.text = cnType;
        }
      }
    }
    return data;
  }

  function translateStatic(data, D) {
    if (!data || !Array.isArray(data.result)) return data;
    for (var g = 0; g < data.result.length; g++) {
      var group = data.result[g];
      if (!group) continue;
      if (D.staticGroups && D.staticGroups[group.id]) group.label = D.staticGroups[group.id];
      var entries = group.entries || [];
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry && D.staticText && D.staticText[entry.id]) entry.text = D.staticText[entry.id];
      }
    }
    return data;
  }

  /* The Chinese trade API intentionally exposes fewer status/sale-type choices
   * than the English site.  These are the labels used by the live site; keeping
   * the English option ids is what matters for the generated query. */
  var FILTER_TEXT_CN = {
    'status_filters/status': {
      available: '立即购买或当面交易',
      securable: '立即购买',
      onlineleague: '当面交易（联赛在线）',
      online: '当面交易（在线）',
      any: '任意'
    },
    'trade_filters/sale_type': {
      any: '任意',
      'null': '一口价或固定价',
      priced: '一口价或固定价',
      strict_auto_buyout: '精确一口价',
      auto_buyout: '一口价',
      priced_with_info: '备注标价',
      unpriced: '无标价'
    }
  };

  var FILTER_TEXT_TW = {
    'status_filters/status': {
      available: '立即購買或當面交易',
      securable: '立即購買',
      onlineleague: '當面交易（聯盟在線）',
      online: '當面交易（在線）',
      any: '任意'
    },
    'trade_filters/sale_type': {
      any: '任意',
      'null': '一口價或固定價',
      priced: '一口價或固定價',
      strict_auto_buyout: '精確一口價',
      auto_buyout: '一口價',
      priced_with_info: '備註標價',
      unpriced: '無標價'
    }
  };

  function filterOptionText(groupId, filterId, option, fallback, D) {
    var table = (D.lang === 'tw' ? FILTER_TEXT_TW : FILTER_TEXT_CN)[groupId + '/' + filterId];
    var key = option && option.id == null ? 'null' : String(option && option.id);
    if (table && table[key]) return table[key];
    var text = fallback || '';
    if (!text) return '';
    var translated = translateItemText(text, D);
    if (translated !== text) return translated;
    return (D.ui && D.ui[text]) || text;
  }

  function translateFilters(data, D) {
    if (!data || !Array.isArray(data.result)) return data;
    var cnGroups = {};
    var cnList = Array.isArray(D.filters) ? D.filters : [];
    for (var c = 0; c < cnList.length; c++) {
      if (cnList[c] && cnList[c].id) cnGroups[cnList[c].id] = cnList[c];
    }

    for (var g = 0; g < data.result.length; g++) {
      var group = data.result[g];
      if (!group) continue;
      var cnGroup = cnGroups[group.id];
      if (cnGroup && cnGroup.title) group.title = cnGroup.title;
      else if (group.title) group.title = translateItemText(group.title, D);

      var cnFilters = {};
      if (cnGroup && Array.isArray(cnGroup.filters)) {
        for (var f = 0; f < cnGroup.filters.length; f++) {
          if (cnGroup.filters[f] && cnGroup.filters[f].id) cnFilters[cnGroup.filters[f].id] = cnGroup.filters[f];
        }
      }

      var filters = group.filters || [];
      for (var i = 0; i < filters.length; i++) {
        var filter = filters[i];
        if (!filter) continue;
        var cf = cnFilters[filter.id];
        if (cf) {
          if (cf.text) filter.text = cf.text;
          if (cf.title) filter.title = cf.title;
          if (cf.tip) filter.tip = cf.tip;
        } else if (filter.text) {
          filter.text = translateItemText(filter.text, D);
        }

        /* Merge by option id instead of replacing the whole tree: the Chinese
         * API omits several status options (available / onlineleague / online /
         * any), and dropping them would break the default search filter. */
        var options = filter.option && filter.option.options;
        if (!Array.isArray(options)) continue;
        var cnOptions = (cf && cf.option && cf.option.options) || [];
        var byId = {};
        for (var o = 0; o < cnOptions.length; o++) {
          var co = cnOptions[o];
          if (!co) continue;
          byId[co.id == null ? '\u0000' : String(co.id)] = co;
        }
        for (var j = 0; j < options.length; j++) {
          var option = options[j];
          if (!option) continue;
          var match = byId[option.id == null ? '\u0000' : String(option.id)];
          var candidate = (match && match.text) || option.text || '';
          var translated = filterOptionText(group.id, filter.id, option, candidate, D);
          if (translated) option.text = translated;
        }
      }
    }
    return data;
  }

  function translateDisplayItem(item, D) {
    if (!item || typeof item !== 'object') return item;

    var base = item.baseType || '';
    var cnBase = base ? ((D.types && D.types[base]) || '') : '';
    var originalTypeLine = item.typeLine || '';

    if (item.name && D.names && D.names[item.name]) item.name = D.names[item.name];
    if (cnBase) {
      item.baseType = cnBase;
      if (originalTypeLine) {
        if (item.rarity === 'Unique' || originalTypeLine === base) item.typeLine = cnBase;
        else item.typeLine = originalTypeLine.replace(base, cnBase);
      }
    }

    var k, i;
    for (k = 0; k < MOD_KEYS.length; k++) {
      var mods = item[MOD_KEYS[k]];
      if (!Array.isArray(mods)) continue;
      for (i = 0; i < mods.length; i++) {
        var mod = mods[i];
        if (!mod || typeof mod !== 'object') continue;
        var hash = mod.hash ? String(mod.hash) : '';
        var id = hash.replace(/^stat\./, '');
        var description = mod.description ? String(mod.description) : '';
        var override = description
          ? (D.lang === 'tw' ? MOD_TEXT_TW : MOD_TEXT)[modKey(description)]
          : '';
        var template = override || (D.stats && D.stats[id]) ||
          (D.modText && D.modText[mod.description]);
        if (!template || !CN_RE.test(template)) continue;
        if (!override) template = fixPolarity(template, description, D.lang === 'tw');
        var rendered = renderDescription(template, description);
        if (rendered) mod.description = rendered;
      }
    }

    if (Array.isArray(item.properties)) {
      for (i = 0; i < item.properties.length; i++) {
        var prop = item.properties[i];
        if (prop && prop.name) prop.name = translateItemText(prop.name, D);
      }
    }
    if (Array.isArray(item.requirements)) {
      for (i = 0; i < item.requirements.length; i++) {
        var req = item.requirements[i];
        if (req && req.name) req.name = translateItemText(req.name, D);
      }
    }
    var skillKeys = ['skills', 'grantedSkills'];
    for (k = 0; k < skillKeys.length; k++) {
      var skills = item[skillKeys[k]];
      if (!Array.isArray(skills)) continue;
      for (i = 0; i < skills.length; i++) {
        var skill = skills[i];
        if (!skill) continue;
        if (skill.name) skill.name = translateItemText(skill.name, D);
        var values = skill.values;
        if (Array.isArray(values)) {
          for (var v = 0; v < values.length; v++) {
            var pair = values[v];
            if (Array.isArray(pair) && typeof pair[0] === 'string') {
              pair[0] = translateItemText(pair[0], D);
            }
          }
        }
      }
    }
    if (Array.isArray(item.socketedItems)) {
      for (i = 0; i < item.socketedItems.length; i++) translateDisplayItem(item.socketedItems[i], D);
    }
    return item;
  }

  function translateItem(item, D) {
    return translateDisplayItem(item, D);
  }

  function translateFetch(data, D) {
    if (!data || !Array.isArray(data.result)) return data;
    for (var i = 0; i < data.result.length; i++) {
      var row = data.result[i];
      if (row && row.item) translateItem(row.item, D);
    }
    return data;
  }

  function translateItemText(value, D) {
    var text = cleanText(value);
    if (!text) return text;

    if (D.ui && D.ui[text]) return D.ui[text];
    if (D.items && D.items[text]) return D.items[text];

    for (var p = 0; p < PREFIXES.length; p++) {
      var prefix = PREFIXES[p][0];
      if (text.indexOf(prefix) === 0) {
        var inner = translateItemText(text.slice(prefix.length), D);
        if (inner !== text.slice(prefix.length)) return PREFIXES[p][1] + inner;
      }
    }

    var level = text.match(/^(.+?) \((Level|Tier) (\d+)\)$/);
    if (level) {
      var base = translateItemText(level[1], D);
      if (base !== level[1]) {
        return base + '（' + (level[2] === 'Level' ? '等级' : '阶级') + ' ' + level[3] + '）';
      }
    }

    var n = norm(text);
    if (D.itemNorms && D.itemNorms[n]) return D.itemNorms[n];

    if (D.patterns) {
      for (var i = 0; i < D.patterns.length; i++) {
        var pattern = D.patterns[i];
        try {
          var re = new RegExp(pattern[0]);
          if (re.test(text)) return text.replace(re, pattern[1]);
        } catch (e) { /* ignore a malformed pattern */ }
      }
    }
    return text;
  }

  var api = {
    norm: norm,
    stripMarkup: stripMarkup,
    cleanText: cleanText,
    renderTemplate: renderTemplate,
    translateStats: translateStats,
    translateItems: translateItems,
    translateStatic: translateStatic,
    translateFilters: translateFilters,
    translateItem: translateItem,
    translateFetch: translateFetch,
    translateItemText: translateItemText,
    hasChinese: function (s) { return CN_RE.test(String(s || '')); }
  };

  global.PoeCnCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);