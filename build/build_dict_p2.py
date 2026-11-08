"""Merge PoE2 translation sources into build/out/merged_src_p2.json.

Base = the PoE1 dictionary (build/out/merged_src.json, 站点界面文案 + PoE1 物品),
overridden/extended with:
  * build/data/p2_harvest.tsv  —— 从 poe2db.tw/cn 分类页抓下来的 BaseType 中文名
  * build/data/p2_manual.tsv   —— 手工补的类别/机制词/poe2db 暂无的物品
  * 模板生成 —— "Waystone (Tier N)" / "Uncut … Gem (Level N)" / "Thaumaturgic Flux (Level N)"
"""
import json, os, re, collections

base = r'C:\Users\1\Documents\deepseek-harness\default-workspace'
B = os.path.join(base, 'build')
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


BR = re.compile(r'<br\s*/?>', re.I)


def add_pair(en, zh, prio):
    """整串入库；含 <br> 的描述再按段入库（站点把 <br> 拆成独立文本节点）。"""
    add(en, zh, prio)
    if not BR.search(en) or not BR.search(zh):
        return
    en_parts = BR.split(en)
    zh_parts = BR.split(zh)
    if len(en_parts) == len(zh_parts):
        for a, b in zip(en_parts, zh_parts):
            a, b = a.strip(), b.strip()
            if a and b:
                add(a, b, prio)


def load_tsv(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'):
                continue
            if '\t' not in line:
                continue
            parts = line.split('\t')
            if len(parts) >= 3 and parts[0].strip().isdigit():
                en, zh = parts[1], '\t'.join(parts[2:])
            else:
                en, zh = parts[0], '\t'.join(parts[1:])
            rows.append((en, zh))
    return rows


# 1) PoE1 词典作为底（prio 5：只在 PoE2 没有更权威译名时兜底）
poe1 = json.load(open(os.path.join(B, 'out', 'merged_src.json'), encoding='utf-8'))
for k, v in poe1.items():
    add(k, v, 5)
print('base(poe1)', len(poe1))

# 2) poe2db 抓下来的物品名（prio 1）
harvest = load_tsv(os.path.join(B, 'data', 'p2_harvest.tsv'))
for en, zh in harvest:
    add_pair(en, zh, 1)
print('harvest', len(harvest))

# 3) 手工表（prio 0，最高）
manual = load_tsv(os.path.join(B, 'data', 'p2_manual.tsv'))
for en, zh in manual:
    add_pair(en, zh, 0)
print('manual', len(manual))

# 3b) PoE2 定制器选项文案（prio 0，与手工表同级）
opt = load_tsv(os.path.join(B, 'data', 'p2_opt.tsv'))
for en, zh in opt:
    add_pair(en, zh, 0)
print('opt', len(opt))

# 4) 模板：带编号的物品名
templates = [
    ('Waystone (Tier %d)', '引路石（%d 阶）', range(1, 17)),
    ('Thaumaturgic Flux (Level %d)', '秘术溶剂（等级%d）', range(1, 21)),
    ('Uncut Skill Gem (Level %d)', '未切割的技能宝石（等级%d）', range(1, 21)),
    ('Uncut Spirit Gem (Level %d)', '未切割的精魂宝石（等级%d）', range(1, 21)),
    ('Uncut Support Gem (Level %d)', '未切割的辅助宝石（等级%d）', range(1, 6)),
]
tpl = 0
for en_fmt, zh_fmt, nums in templates:
    for n in nums:
        add(en_fmt % n, zh_fmt % n, 0)
        tpl += 1
print('templates', tpl)

merged = {k: v for k, (p, v) in PRIO.items()}
out = os.path.join(B, 'out', 'merged_src_p2.json')
json.dump(merged, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('merged keys', len(merged))
print('by prio', collections.Counter(p for p, v in PRIO.values()))
