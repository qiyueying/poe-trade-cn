#!/usr/bin/env python3
"""Build normalized English-slug -> localized name maps from cached poedb /
poe2db pages (流亡編年史).

Caches read (no network here):
  tools/downloads/p2/cls/*.html  + p2/*.html             PoE2 简体 (poe2db.tw/cn)
  tools/downloads/p2tw/*.html                            PoE2 繁體 (poe2db.tw/tw)
  tools/downloads/p1tw/*.html                            PoE1 繁體 (poedb.tw/tw)
"""
from __future__ import annotations

import glob
import html
import json
import os
import re
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "build", "out")
DL = os.path.join(ROOT, "tools", "downloads")

BASE_RE = re.compile(
    r'<a class="[^"]*whiteitem[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]{1,60})</a>'
)
UNIQUE_RE = re.compile(
    r'<a class="[^"]*UniqueItem[^"]*"[^>]*href="([^"]+)"[^>]*>\s*'
    r'<span class="uniqueName">([^<]+)</span>'
)
UNIQUE_RE2 = re.compile(
    r'<a class="[^"]*UniqueItem[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]{1,80})</a>'
)
GEM_RE = re.compile(r'<a class="gem_[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)</a>')


def norm(value: str) -> str:
    value = html.unescape(value or "").lower()
    value = value.replace("\u2019", "'").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_")


def add(mapping: dict[str, str], key: str, value: str) -> None:
    key = norm(key)
    value = html.unescape(value or "").strip()
    if key and value and key not in mapping:
        mapping[key] = value


def parse_files(mapping: dict[str, str], paths: list[str]) -> None:
    for path in sorted(paths):
        text = open(path, encoding="utf-8", errors="replace").read()
        for href, name in BASE_RE.findall(text):
            add(mapping, unquote(href.rsplit("/", 1)[-1]).replace("-", "_"), name)
        for href, name in GEM_RE.findall(text):
            add(mapping, unquote(href.rsplit("/", 1)[-1]), name)
        for href, name in UNIQUE_RE.findall(text):
            add(mapping, unquote(href.rsplit("/", 1)[-1]), name)
        if "Unique_item" in os.path.basename(path):
            for href, name in UNIQUE_RE2.findall(text):
                add(mapping, unquote(href.rsplit("/", 1)[-1]), name)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    maps = {"poe1": {"cn": {}, "tw": {}}, "poe2": {"cn": {}, "tw": {}}}

    parse_files(maps["poe2"]["cn"], glob.glob(os.path.join(DL, "p2", "cls", "*.html")))
    parse_files(maps["poe2"]["cn"], glob.glob(os.path.join(DL, "p2", "*.html")))
    parse_files(maps["poe2"]["tw"], glob.glob(os.path.join(DL, "p2tw", "*.html")))
    parse_files(maps["poe1"]["tw"], glob.glob(os.path.join(DL, "p1tw", "*.html")))

    out_path = os.path.join(OUT, "poedb_maps.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(maps, fh, ensure_ascii=False, separators=(",", ":"))
    for game, langs in maps.items():
        print(game, {lang: len(m) for lang, m in langs.items()})
    print("wrote", out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
