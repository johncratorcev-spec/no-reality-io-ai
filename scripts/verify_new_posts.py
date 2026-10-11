#!/usr/bin/env python3
"""Выбор главной MP4 из извлечённых srcs + верификация CDN (Range 206) + duration из efg."""
import base64
import json
import re
import subprocess
import urllib.parse

POSTS = [
    ("_-Z4aWSMP", "/tmp/nr_new1.json", "/tmp/nr_v1.txt"),
    ("BAWGxfPS1I", "/tmp/nr_new2.json", "/tmp/nr_v2.txt"),
    ("BBiT4ujHK9", "/tmp/nr_new3.json", "/tmp/nr_v3.txt"),
    ("BAR9mOAXcF", "/tmp/nr_new4.json", "/tmp/nr_v4.txt"),
    ("BBhXKz1lH9", "/tmp/nr_new5.json", "/tmp/nr_v5.txt"),
    ("BAW0_hpnMB", "/tmp/nr_new6.json", "/tmp/nr_v6.txt"),
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
    """Range-запрос: ждём 206 + video/mp4."""
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{content_type} %{size_download}",
             "-r", "0-1023", "--max-time", "20", url],
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()
        return out
    except Exception as e:
        return f"ERR {e}"


for code, src, dst in POSTS:
    d = json.loads(json.loads(open(src).read().strip()))
    srcs = d.get("srcs") or []
    pick, dur, check = "", None, ""
    for s in srcs:
        res = verify(s)
        ok = res.startswith("206")
        if ok and not pick:
            pick, check = s, res
            dur = decode_efg(s)
            break
        if not pick:
            check = res  # запоминаем последний ответ для диагностики
    open(dst, "w").write(pick)
    print(f"{code}: n={len(srcs)} ok={bool(pick)} dur={dur}s [{check[:40]}]")
