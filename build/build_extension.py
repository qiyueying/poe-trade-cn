#!/usr/bin/env python3
"""Assemble the unpacked extension in dist/poe-trade-cn.

Language policy:
  PoE 1  -> 繁體中文 only (official pathofexile.tw data + poedb.tw/tw names)
  PoE 2  -> 简体中文 (default) and 繁體中文, both shipped; the popup switches.

Sources: build/raw/<game>/<lang>/{stats,items,static,filters}.json,
build/out/poedb_maps.json, extension/data/dict*.js|json (FilterBlade dictionary).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import time
import zipfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist", "poe-trade-cn")
OUT = os.path.join(ROOT, "build", "out")
VERSION = "1.1.0"
DATA_VERSION = ""
RAW = os.path.join(ROOT, "build", "raw")
EXT_DATA = os.path.join(ROOT, "extension", "data")

DICTS = {
    ("poe1", "cn"): os.path.join(EXT_DATA, "dict.js"),
    ("poe1", "tw"): os.path.join(EXT_DATA, "dict.tw.json"),
    ("poe2", "cn"): os.path.join(EXT_DATA, "dict.poe2.js"),
    ("poe2", "tw"): os.path.join(EXT_DATA, "dict.poe2.tw.json"),
}

# output plan: game -> list of (lang, file stem, global)
PLAN = {
    "poe1": [("tw", "poe1", "__POE_CN_DATA__")],
    "poe2": [("cn", "poe2", "__POE_CN_DATA__"),
             ("tw", "poe2.tw", "__POE_CN_DATA_TW__")],
}


def read_json(path: str):
    with open(path, encoding="utf-8-sig") as fh:
        return json.load(fh)


def load_js_dict(path: str) -> dict[str, str]:
    text = open(path, encoding="utf-8").read()
    start, end = text.index("{"), text.rindex("}")
    payload = json.loads(text[start:end + 1])
    return payload.get("cn", payload)


def load_dict(game: str, lang: str) -> dict[str, str]:
    path = DICTS[(game, lang)]
    if not os.path.exists(path):
        return {}
    if path.endswith(".json"):
        return read_json(path)
    return load_js_dict(path)


def norm(value: str) -> str:
    value = str(value or "").lower().replace("\u2019", "'").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_")


def clean_cn(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if re.search(r"[\u3400-\u9fff]", value):
        value = re.sub(r"\s*\([A-Za-z][^)]*\)\s*$", "", value).strip()
    return value


def load_poedb() -> dict[str, dict[str, dict[str, str]]]:
    path = os.path.join(OUT, "poedb_maps.json")
    if not os.path.exists(path):
        return {}
    payload = read_json(path)
    return {
        game: {lang: {str(k): clean_cn(v) for k, v in mapping.items()} for lang, mapping in langs.items()}
        for game, langs in payload.items()
    }


def translated_name(value: str, dictionary: dict[str, str], poedb: dict[str, str], tw: bool) -> str:
    """English display name -> localized name.

    For 繁體 the poedb (流亡編年史) name wins over the opencc-converted
    FilterBlade dictionary, because conversion keeps mainland vocabulary
    ('冰霜抗性' instead of the Taiwanese '冰冷抗性')."""
    if not value:
        return ""
    key = norm(value)
    if tw:
        if key in poedb:
            return clean_cn(poedb[key])
        if value in dictionary:
            return clean_cn(dictionary[value])
        return ""
    if value in dictionary:
        return clean_cn(dictionary[value])
    if key in poedb:
        return clean_cn(poedb[key])
    return ""


def stats_payload(en: dict, loc: dict):
    loc_stats = {}
    loc_options = {}
    group_labels = {}
    for group in loc.get("result", []):
        gid = group.get("id")
        if gid and group.get("label"):
            group_labels[gid] = group["label"]
        for entry in group.get("entries", []):
            eid = entry.get("id")
            if not eid:
                continue
            if entry.get("text"):
                loc_stats[eid] = entry["text"]
            options = (entry.get("option") or {}).get("options") or []
            for option in options:
                if option.get("id") is None:
                    continue
                if option.get("text"):
                    loc_options[eid + "\u0000" + str(option["id"])] = option["text"]

    stats = {}
    for group in en.get("result", []):
        for entry in group.get("entries", []):
            eid = entry.get("id")
            if not eid:
                continue
            text = loc_stats.get(eid) or entry.get("text") or ""
            if text:
                stats[eid] = text
    return stats, loc_options, group_labels


def items_payload(en: dict, loc: dict, dictionary: dict[str, str], poedb: dict[str, str], tw: bool):
    loc_groups = {g.get("id"): g for g in loc.get("result", [])}
    group_labels = {gid: g.get("label") for gid, g in loc_groups.items() if g.get("label")}
    types, names, items, item_norms, variants = {}, {}, {}, {}, {}
    unique_count = 0

    def put(key: str, value: str):
        if not key or not value:
            return
        items.setdefault(key, value)
        n = norm(key)
        if n:
            item_norms.setdefault(n, value)

    loc_name_text, loc_variants = {}, {}
    for group in loc.get("result", []):
        for entry in group.get("entries", []):
            cname = entry.get("name") or ""
            ctext = entry.get("text") or ""
            ctype = entry.get("type") or ""
            cdisc = entry.get("disc") or ""
            if cname and ctext:
                loc_name_text.setdefault(cname, ctext)
            if ctext and cdisc:
                loc_variants.setdefault(ctype + "\u0000" + cdisc, ctext)

    for group in en.get("result", []):
        for entry in group.get("entries", []):
            etype = entry.get("type") or ""
            ename = entry.get("name") or ""
            edisc = entry.get("disc") or ""
            loc_type = translated_name(etype, dictionary, poedb, tw)
            loc_name = translated_name(ename, dictionary, poedb, tw) if ename else ""
            if loc_type:
                types[etype] = loc_type
                put(etype, loc_type)
            if loc_name:
                names[ename] = loc_name
                put(ename, loc_name)
            if ename:
                unique_count += 1
                if loc_name:
                    full = loc_name_text.get(loc_name)
                    if not full:
                        full = loc_name + (" " + loc_type if loc_type else "")
                    put(ename + " " + etype, full)
            if edisc:
                key = (loc_type or etype) + "\u0000" + edisc
                value = loc_variants.get(key) or loc_variants.get(etype + "\u0000" + edisc)
                if value:
                    variants[key] = value

    return types, names, items, item_norms, variants, group_labels, unique_count


def static_payload(en: dict, loc: dict):
    loc_text, loc_groups = {}, {}
    for group in loc.get("result", []):
        gid = group.get("id")
        if gid and group.get("label"):
            loc_groups[gid] = group["label"]
        for entry in group.get("entries", []):
            eid = entry.get("id")
            if eid and entry.get("text"):
                loc_text[eid] = entry["text"]
    static = {}
    for group in en.get("result", []):
        for entry in group.get("entries", []):
            eid = entry.get("id")
            if eid:
                static[eid] = loc_text.get(eid, entry.get("text") or "")
    return {k: v for k, v in static.items() if v}, loc_groups


def make_icons(icon_dir: str):
    os.makedirs(icon_dir, exist_ok=True)
    for size in (16, 32, 48, 128):
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        pad = max(1, size // 16)
        d.ellipse((pad, pad, size - pad, size - pad), fill=(23, 19, 15, 255), outline=(200, 164, 92, 255), width=max(1, size // 32))
        cx = cy = size / 2
        r = size * 0.24
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=(200, 164, 92, 255))
        d.ellipse((cx - size * 0.06, cy - size * 0.06, cx + size * 0.06, cy - size * 0.06), fill=(23, 19, 15, 255))
        img.save(os.path.join(icon_dir, f"icon{size}.png"))


def write_js(path: str, var: str, payload) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("/* generated by build/build_extension.py - do not edit */\n")
        fh.write("window." + var + "=")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")


def build_payload(game: str, lang: str, dictionary: dict[str, str], poedb: dict[str, str]):
    raw = os.path.join(RAW, game)
    en = read_json(os.path.join(raw, "en", "stats.json"))
    loc = read_json(os.path.join(raw, lang, "stats.json"))
    stats, stat_options, stat_groups = stats_payload(en, loc)

    en_items = read_json(os.path.join(raw, "en", "items.json"))
    loc_items = read_json(os.path.join(raw, lang, "items.json"))
    types, names, items, item_norms, variants, item_groups, unique_count = items_payload(
        en_items, loc_items, dictionary, poedb, lang == "tw"
    )

    en_static = read_json(os.path.join(raw, "en", "static.json"))
    loc_static = read_json(os.path.join(raw, lang, "static.json"))
    static_text, static_groups = static_payload(en_static, loc_static)

    loc_filters = read_json(os.path.join(raw, lang, "filters.json")).get("result", [])
    en_filters = read_json(os.path.join(raw, "en", "filters.json")).get("result", [])
    en_group_ids = [g.get("id") for g in en_filters]
    loc_group_ids = {g.get("id") for g in loc_filters}
    missing_filters = [gid for gid in en_group_ids if gid not in loc_group_ids]

    payload = {
        "game": game,
        "lang": lang,
        "version": DATA_VERSION,
        "stats": stats,
        "statOptions": stat_options,
        "statGroups": stat_groups,
        "staticText": static_text,
        "staticGroups": static_groups,
        "filters": loc_filters,
        "types": types,
        "names": names,
        "items": items,
        "itemNorms": item_norms,
        "variants": variants,
        "itemGroups": item_groups,
    }
    summary = {
        "stats": len(stats),
        "statOptions": len(stat_options),
        "statGroups": len(stat_groups),
        "types": len(types),
        "names": len(names),
        "items": len(items),
        "variants": len(variants),
        "uniques": unique_count,
        "static": len(static_text),
        "filters": len(loc_filters),
        "missing_filters": missing_filters,
        "dict": len(dictionary),
        "poedb": len(poedb),
    }
    return payload, summary


def preflight() -> None:
    """Fail with the producing command instead of a traceback on a fresh clone."""
    needs = [
        (os.path.join(SRC, "manifest.json"), "src/ 源码不完整"),
        (os.path.join(OUT, "poedb_maps.json"), "python build/poedb_maps.py（先 python build/fetch_poedb.py --force）"),
        (os.path.join(OUT, "ui_cn.json"), "node build/make_ui_dict.js"),
        (os.path.join(OUT, "ui_tw.json"), "node build/convert_ui.js"),
    ]
    for game, entries in PLAN.items():
        for lang, _, _ in entries:
            for kind in ("stats", "items", "static", "filters"):
                needs.append((os.path.join(RAW, game, lang, kind + ".json"),
                              "python build/fetch_data.py --force"))
            needs.append((DICTS[(game, lang)], "extension/data/ 词典缺失"))
    missing = [(rel, fix) for rel, fix in needs if not os.path.exists(rel)]
    if not missing:
        return
    print("缺少构建输入，先补齐：", file=sys.stderr)
    for rel, fix in missing:
        print("  - %s  <= %s" % (os.path.relpath(rel, ROOT), fix), file=sys.stderr)
    raise SystemExit(2)


def main() -> int:
    global DATA_VERSION
    preflight()
    DATA_VERSION = time.strftime("%Y%m%d.%H%M", time.gmtime())

    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    shutil.copytree(SRC, DIST)
    os.makedirs(os.path.join(DIST, "data"), exist_ok=True)
    make_icons(os.path.join(DIST, "icons"))

    poedb_all = load_poedb()
    for lang, stem in (("cn", "ui.js"), ("tw", "ui.tw.js")):
        path = os.path.join(OUT, "ui_cn.json" if lang == "cn" else "ui_tw.json")
        ui_payload = read_json(path)
        write_js(
            os.path.join(DIST, "data", stem),
            "__POE_CN_UI__" if lang == "cn" else "__POE_CN_UI_TW__",
            {"v": 1, "lang": lang, "map": ui_payload.get("map", {}), "patterns": ui_payload.get("patterns", [])},
        )

    summary = {}
    for game, entries in PLAN.items():
        for lang, stem, global_name in entries:
            dictionary = load_dict(game, lang)
            poedb = poedb_all.get(game, {}).get(lang, {})
            payload, stats = build_payload(game, lang, dictionary, poedb)
            write_js(os.path.join(DIST, "data", stem + ".js"), global_name, payload)
            summary[f"{game}/{lang}"] = stats

    readme_src = os.path.join(DIST, "README.md")
    if os.path.exists(readme_src):
        text = open(readme_src, encoding="utf-8").read()
        text = text.replace("{{VERSION}}", VERSION)
        open(readme_src, "w", encoding="utf-8").write(text)

    zip_path = os.path.join(ROOT, "dist", "poe-trade-cn.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for base_dir, _, files in os.walk(DIST):
            for name in files:
                full = os.path.join(base_dir, name)
                zf.write(full, os.path.relpath(full, DIST))

    print("built", DIST, "data", DATA_VERSION)
    print("summary", json.dumps(summary, ensure_ascii=False, indent=2))
    for stem in sorted({s for entries in PLAN.values() for _, s, _ in entries}):
        size = os.path.getsize(os.path.join(DIST, "data", stem + ".js"))
        print(f"{stem}: {size / 1024 / 1024:.2f} MB")
    print("zip", zip_path, f"{os.path.getsize(zip_path) / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())