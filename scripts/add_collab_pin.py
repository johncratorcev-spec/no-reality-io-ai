#!/usr/bin/env python3
"""Task 33: закрепить BABB-GSGO9 (@pawcrewdaily, «Crypto trader cat has a bad
night 📉») на pin=1 — главный пост коллаборации. Существующие пины 1–7 → 2–8.
Верификация CDN перед записью. Кэш: scripts/extract_out/BABB-GSGO9.json."""
import csv
import json
import re
import secrets
import string
import subprocess
import sys

CSV = 'data/posts.csv'
CODE = 'BABB-GSGO9'
CANON = 'DdX3O2eEo-z'  # канонический ID поста @pawcrewdaily
TITLE = 'Crypto trader cat has a bad night 📉 @mmayrday'

# --- utm: 8 символов, как nanoid панели ---
ALPHABET = string.ascii_letters + string.digits + '-_'
UTM = ''.join(secrets.choice(ALPHABET) for _ in range(8))

# --- данные из кэша извлечения ---
d = json.load(open(f'scripts/extract_out/{CODE}.json', encoding='utf-8'))
video_url = d['srcs'][0]
m = re.search(r'/@([A-Za-z0-9_.]+)/', d.get('author') or '')
author = f'@{m.group(1)}' if m else '@unknown'
assert author == '@pawcrewdaily', f'неожиданный автор: {author}'

# --- верификация CDN ---
r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{content_type}',
                    '-r', '0-1023', '--max-time', '20', video_url],
                   capture_output=True, text=True, timeout=25)
verdict = r.stdout.strip()
print('CDN:', verdict)
if not verdict.startswith('206') or 'video' not in verdict:
    sys.exit(f'CDN не отдал видео: {verdict}')

# --- CSV: dedupe, пины, вставка ---
with open(CSV, newline='', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
if any(r['utm_code'] == UTM or CODE in r['url'] or CANON in r['url'] for r in rows):
    sys.exit('пост уже в CSV')
for r in rows:
    if r['pin'] and r['pin'].isdigit():
        r['pin'] = str(int(r['pin']) + 1)
new_row = {k: '' for k in fieldnames}
new_row.update({'url': f'https://www.threads.com/share/{CODE}/', 'title': TITLE,
                'author': author, 'utm_code': UTM, 'video_url': video_url, 'pin': '1'})
rows.insert(0, new_row)
with open(CSV, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator='\n')
    w.writeheader()
    w.writerows(rows)
print(f'CSV: {len(rows)} постов, {author}, utm {UTM}, pin 1 (старые 1–7 → 2–8)')
