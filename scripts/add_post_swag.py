#!/usr/bin/env python3
"""Батч 5 (задача 14): +1 строка в data/posts.csv — __FJdFasi (@regina.timer)
с анимированным бейджем SWAG (puf-дым + 3D).
Заголовок на русском переведён на EN (лента только английская с задачи 11).
Колонки/порядок существующих строк сохраняются; boost_until не трогаем."""
import csv, secrets, string, json, sys

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

# Русский оригинал:
# "Я начинающий ai-креатор и это мой первый ролик в реализме ✨
#  Буду благодарна поддержке лайками на этом не простом, но таком красивом пути 🥰"
TITLE_EN = ("I'm a beginner AI creator and this is my first realistic video ✨ "
            "I'd really appreciate your support with likes on this challenging but beautiful journey 🥰")

URL = "https://www.threads.com/share/__FJdFasi/"
AUTHOR = "@regina.timer"
BADGE = "SWAG"

def first_src(code):
    raw = open(f"/home/z/my-project/scripts/extract_out/{code}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["srcs"][0]

vurl = first_src("__FJdFasi_try3")

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header == ["url", "title", "author", "utm_code", "video_url", "boost_until", "badge"], header

existing_urls = {r[0] for r in rows[1:]}
if URL in existing_urls:
    print("skip (уже есть):", URL)
    sys.exit(0)

row = [URL, clean(TITLE_EN), AUTHOR, nanoid(), vurl, "", BADGE]
rows.append(row)

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
print(f"  + {row[3]} {AUTHOR} badge={BADGE} video={'OK' if vurl else 'NO-VIDEO'}")
