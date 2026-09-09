#!/usr/bin/env python3
"""Батч 3: выбор главной MP4 из извлечённых srcs + верификация CDN (Range 206) + duration из efg."""
import base64
import json
import re
import subprocess
import urllib.parse

POSTS = [
    ("BAmRDZwo2i", "/tmp/extract/BAmRDZwo2i.json", "/tmp/extract/BAmRDZwo2i.mp4.txt"),
    ("BAc_WkgDGz", "/tmp/extract/BAc_WkgDGz.json", "/tmp/extract/BAc_WkgDGz.mp4.txt"),
    ("BAUClsrLHr", "/tmp/extract/BAUClsrLHr.json", "/tmp/extract/BAUClsrLHr.mp4.txt"),
    ("_1KCUr9T2", "/tmp/extract/_1KCUr9T2.json", "/tmp/extract/_1KCUr9T2.mp4.txt"),
    ("BAUEp_JDEF", "/tmp/extract/BAUEp_JDEF.json", "/tmp/extract/BAUEp_JDEF.mp4.txt"),
    ("BAhQOr0TrW", "/tmp/extract/BAhQOr0TrW.json", "/tmp/extract/BAhQOr0TrW.mp4.txt"),
]


def decode_efg(url: str):
    m = re.search(r"efg=([^&]+)", url)
    if not m:
        return None
    raw = urllib.parse.unquote(m.group(1))
    for pad in range(3):
        try:
            data = base64.b64decode(raw + "=" * pad).decode("utf-8", "ignore")
            d = json.loads(data)
            return d.get("duration_s")
        except Exception:
            continue
    return None


def verify(url: str):
    try:
        return subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{content_type} %{size_download}",
             "-r", "0-1023", "--max-time", "20", url],
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()
    except Exception as e:
        return f"ERR {e}"


ok_all = True
for code, src, dst in POSTS:
    d = json.loads(json.loads(open(src).read().strip()))
    srcs = d.get("srcs") or []
    pick, dur, check = "", None, ""
    for s in srcs:
        res = verify(s)
        if res.startswith("206"):
            pick, check = s, res
            dur = decode_efg(s)
            break
        check = res
    if not pick:
        ok_all = False
    open(dst, "w").write(pick)
    print(f"{code:<12} {'OK ' if pick else 'FAIL'} dur={dur}s  [{check}]")
    if not pick:
        print(f"   ответ: {check}")

print("\nALL OK" if ok_all else "\nЕСТЬ ПРОБЛЕМЫ")
