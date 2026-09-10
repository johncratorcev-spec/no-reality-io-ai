#!/usr/bin/env python3
"""Верификация MP4 для батча 4 (задача 13): Range-запрос + duration из efg."""
import json, re, sys, urllib.request

POSTS = ["BAEmUmZUj_", "BAPNTZ-xGs", "BAK6h933m-", "BAZmyX2v0C", "BCJcGR3ZI1", "BAX0B8r7iC"]
BASE = "/home/z/my-project/scripts/extract_out"

def load(code):
    raw = open(f"{BASE}/{code}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["srcs"][0], d["author"], d["title"], d["ogTitle"]

ok = True
for code in POSTS:
    src, author, title, og = load(code)
    # duration из efg (base64 JSON)
    m = re.search(r"efg=([^&]+)", src)
    dur = None
    if m:
        import base64
        try:
            pad = m.group(1) + "=" * (-len(m.group(1)) % 4)
            efg = json.loads(base64.urlsafe_b64decode(pad))
            dur = efg.get("duration_s")
        except Exception as e:
            dur = f"efg-err:{e}"
    req = urllib.request.Request(src, headers={"Range": "bytes=0-1023", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            ct = r.headers.get("Content-Type", "")
            status = r.status
            size = r.headers.get("Content-Range", "")
    except Exception as e:
        print(f"{code}: FAIL {e}")
        ok = False
        continue
    good = status == 206 and "video/mp4" in ct
    ok = ok and good
    print(f"{code}: {'OK ' if good else 'BAD'} {status} {ct} | dur={dur}s | {author.split('?')[0].split('/')[-1]} | {size[:30]}")
    if not good:
        ok = False

print("ALL OK" if ok else "SOME FAILED")
sys.exit(0 if ok else 1)
