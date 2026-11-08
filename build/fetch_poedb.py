#!/usr/bin/env python3
"""Download 流亡編年史 item pages for the traditional-Chinese (TW) side.

poe2db.tw/tw/<Class> and poedb.tw/tw/<Class> both list base types and uniques
with their Taiwanese names.  The pages are cached under tools/downloads/p2tw and
tools/downloads/p1tw; poedb_maps.py then turns them into slug -> name maps.
"""
from __future__ import annotations

import gzip
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DL = os.path.join(ROOT, "tools", "downloads")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

POE2_CLASSES = [
    "Amulets", "Belts", "Body_Armours", "Boots", "Bows", "Bucklers", "Charms",
    "Crossbows", "Foci", "Gloves", "Helmets", "Jewels", "Life_Flasks",
    "Mana_Flasks", "Quarterstaves", "Quivers", "Rings", "Sceptres", "Shields",
    "Spears", "Staves", "Two_Hand_Maces", "Wands", "Currency", "Gems",
    "Unique_item",
]

POE1_CLASSES = [
    "Amulets", "Belts", "Body_Armours", "Boots", "Bows", "Claws", "Daggers",
    "Fishing_Rods", "Flasks", "Gloves", "Helmets", "Jewels", "Maps",
    "One_Hand_Axes", "One_Hand_Maces", "One_Hand_Swords", "Quivers", "Rings",
    "Sceptres", "Shields", "Staves", "Thrusting_One_Hand_Swords",
    "Two_Hand_Axes", "Two_Hand_Maces", "Two_Hand_Swords", "Wands",
    "Warstaves", "Currency", "Unique_item",
]

SITES = {
    "p2cn": ("https://poe2db.tw/cn/", POE2_CLASSES),
    "p2tw": ("https://poe2db.tw/tw/", POE2_CLASSES),
    "p1tw": ("https://poedb.tw/tw/", POE1_CLASSES),
}

# cache dir per site; poedb_maps.py reads tools/downloads/p2/cls plus tools/downloads/p2
OUTDIRS = {"p2cn": "p2"}


def fetch(url: str, tries: int = 4) -> bytes:
    last = None
    for i in range(tries):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": UA,
                "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
                "Accept": "text/html,application/xhtml+xml",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                if (r.headers.get("Content-Encoding") or "").lower() == "gzip":
                    data = gzip.decompress(data)
                if r.status != 200:
                    raise RuntimeError("HTTP %s" % r.status)
                return data
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (i + 1))
    raise RuntimeError("%s: %s" % (url, last))


def main() -> int:
    force = any(a in ("-f", "--force") for a in sys.argv[1:])
    todo = [a for a in sys.argv[1:] if not a.startswith("-")] or list(SITES)
    for name in todo:
        prefix, classes = SITES[name]
        outdir = os.path.join(DL, OUTDIRS.get(name, name))
        os.makedirs(outdir, exist_ok=True)
        for cls in classes:
            path = os.path.join(outdir, cls + ".html")
            if not force and os.path.exists(path) and os.path.getsize(path) > 4096:
                print("skip", name, cls, flush=True)
                continue
            url = prefix + cls
            try:
                data = fetch(url)
            except Exception as exc:  # noqa: BLE001
                print("ERR", url, exc, flush=True)
                continue
            with open(path, "wb") as fh:
                fh.write(data)
            print("get", url, len(data), flush=True)
            time.sleep(0.6)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
