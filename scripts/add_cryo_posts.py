#!/usr/bin/env python3
"""Cryo-Stop (task 41): +2 тестовых поста в data/posts.csv.
_-1iqf_ZY — «Alien drip 👽» (badge SWAG), BASOpVqCBm — «Мимик»
(badge CREEPY, EN-перевод по конвенции translate_titles.py).
Оба с boost_until +48ч — тестовые карточки наверху ленты (после пинов).
Колонки существующих строк сохраняются (13 колонок)."""
import csv, secrets, string, datetime

CSV = "/home/z/my-project/data/posts.csv"
ALPHABET = string.ascii_letters + string.digits + "-_"

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

MIMIK_EN = ("Two weeks after the escape, Mimik was caught on tape by a random "
            "witness in Voronezh. The witness went missing — the tape was found "
            "at the scene and attached to the case file. The search for Mimik "
            "continues. Created with @higgsfield.ai")

def boost(hours):
    dt = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=hours)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

# (url, title, author, video_url_file, badge, boost_hours)
VIDEO_SWAG = ""
VIDEO_CREEPY = ""
import json
d = json.load(open("/home/z/my-project/scripts/extract_out/cryo_posts.json"))
VIDEO_SWAG = d["_-1iqf_ZY"]["video_url"]
VIDEO_CREEPY = d["BASOpVqCBm"]["video_url"]

NEW = [
    ("https://www.threads.com/share/_-1iqf_ZY/", "Alien drip 👽", "@unknown", VIDEO_SWAG, "SWAG", 48),
    ("https://www.threads.com/share/BASOpVqCBm/", MIMIK_EN, "@unknown", VIDEO_CREEPY, "CREEPY", 47),
]

with open(CSV, newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header = rows[0]
assert header == ["url", "title", "author", "utm_code", "video_url", "boost_until",
                  "badge", "pin", "is_paid", "price_usdt", "prompt_preview",
                  "seller_wallet", "media"], header

existing_urls = {r[0] for r in rows[1:]}
added = []
for url, title, author, vurl, badge, hours in NEW:
    if url in existing_urls:
        print("skip (уже есть):", url)
        continue
    row = [url, clean(title), author, nanoid(), vurl, boost(hours), badge,
           "", "", "", "", "", ""]
    rows.append(row)
    added.append((row[3], badge, title[:40]))

with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f, lineterminator="\n").writerows(rows)

print(f"строк всего: {len(rows) - 1} (без заголовка)")
for utm, b, t in added:
    print(f"  + {utm} badge={b} :: {t}")
