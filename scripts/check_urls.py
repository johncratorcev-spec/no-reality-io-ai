#!/usr/bin/env python3
"""Проверка живости всех видео-URL в data/posts.csv.
Threads CDN отдаёт подписанные URL с истекающим сроком (параметр oe=hex-timestamp).
Живой URL: HTTP 206/200 с video/mp4. Мёртвый: 403/404 или сеть.
Результат: scripts/url_check_report.json
"""
import csv, json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

CSV = "data/posts.csv"
OUT = "scripts/url_check_report.json"


def check(row):
    url = (row.get("video_url") or "").strip()
    code = (row.get("utm_code") or "").strip()
    pin = (row.get("pin") or "").strip()
    title = (row.get("title") or "").strip()[:60]
    if not url:
        return {"code": code, "pin": pin, "title": title, "status": "EMPTY"}
    # -r 0-1023: лёгкий range-GET, CDN отвечает 206 если подпись жива
    try:
        p = subprocess.run(
            ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code} %{content_type}",
             "-r", "0-1023", "--max-time", "20", "-A", "Mozilla/5.0", url],
            capture_output=True, text=True, timeout=30,
        )
        out = (p.stdout or "").strip()
        code_http = out.split(" ")[0] if out else "ERR"
        ctype = out.split(" ", 1)[1] if " " in out else ""
        ok = code_http in ("200", "206") and "video" in ctype
        return {"code": code, "pin": pin, "title": title, "status": code_http,
                "ctype": ctype, "alive": ok}
    except Exception as e:
        return {"code": code, "pin": pin, "title": title, "status": "ERR",
                "error": str(e)[:120], "alive": False}


def main():
    with open(CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"постов в CSV: {len(rows)}", flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(check, rows))

    dead = [r for r in results if not r.get("alive")]
    alive = [r for r in results if r.get("alive")]
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total": len(results),
        "alive": len(alive),
        "dead": len(dead),
        "dead_list": dead,
        "all": results,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n=== ЖИВЫХ: {len(alive)} / МЁРТВЫХ: {len(dead)} ===")
    for r in dead:
        print(f"  DEAD pin={r.get('pin') or '-':>2} {r['code']:<10} "
              f"[{r.get('status')}] {r.get('title', '')}")
    # отдельно подсветить пины 1-2 (коллаборация + донат)
    for r in results:
        if r.get("pin") in ("1", "2"):
            mark = "OK " if r.get("alive") else "DEAD"
            print(f"  PIN{r['pin']}: {mark} {r['code']} [{r.get('status')}] {r.get('title','')}")


if __name__ == "__main__":
    sys.exit(main())
