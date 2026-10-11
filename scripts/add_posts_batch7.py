#!/usr/bin/env python3
"""Батч 7 (Task 18): +7 строк в data/posts.csv.
Бейджи: SWAG ×3 (_mUBnlbMn, BAX2daEsTs, _jRVFupZD), ROCKET SCIENCE (BBhhoOC9vb),
WELCOME TO THE FUTURE ×2 (BAeVwPvTJf, BAJE206f7E), CREEPY (BAi0MTP0NQ).
Идемпотентен (skip по url); коды без готового JSON пропускает до следующего запуска.
pin пуст — новые посты в конец ленты по score."""
import csv, secrets, string, json, os, sys, re

CSV = "/home/z/my-project/data/posts.csv"
EXT = "/home/z/my-project/scripts/extract_out"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

# (share_code, badge, title_override, author_override)
META = [
    ("_mUBnlbMn",  "SWAG",                   "", None),
    ("BBhhoOC9vb", "ROCKET SCIENCE",         "", None),
    ("BAX2daEsTs", "SWAG",                   "", None),
    ("_jRVFupZD",  "SWAG",                   "", None),
    ("BAeVwPvTJf", "WELCOME TO THE FUTURE",  "", None),
    ("BAi0MTP0NQ", "CREEPY",                 "", None),
    ("BAJE206f7E", "WELCOME TO THE FUTURE",  "", None),
    # Task 19
    ("BAVq1ma_VU", "ROCKET SCIENCE",
     "I'm a beginner AI creator and this is my first realistic video ✨ "
     "I'd really appreciate your support with likes on this challenging "
     "but beautiful journey 🥰", None),
    ("BBrK8muRRI", "SWAG",                   "", None),
    ("_gYuRN9lp",  "WELCOME TO THE FUTURE",  "", None),
    # Task 20: ROCKET SCIENCE переезжает сюда (у UkoN8r2X снят)
    ("_8h16T9aG",  "ROCKET SCIENCE",         "", None),
]

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header == ["url", "title", "author", "utm_code", "video_url", "boost_until", "badge", "pin"], header

existing_urls = {r[0] for r in rows[1:]}
added, missing = [], []
for code, badge, title_ovr, author_ovr in META:
    url = f"https://www.threads.com/share/{code}/"
    if url in existing_urls:
        print("skip (уже есть):", code)
        continue
    path = f"{EXT}/{code}.json"
    ok_marker = f"{path}.ok"
    if not (os.path.exists(path) and os.path.exists(ok_marker)):
        missing.append(code)
        continue
    try:
        raw = open(path).read().strip()
        d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    except Exception as e:
        print("PARSE_ERR:", code, e)
        missing.append(code)
        continue
    if not d.get("srcs"):
        print("NO_SRCS:", code)
        missing.append(code)
        continue
    author = author_ovr
    if not author:
        m = re.search(r"/@([A-Za-z0-9_.]+)/post/", d.get("author") or "")
        author = f"@{m.group(1)}" if m else "@unknown"
    title = title_ovr or clean(d.get("title") or "")
    # русский заголовок → EN (лента англоязычная)
    if re.search(r"[а-яё]", title, re.I):
        print(f"  !! RU title у {code}, нужен перевод вручную: {title[:80]}")
        sys.exit(1)
    row = [url, title, author, nanoid(), d["srcs"][0], "", badge, ""]
    rows.append(row)
    added.append((row[3], author, badge, code))

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
for utm, a, b, c in added:
    print(f"  + {utm} {a} badge={b} ({c})")
if missing:
    print("жду JSON:", ", ".join(missing))
