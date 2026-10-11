#!/usr/bin/env python3
"""Обновление data/posts.csv: +6 новых постов, фичеренный получает boost_until = now+24ч.
Существующие строки (utm-коды, video_url) сохраняются как есть."""
import csv
import datetime
import json
import re
import secrets

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

NEW = [
    # (post_code, json-файл, featured?)
    ("_-Z4aWSMP", "/tmp/nr_new1.json", "/tmp/nr_v1.txt", True),
    ("BAWGxfPS1I", "/tmp/nr_new2.json", "/tmp/nr_v2.txt", False),
    ("BBiT4ujHK9", "/tmp/nr_new3.json", "/tmp/nr_v3.txt", False),
    ("BAR9mOAXcF", "/tmp/nr_new4.json", "/tmp/nr_v4.txt", False),
    ("BBhXKz1lH9", "/tmp/nr_new5.json", "/tmp/nr_v5.txt", False),
    ("BAW0_hpnMB", "/tmp/nr_new6.json", "/tmp/nr_v6.txt", False),
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
    author = handle(d)
    title = clean_title(d)
    post_url = f"https://www.threads.com/share/{code}/"

    utm = None
    if post_url.rstrip("/") in existing_urls:
        # уже есть — не дублируем
        continue
    while not utm or utm in known_codes:
        utm = "".join(secrets.choice(ALPHABET) for _ in range(8))
    known_codes.add(utm)

    out_rows.append(
        {
            "url": post_url,
            "title": title,
            "author": author,
            "utm_code": utm,
            "video_url": video,
            "boost_until": boost_until if featured else "",
        }
    )
    tag = "  <-- FEATURED (boost 24h)" if featured else ""
    print(f"{code} @{author[1:]:22s} utm={utm} boost={'YES' if featured else '-'}{tag}")

# --- фичеренная строка идёт первой для читаемости ---
lines = ["url,title,author,utm_code,video_url,boost_until"]
for r in out_rows[:1]:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], r["boost_until"]]))
for r in existing:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], ""]))
for r in out_rows[1:]:
    lines.append(",".join([r["url"], esc(r["title"]), r["author"], r["utm_code"], r["video_url"], ""]))

with open(CSV, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"\nCSV written: {len(lines)-1} rows, boost_until={boost_until}")
