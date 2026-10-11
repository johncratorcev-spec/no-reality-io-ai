#!/usr/bin/env python3
"""Батч 7 (задача 17): +3 видео @themacrosift с бейджем WELCOME TO THE FUTURE
(3D-тарелка НЛО) и пинами на места 2/3/4. Новая колонка pin (абсолютный слот):
pin=1 @popaistudio1 (остаётся #1 навсегда + перламутр — boost продлён),
pin=2/3/4 новые видео, pin=5 @the_fawkeskin (смещён со #2 на #5, boost продлён).
Колонки/порядок остальных строк сохраняются."""
import csv, secrets, string, json

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

BADGE = "WELCOME TO THE FUTURE"
BOOST_LONG = "2027-09-11T07:00:00.000Z"  # продление буста для пинов 1 и 5

NEW = [
    # (url, title, author, extract_json, pin)
    ("https://www.threads.com/share/BAz5g1VlT2/",
     "Goodnight, everyone. Rest well. 🙏🏽 #GoodnightEveryone",
     "@themacrosift", "BAz5g1VlT2", 2),
    ("https://www.threads.com/share/BAYVUvjsjW/",
     "Goodnight, my friends. Rest well. 🙏🏽 #GoodnightEveryone",
     "@themacrosift", "BAYVUvjsjW", 3),
    ("https://www.threads.com/share/BAUa9v7bzp/",
     "Goodnight, my friends. Rest well. 🙏🏽 #GoodnightEveryone",
     "@themacrosift", "BAUa9v7bzp", 4),
]

def first_src(code):
    raw = open(f"/home/z/my-project/scripts/extract_out/{code}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["srcs"][0]

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header[:7] == ["url", "title", "author", "utm_code", "video_url", "boost_until", "badge"], header

# 1) колонка pin, если её ещё нет
if len(header) < 8 or header[7] != "pin":
    header = header + ["pin"]
    for r in rows[1:]:
        while len(r) < 7:
            r.append("")
        r.append("")
    rows[0] = header  # ВАЖНО: мутируем именно rows[0], а не локальную копию

by_code = {r[3]: r for r in rows[1:]}

# 2) пины существующих строк + продление буста (перламутр остаётся)
by_code["AOABUGXd"][7] = "1"   # @popaistudio1 — слот #1
by_code["AOABUGXd"][5] = BOOST_LONG
by_code["wcDJIxC1"][7] = "5"   # @the_fawkeskin — смещён на слот #5
by_code["wcDJIxC1"][5] = BOOST_LONG

# 3) новые строки
existing_urls = {r[0] for r in rows[1:]}
for url, title, author, src_json, pin in NEW:
    if url in existing_urls:
        print("skip (уже есть):", url)
        continue
    row = [url, clean(title), author, nanoid(), first_src(src_json), "", BADGE, str(pin)]
    rows.append(row)
    print(f"  + {row[3]} {author} badge=UFO pin={pin}")

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
