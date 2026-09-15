#!/usr/bin/env python3
"""Авто-джоба обновления подписанных CDN-ссылок video_url в data/posts.csv.

Ссылки Threads (scontent…cdninstagram.com, параметр oe=) живут ~1–2 недели.
Джоба:
  1. Читает data/posts.csv.
  2. Для строк, чья ссылка истекает раньше порога (--min-hours, по умолчанию 48),
     переоткрывает пост Threads через agent-browser и достаёт свежий MP4.
  3. Верифицирует новый URL Range-запросом (206 video/mp4) и пишет его в CSV.
  4. Порядок строк, utm-коды и boost_until сохраняются; mtime меняется —
     кэш csv.ts инвалидируется автоматически.

Запуск:  python3 scripts/refresh_links.py [--force] [--quiet] [--min-hours 48]
Блокировка: /tmp/nr_refresh.lock — параллельный запуск невозможен.
"""
import argparse
import csv
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "posts.csv")
LOCK_PATH = "/tmp/nr_refresh.lock"

AGENT_BROWSER_CANDIDATES = [
    shutil.which("agent-browser"),
    os.environ.get("AGENT_BROWSER_BIN"),
    "/home/z/.bun/install/global/node_modules/agent-browser/bin/agent-browser-linux-x64",
]

EVAL_JS = """(() => {
  const srcs = Array.from(document.querySelectorAll("video"))
    .map(v => v.src || (v.querySelector("source") && v.querySelector("source").src))
    .filter(Boolean);
  return JSON.stringify({ srcs });
})()"""


def ab_bin():
    for c in AGENT_BROWSER_CANDIDATES:
        if c and os.path.exists(c):
            return c
    return None


def ab(*args, timeout=40):
    binp = ab_bin()
    if not binp:
        raise RuntimeError("agent-browser не найден")
    r = subprocess.run([binp, *args], capture_output=True, text=True, timeout=timeout)
    return r.stdout.strip()


def extract_srcs(share_url):
    ab("open", share_url, timeout=45)
    try:
        ab("wait", "--load", "networkidle", timeout=30)
    except Exception:
        pass
    ab("wait", "4500")
    raw = ab("eval", EVAL_JS)
    try:
        d = json.loads(raw)
        if isinstance(d, str):
            d = json.loads(d)
        return d.get("srcs") or []
    except Exception:
        return []


def verify(url):
    try:
        out = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{content_type}",
             "-r", "0-1023", "--max-time", "20", url],
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()
        return out.startswith("206") and "video" in out
    except Exception:
        return False


def oe_expiry(video_url):
    m = re.search(r"(?:^|&)oe=([0-9a-fA-F]+)", video_url)
    if not m:
        return 0  # нет подписи — считаем протухшей, обновим
    return int(m.group(1), 16)


def acquire_lock():
    try:
        fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        return fd
    except FileExistsError:
        return None


def release_lock(fd):
    try:
        os.close(fd)
        os.remove(LOCK_PATH)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="обновить все ссылки, а не только истекающие")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--min-hours", type=float, default=48.0)
    ap.add_argument("--budget", type=float, default=0.0,
                    help="мягкий лимит времени в секундах (0 — без лимита)")
    args = ap.parse_args()

    log = (lambda *a: None) if args.quiet else (lambda *a: print(*a, flush=True))

    lock = acquire_lock()
    if lock is None:
        log("[refresh] уже запущена — выход")
        return 0

    try:
        return run(args, log)
    finally:
        release_lock(lock)


def run(args, log):
    csv_path = os.path.abspath(CSV_PATH)
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames or list(rows[0].keys())

    deadline = time.time() + args.budget if args.budget else float("inf")
    now = time.time()
    threshold = now + args.min_hours * 3600
    updated, failed, skipped, revived = 0, 0, 0, 0

    def save_rows():
        """Атомарная запись CSV (вызывается после каждого обновления —
        фоновый процесс может быть убит средой, работа не должна теряться)."""
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(csv_path), suffix=".tmp")
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        os.chmod(tmp, 0o644)  # mkstemp создаёт 0600 — возвращаем обычные права
        os.replace(tmp, csv_path)

    for row in rows:
        if time.time() > deadline:
            log(f"[refresh] бюджет {args.budget:.0f}с исчерпан — мягкий выход (прогресс сохранён)")
            break

        share_url = (row.get("url") or "").strip()
        video_url = (row.get("video_url") or "").strip()
        if not share_url or "threads.com" not in share_url:
            skipped += 1
            continue

        exp = oe_expiry(video_url) if video_url else 0
        if video_url and exp > threshold and not args.force:
            skipped += 1
            continue

        left_h = (exp - now) / 3600 if exp else float("-inf")
        log(f"[refresh] {row['utm_code']}: ссылка {'истекла' if exp and exp <= now else f'истекает через {left_h:.0f}ч'} — обновляю…")

        try:
            srcs = extract_srcs(share_url)
        except Exception as e:
            log(f"[refresh] {row['utm_code']}: ОШИБКА извлечения ({e})")
            failed += 1
            time.sleep(1.5)
            continue

        new_url = ""
        for s in srcs:
            if verify(s):
                new_url = s
                break

        if not new_url:
            log(f"[refresh] {row['utm_code']}: рабочей ссылки не найдено ({len(srcs)} кандидатов) — оставляю старую")
            failed += 1
        else:
            if new_url != video_url:
                row["video_url"] = new_url
                updated += 1
                if not video_url:
                    revived += 1
                save_rows()  # инкрементально: убитый процесс = потерянные секунды, не часы
                log(f"[refresh] {row['utm_code']}: OK ({'оживлена' if not video_url else 'обновлена'}), сохранено {updated}/{len(rows)}")
            else:
                log(f"[refresh] {row['utm_code']}: ссылка не изменилась, оставляю")
        time.sleep(1.2)

    log(f"[refresh] итог: обновлено {updated}, оживлено {revived}, пропущено {skipped}, ошибок {failed}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
