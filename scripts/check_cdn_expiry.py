"""Проверка протухания подписанных CDN-ссылок (oe= hex timestamp) в data/posts.csv."""
import csv, time, datetime, subprocess, sys

CSV = '/home/z/my-project/data/posts.csv'
now = time.time()

rows = list(csv.DictReader(open(CSV, encoding='utf-8')))
print(f"{'код':<10} {'автор':<22} {'oe= истекает':<22} {'статус'}")

expired, soon = [], []
for r in rows:
    url = r['video_url']
    code = r['utm_code']
    if not url:
        print(f"{code:<10} {r['author']:<22} {'—':<22} нет video_url (пропуск)")
        continue
    oe = None
    for part in url.split('&'):
        if part.startswith('oe='):
            oe = part[3:]
            break
    if not oe:
        print(f"{code:<10} {r['author']:<22} {'—':<22} нет oe= параметра")
        continue
    exp = int(oe, 16)
    dt = datetime.datetime.fromtimestamp(exp, datetime.timezone.utc)
    delta = exp - now
    hours = delta / 3600
    if delta <= 0:
        status = 'ПРОТУХЛА'
        expired.append(r)
    elif hours < 48:
        status = f'истекает через {hours:.0f}ч'
        soon.append(r)
    else:
        status = f'ок ({delta/86400:.1f} сут)'
    print(f"{code:<10} {r['author']:<22} {dt.strftime('%Y-%m-%d %H:%M'):<22} {status}")

# Живая проверка HTTP для первых нескольких ссылок (HEAD с Range, CDN любит Range)
print('\n--- Живая проверка CDN (HEAD, bytes=0-0) ---')
for r in rows[:4] + expired + soon:
    url = r['video_url']
    if not url:
        continue
    try:
        out = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L',
             '--max-time', '15', '-H', 'Range: bytes=0-0', url],
            capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception as e:
        out = f'ERR {e}'
    print(f"{r['utm_code']:<10} HTTP {out}")
