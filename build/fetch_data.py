#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Download official PoE trade data (stats/items/static/filters) in en/zh-TW/zh-CN.

Caches each response under build/raw/<game>/<lang>/<kind>.json so re-runs are cheap.
The public API is Cloudflare-fronted and occasionally returns 403; retry with backoff.
"""
import argparse
import json
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "build", "raw")

HOSTS = {
    "en": "https://www.pathofexile.com",
    "tw": "https://pathofexile.tw",
    "cn": "https://poe.game.qq.com",
}
KINDS = ("stats", "items", "static", "filters")
GAMES = {"poe1": "", "poe2": "2"}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def fetch(url, tries=6):
    last = None
    for i in range(tries):
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": UA,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.pathofexile.com/trade/",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                if r.status != 200:
                    raise RuntimeError("HTTP %s" % r.status)
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
            wait = 2 + i * 3
            print("  retry %d/%d in %ds: %s" % (i + 1, tries, wait, e), flush=True)
            time.sleep(wait)
    raise RuntimeError("failed %s: %s" % (url, last))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-download existing files")
    ap.add_argument("--sleep", type=float, default=1.5)
    args = ap.parse_args()

    for game, ver in GAMES.items():
        for lang, host in HOSTS.items():
            outdir = os.path.join(RAW, game, lang)
            os.makedirs(outdir, exist_ok=True)
            for kind in KINDS:
                out = os.path.join(outdir, kind + ".json")
                if os.path.exists(out) and not args.force:
                    print("skip", os.path.relpath(out, ROOT), flush=True)
                    continue
                url = "%s/api/trade%s/data/%s" % (host, ver, kind)
                print("get", url, flush=True)
                body = fetch(url)
                data = json.loads(body)
                with open(out, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
                print("  ->", len(body), "bytes", flush=True)
                time.sleep(args.sleep)


if __name__ == "__main__":
    main()
