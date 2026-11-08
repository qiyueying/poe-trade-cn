"""Merge translation sources into build/out/merged_src.json (key -> zh source value)."""
import json, os, re, collections

base = r'C:\Users\1\Documents\deepseek-harness\default-workspace'
B = os.path.join(base, 'build')
D = os.path.join(base, 'tools', 'downloads')
os.makedirs(os.path.join(B, 'out'), exist_ok=True)

WS = re.compile(r'[\s\u00a0]+')

def norm_key(s):
    return WS.sub(' ', s.replace('\u00a0', ' ')).strip()

PRIO = {}


def add(key, val, prio):
    k = norm_key(key)
    v = (val or '').strip()
    if not k or not v or len(k) < 2:
        return
    if not re.search(r'[A-Za-z\u4e00-\u9fff]', k):
        return
    if k not in PRIO or prio < PRIO[k][0]:
        PRIO[k] = (prio, v)


# priority 0 = hand written additions
def load_tsv(path):
    rows = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'):
                continue
            if '\t' not in line:
                continue
            parts = line.split('\t')
            # 支持 UI 文案表的三列格式：编号 \t 英文 \t 中文
            if len(parts) >= 3 and parts[0].strip().isdigit():
                en, zh = parts[1], '\t'.join(parts[2:])
            else:
                en, zh = parts[0], '\t'.join(parts[1:])
            rows.append((en, zh))
    return rows


import glob

tsvs = [p for p in sorted(glob.glob(os.path.join(B, 'data', '*.tsv')))
        # seeds_* 是给翻译用的输入；p2_* 是 PoE2 专用表（build_dict_p2.py 负责，别混进 PoE1 词典）
        if not os.path.basename(p).startswith(('seeds_', 'p2_'))]
# 手工表按固定顺序先加载，其余（ui_extra_*）随后；同 prio 时先到先得
order = ['items.tsv', 'ui.tsv', 'chrome.tsv', 'tiers.tsv']
tsvs.sort(key=lambda p: (order.index(os.path.basename(p)) if os.path.basename(p) in order else len(order),
                         os.path.basename(p)))

for path in tsvs:
    name = os.path.basename(path)
    rows = load_tsv(path)
    for en, zh in rows:
        if '<br>' in en:
            # register full string and per-segment keys
            add(en, zh, 0)
            ens = en.split('<br>')
            zhs = zh.split('<br>')
            if len(ens) == len(zhs):
                for a, b in zip(ens, zhs):
                    add(a, b, 0)
        else:
            add(en, zh, 0)
    print('loaded', name, len(rows))

for n, prio in [('i18n1', 1), ('i18n2', 2), ('i18n3', 3)]:
    d = json.load(open(os.path.join(base, 'tools', 'maps', n + '.json'), encoding='utf-8'))
    for k, v in d.items():
        add(k, v, prio)
    print('loaded', n, len(d))

merged = {k: v for k, (p, v) in PRIO.items()}
out = os.path.join(B, 'out', 'merged_src.json')
json.dump(merged, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('merged keys', len(merged))
print('by prio', collections.Counter(p for p, v in PRIO.values()))
