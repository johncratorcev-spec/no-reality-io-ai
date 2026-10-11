#!/usr/bin/env python3
"""Full CDN freshness audit: every video_url in data/posts.csv -> expect 206 video/mp4."""
import csv
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

CSV = 'data/posts.csv'


def check(row):
    code, url = row['utm_code'], row['video_url']
    if not url:
        return (code, 'NO-URL', '')
    try:
        r = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code} %{content_type}',
             '-r', '0-1023', '--max-time', '20', url],
            capture_output=True, text=True, timeout=25)
        out = r.stdout.strip()
        status = out.split(' ')[0] if out else 'EMPTY'
        ctype = out.split(' ', 1)[1] if ' ' in out else ''
        return (code, status, ctype)
    except Exception as e:
        return (code, 'ERR', str(e)[:40])


def main():
    with open(CSV, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    print(f'auditing {len(rows)} posts ...')
    bad = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(check, rows))
    for code, status, ctype in results:
        ok = status == '206' and ctype.startswith('video/mp4')
        mark = 'OK ' if ok else 'BAD'
        print(f'{mark} {code} {status} {ctype}')
        if not ok:
            bad.append((code, status, ctype))
    print(f'\nTOTAL {len(rows)} | OK {len(rows) - len(bad)} | BAD {len(bad)}')
    if bad:
        print('FAILED:', bad)
        sys.exit(1)


if __name__ == '__main__':
    main()
