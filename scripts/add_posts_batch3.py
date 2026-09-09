#!/usr/bin/env python3
"""Батч 3: обновление data/posts.csv — +6 постов, новый фичеренный (BAmRDZwo2i) с boost_until = now+24ч.
Существующие строки сохраняются ВМЕСТЕ с их boost_until (у прошлого фичера буст ещё активен).
Новая фичеренная строка пишется первой для читаемости."""
import csv
import datetime
import json
import re
import secrets

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

NEW = [
    # (post_code, json-файл, файл с mp4, featured?)
    ("BAmRDZwo2i", "/tmp/extract/BAmRDZwo2i.json", "/tmp/extract/BAmRDZwo2i.mp4.txt", True),
    ("BAc_WkgDGz", "/tmp/extract/BAc_WkgDGz.json", "/tmp/extract/BAc_WkgDGz.mp4.txt", False),
    ("BAUClsrLHr", "/tmp/extract/BAUClsrLHr.json", "/tmp/extract/BAUClsrLHr.mp4.txt", False),
    ("_1KCUr9T2", "/tmp/extract/_1KCUr9T2.json", "/tmp/extract/_1KCUr9T2.mp4.txt", False),
    ("BAUEp_JDEF", "/tmp/extract/BAUEp_JDEF.json", "/tmp/extract/BAUEp_JDEF.mp4.txt", False),
    ("BAhQOr0TrW", "/tmp/extract/BAhQOr0TrW.json", "/tmp/extract/BAhQOr0TrW.mp4.txt", False),
]


def parse_json(path):
    return json.loads(json.loads(open(path).read().strip()))


def handle(d):
    m = re.search(r"/@([A-Za-z0-9_.]+)", d.get("author") or "")
    return f"@{m.group(1)}" if m else "@unknown"


def clean_title(d):
    t = (d.get("title") or "").replace("\n", " ").replace("\r", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t[:220]


def esc(s):
    if any(c in s for c in ',"\n'):
        return '"' + s.replace('"', '""') + '"'
    return s


# --- читаем существующие строки ---
with open(CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    existing = list(reader)
    known_codes = {r["utm_code"] for r in existing}

boost_until = (
    datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
).strftime("%Y-%m-%dT%H:%M:%S.000Z")

out_rows = []
existing_urls = {r["url"].rstrip("/") for r in existing}

for code, jsrc, vsrc, featured in NEW:
    d = parse_json(jsrc)
    video = open(vsrc).read().strip()
    if not video:
        print(f"{code}: НЕТ ВИДЕО — пропуск"); continue
    author = handle(d)
    title = clean_title(d)
    post_url = f"https://www.threads.com/share/{code}/"
    if post_url.rstrip("/") in existing_urls:
        print(f"{code}: уже в CSV — пропуск"); continue

    utm = None
    while not utm or utm in known_codes:
        utm = "".join(secrets.choice(ALPHABET) for _ in range(8))
    known_codes.add(utm)

    out_rows.append({
        "url": post_url, "title": title, "author": author,
        "utm_code": utm, "video_url": video,
        "boost_until": boost_until if featured else "",
    })
    tag = "  <-- FEATURED (boost 24h)" if featured else ""
    print(f"{code} @{author[1:]:16s} utm={utm} boost={'YES' if featured else '-'}{tag}")

# --- новая фичеренная первой, остальные существующие сохраняют свои boost_until ---
lines = ["url,title,author,utm_code,video_url,boost_until"]
for r in out_rows[:1]:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], r["boost_until"]]))
for r in existing:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], r.get("boost_until", "")]))
for r in out_rows[1:]:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], ""]))

with open(CSV, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"\nCSV written: {len(lines)-1} rows, новый boost_until={boost_until}")
