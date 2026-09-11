#!/usr/bin/env python3
"""Батч 6 (задачи 15+16): +2 строки в data/posts.csv, обе с бейджем SWAG.
BAWFhNMwp4 — автор скрыт логин-стеной (@unknown, как _4yIKMBXZ ранее),
заголовка нет. BAD7RdF75N — @lesya.neuro, русский заголовок переведён на EN.
Колонки/порядок существующих строк сохраняются; boost_until не трогаем."""
import csv, secrets, string, json, sys

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

# Оригинал: "Моя новая AI работа💔 Здесь хотелось передать, что стиль —
# это не когда ты стараешься соответствовать, а когда ты настолько уверен
# в себе, что правила уже подстраиваются под тебя"
LESYA_EN = ("My new AI work 💔 Here I wanted to convey that style isn't about "
            "trying to fit in — it's when you're so confident in yourself "
            "that the rules adapt to fit you")

def first_src(code):
    raw = open(f"/home/z/my-project/scripts/extract_out/{code}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["srcs"][0]

NEW = [
    # (url, title, author, extract_json, badge)
    ("https://www.threads.com/share/BAWFhNMwp4/", "", "@unknown",
     "BAWFhNMwp4_try2", "SWAG"),
    ("https://www.threads.com/share/BAD7RdF75N/", LESYA_EN, "@lesya.neuro",
     "BAD7RdF75N", "SWAG"),
]

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header == ["url", "title", "author", "utm_code", "video_url", "boost_until", "badge"], header

existing_urls = {r[0] for r in rows[1:]}
added = []
for url, title, author, src_json, badge in NEW:
    if url in existing_urls:
        print("skip (уже есть):", url)
        continue
    vurl = first_src(src_json)
    row = [url, clean(title), author, nanoid(), vurl, "", badge]
    rows.append(row)
    added.append((row[3], author, badge))

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
for utm, a, b in added:
    print(f"  + {utm} {a} badge={b}")
