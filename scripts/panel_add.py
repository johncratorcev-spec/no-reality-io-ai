#!/usr/bin/env python3
"""Панель управления (Task 21): асинхронная джоба добавления поста в ленту.

Шаги: нормализация ссылки → dedupe → (кэш или извлечение через extract_post.sh,
до 3 попыток с wall-детектом) → верификация видео (206 video/mp4) → строка в
CSV → снапшот ленты. Прогресс пишется в scripts/panel_jobs/<jobid>.json
(атомарно), stdout дублируется в <jobid>.log.

Usage: panel_add.py --url <url> --badge <badge> [--title <override>] --job <id>
"""
import argparse, csv, json, os, re, secrets, string, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "posts.csv"
EXT = ROOT / "scripts" / "extract_out"
JOBS = ROOT / "scripts" / "panel_jobs"
ALPHABET = string.ascii_letters + string.digits + "-_"
BADGES = {"", "SWAG", "WELCOME TO THE FUTURE", "CREEPY", "ROCKET SCIENCE"}
WALL_TITLE = "Join Threads"
WALL_AMBIENT = "AQP6y_fIpdO4"
CODE_RE = re.compile(r"^[A-Za-z0-9_-]{5,}$")

S = {
    "id": "", "code": "", "badge": "", "state": "running",
    "log": [], "error": None, "result": None, "ts": int(time.time()),
}

def save():
    JOBS.mkdir(parents=True, exist_ok=True)
    tmp = JOBS / f"{S['id']}.json.tmp"
    tmp.write_text(json.dumps(S, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, JOBS / f"{S['id']}.json")

def log(msg):
    S["log"].append(msg)
    print(f"[panel] {msg}", flush=True)
    save()

def fail(msg):
    S["state"] = "error"
    S["error"] = msg
    log(f"ОШИБКА: {msg}")
    save()

def nanoid(n=8):
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def clean(t):
    return " ".join((t or "").split())

def parse_code(raw: str):
    """share-URL, /post/-URL или голый код → (code, url)."""
    s = (raw or "").strip()
    if "/" not in s and CODE_RE.match(s):
        return s, f"https://www.threads.com/share/{s}/"
    p = urlparse(s if "://" in s else f"https://{s}")
    segs = [x for x in p.path.split("/") if x]
    if not segs:
        return None, None
    code = segs[-1]
    if not CODE_RE.match(code):
        return None, None
    if "/post/" in p.path:
        return code, f"https://www.threads.com{p.path}"
    return code, f"https://www.threads.com/share/{code}/"

def read_csv_rows():
    with open(CSV, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))

def is_dupe(rows, code):
    return any(
        (f"/share/{code}/" in r[0]) or (f"/post/{code}" in r[0]) for r in rows[1:]
    )

def parse_extract(path: Path):
    """JSON из extract_post.sh (двойное кодирование) → dict или None."""
    try:
        raw = path.read_text(encoding="utf-8").strip()
        d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
        return d if isinstance(d, dict) else None
    except Exception:
        return None

def extract_ok(d) -> str:
    """OK | WALL | WALL_AMBIENT | NO_SRCS."""
    srcs = d.get("srcs") or []
    title = d.get("title", "") or ""
    if WALL_TITLE in title:
        return "WALL"
    if srcs and any(WALL_AMBIENT in s for s in srcs):
        return "WALL_AMBIENT"
    if not srcs:
        return "NO_SRCS"
    return "OK"

def extract(code, url) -> bool:
    """Извлечение: кэш .ok или до 3 попыток extract_post.sh с паузами."""
    json_path = EXT / f"{code}.json"
    ok_marker = EXT / f"{code}.json.ok"
    if json_path.exists() and ok_marker.exists():
        d = parse_extract(json_path)
        if d and extract_ok(d) == "OK":
            log("кэш извлечения найден — открывать Threads не нужно")
            return True
        log("кэш извлечения битый — извлекаю заново")

    for attempt in range(1, 4):
        log(f"извлекаю данные поста (попытка {attempt}/3)…")
        subprocess.run(["agent-browser", "close"], capture_output=True, timeout=30)
        time.sleep(2)
        try:
            subprocess.run(
                ["bash", str(ROOT / "scripts" / "extract_post.sh"), url, str(json_path)],
                capture_output=True, timeout=150,
            )
        except subprocess.TimeoutExpired:
            log("браузер завис — перезапускаю попытку")
            continue
        d = parse_extract(json_path)
        res = extract_ok(d) if d else "PARSE_ERR"
        if res == "OK":
            ok_marker.touch()
            log("пост открыт, видео найдено")
            return True
        if res in ("WALL", "WALL_AMBIENT"):
            log("логин-стена Threads" + (" (ambient)" if res == "WALL_AMBIENT" else ""))
        elif res == "NO_SRCS":
            log("пост не отдал видео: недоступен (удалён/подписчики/регион) или нет видео")
        else:
            log("не удалось разобрать ответ страницы")
        if attempt < 3:
            log("ретрай через 15с…")
            time.sleep(15)
    return False

