#!/usr/bin/env python3
"""Батч 4 (задача 13): +7 строк в data/posts.csv, новая колонка badge.
BAEmUmZUj_ и BAX0B8r7iC — badge=CREEPY. _4yIKMBXZ — недоступен (invalid_post),
строка с пустым video_url (в ленту не попадает, как BAaF-XGP8N ранее).
Колонки/порядок существующих строк сохраняются; boost_until не трогаем."""
import csv, secrets, string, sys

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def author_handle(a):
    # "/@themacrosift/post/DdHiDXaE9_f?xmt=..." -> "@themacrosift"
    if not a or "@" not in a:
        return "@unknown"
    seg = a.split("/@")[1].split("/")[0].split("?")[0]
    return f"@{seg}" if seg else "@unknown"

def clean(t):
    return " ".join((t or "").split())

# BAX0B8r7iC: русский заголовок -> английский (лента только EN с задачи 11)
XCV_EN = ("Amateur footage captured the entity known as the Mimic taking the form of a mother "
          "and attempting to control the children's minds. The children hid and reported it to the "
          "authorities. The tape was filed as case #018 and is being studied by Institute-95 "
          "specialists. Created with @higgsfield.ai #xcvmind #higgsfield #ai #anomalyarchive")

NEW = [
    # (url, title, author, video_url, badge)
    ("https://www.threads.com/share/BAEmUmZUj_/", "", "@tremollo_ai",
     "video:BAEmUmZUj_", "CREEPY"),
    ("https://www.threads.com/share/BAPNTZ-xGs/",
     "~A STRANGE DAY IN THE NEIGHBORHOOD~ • Part 1: The Invitation #TheOtherNeighborhood #MakeBelieve #AIArt #SurrealCinema #MacroSift",
     "@themacrosift", "video:BAPNTZ-xGs", ""),
    ("https://www.threads.com/share/BAK6h933m-/",
     "the funniest video in the world 😅 #ai #teletubbies #aivideo #aiart #aiartist",
     "@mesutizm3437", "video:BAK6h933m-", ""),
    ("https://www.threads.com/share/_4yIKMBXZ/", "", "@unknown", "", ""),  # invalid_post на стороне Threads
    ("https://www.threads.com/share/BAZmyX2v0C/",
     "Good morning, my friends. Stay a little strange, a little graceful, and completely yourself. The future has enough copies already. #GoodMorningEveryone",
     "@themacrosift", "video:BAZmyX2v0C", ""),
    ("https://www.threads.com/share/BCJcGR3ZI1/",
     "Every man knows this feeling #aiartists #aiartwork #surreal #aiart #mrrelative",
     "@mr_relative_", "video:BCJcGR3ZI1", ""),
    ("https://www.threads.com/share/BAX0B8r7iC/", XCV_EN,
     "@xcvmind", "video:BAX0B8r7iC", "CREEPY"),
]

# video_url берём из extract_out/<code>.json (первый src)
import json, re
def first_src(code):
    raw = open(f"/home/z/my-project/scripts/extract_out/{code}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["srcs"][0]

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header[:6] == ["url", "title", "author", "utm_code", "video_url", "boost_until"], header
has_badge = len(header) > 6 and header[6] == "badge"
if not has_badge:
    header = header + ["badge"]
    for r in rows[1:]:
        while len(r) < 6:
            r.append("")
        r.append("")

existing_urls = {r[0] for r in rows[1:]}
added = []
for url, title, author, vref, badge in NEW:
    if url in existing_urls:
        print("skip (уже есть):", url)
        continue
    vurl = first_src(vref.split(":")[1]) if vref else ""
    row = [url, clean(title), author, nanoid(), vurl, "", badge]
    rows.append(row)
    added.append((row[3], author, badge, "OK" if vurl else "NO-VIDEO"))

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
for utm, a, b, st in added:
    print(f"  + {utm} {a} badge={b or '-'} [{st}]")