def verify_video(video_url) -> str:
    """Range-запрос → '206 video/mp4' или пустая строка."""
    try:
        out = subprocess.run(
            ["curl", "-s", "-r", "0-1023", "-o", "/dev/null",
             "-w", "%{http_code} %{content_type}", "--max-time", "30", video_url],
            capture_output=True, text=True, timeout=40,
        )
        return out.stdout.strip()
    except Exception:
        return ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--badge", default="")
    ap.add_argument("--title", default="")
    ap.add_argument("--job", required=True)
    args = ap.parse_args()
    S["id"] = args.job
    S["badge"] = args.badge

    lock = JOBS / ".lock"
    JOBS.mkdir(parents=True, exist_ok=True)
    if lock.exists():
        age = time.time() - lock.stat().st_mtime
        if age < 900:
            fail("другая задача ещё выполняется — дождись её завершения")
            return
        lock.rmdir()  # протухший лок (>15 мин)
    lock.mkdir()
    try:
        run(args)
    except Exception as e:
        fail(f"внутренняя ошибка: {e}")
    finally:
        if lock.exists():
            lock.rmdir()
        save()

def run(args):
    if args.badge not in BADGES:
        fail("неизвестный бейдж")
        return

    code, url = parse_code(args.url)
    if not code:
        fail("не понял ссылку — вставь ссылку на пост Threads или голый код")
        return
    S["code"] = code
    log(f"код поста: {code}")

    rows = read_csv_rows()
    if is_dupe(rows, code):
        fail("этот пост уже в ленте")
        return

    if not extract(code, url):
        fail("Threads не отдал пост после 3 попыток (логин-стена или пост "
             "недоступен). Попробуй ещё раз позже — кэш извлечения ускорит успех")
        return

    d = parse_extract(EXT / f"{code}.json") or {}
    video_url = (d.get("srcs") or [""])[0]

    log("проверяю CDN-ссылку видео (206 video/mp4)…")
    verdict = verify_video(video_url)
    if not verdict.startswith("206") or "video" not in verdict:
        fail(f"CDN не отдал видео ({verdict or 'нет ответа'}) — ссылка протухла, "
             "повтори добавление")
        return
    log(f"видео ок: {verdict}")

    m = re.search(r"/@([A-Za-z0-9_.]+)/post/", d.get("author") or "")
    author = f"@{m.group(1)}" if m else "@unknown"
    title = clean(args.title) or clean(d.get("title") or "")
    if not args.title and re.search(r"[а-яё]", title, re.I):
        fail(f"в посте русский заголовок — лента англоязычная. Впиши свой "
             f"перевод в поле «Свой заголовок» и отправь ещё раз (извлечение "
             f"уже закэшировано). Оригинал: {title[:120]}")
        return
    if not title:
        log("у поста нет описания — добавляю без заголовка (как hMKB_IqJ)")

    rows = read_csv_rows()
    if is_dupe(rows, code):
        fail("этот пост уже в ленте (добавился, пока шло извлечение)")
        return
    utm = nanoid()
    rows.append([url, title, author, utm, video_url, "", args.badge, ""])
    with open(CSV, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    log(f"строка добавлена в CSV (utm {utm}), постов: {len(rows) - 1}")

    log("обновляю снапшот ленты…")
    r = subprocess.run(["node", str(ROOT / "scripts" / "gen-posts-snapshot.mjs")],
                       capture_output=True, text=True, timeout=90)
    if r.returncode != 0:
        fail("снапшот не обновился — CSV записан, лента подхватит при следующем билде")
        return
    log("готово — пост в ленте")

    S["state"] = "done"
    S["result"] = {
        "code": code, "utm": utm, "author": author,
        "title": title[:200], "badge": args.badge, "video": verdict,
    }
    save()

if __name__ == "__main__":
    main()
