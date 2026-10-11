#!/usr/bin/env python3
"""Добивание 4 мёртвых постов: share-страница отдаёт 0 <video>.
Приём из Task 33 (pin1): share HTML → canonical (@author/post/XXX) →
открываем КАНОНИЧЕСКУЮ страницу поста → <video> srcs → верификация 206.
Фоллбэк: SSR-HTML канонической страницы → регэксп mp4-ссылок.
Результат пишется прямо в data/posts.csv (атомарно, только video_url).
"""
import csv, json, os, re, subprocess, sys, tempfile, time

CSV_PATH = "data/posts.csv"
DEAD = ["y7KQ3mNc", "M4uledti", "ZKiccR64", "Ekxi_A6H"]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

EVAL_JS = """(() => {
  const srcs = Array.from(document.querySelectorAll("video"))
    .map(v => v.src || (v.querySelector("source") && v.querySelector("source").src))
    .filter(Boolean);
  return JSON.stringify({ srcs, title: document.title.slice(0, 100) });
})()"""


def sh(args, timeout=40, inp=None):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, input=inp)


def canonical_from_share(share_url):
    """SSR-мета share-страницы → canonical URL поста."""
    p = sh(["curl", "-sS", "--max-time", "25", "-A", UA, share_url], timeout=35)
    html = p.stdout or ""
    for pat in [
        r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"',
        r'<meta[^>]+property="og:url"[^>]+content="([^"]+)"',
        r'<meta[^>]+property="al:android:url"[^>]+content="([^"]+)"',
    ]:
        m = re.search(pat, html)
        if m:
            return m.group(1).replace("&amp;", "&"), len(html)
    return "", len(html)


def browser_srcs(page_url):
    """Открываем страницу в agent-browser, собираем <video> srcs."""
    subprocess.run(["agent-browser", "close"], capture_output=True, timeout=20)
    time.sleep(1.5)
    subprocess.run(["agent-browser", "open", page_url], capture_output=True, timeout=50)
    try:
        subprocess.run(["agent-browser", "wait", "--load", "networkidle"],
                       capture_output=True, timeout=35)
    except Exception:
        pass
    subprocess.run(["agent-browser", "wait", "4500"], capture_output=True, timeout=20)
    r = subprocess.run(["agent-browser", "eval", EVAL_JS],
                       capture_output=True, text=True, timeout=45)
    try:
        d = json.loads(json.loads(r.stdout.strip()))
        return d.get("srcs") or [], d.get("title", "")
    except Exception:
        return [], ""


def ssr_mp4(page_url):
    """Фоллбэк: mp4-ссылки прямо из SSR-HTML канонической страницы."""
    p = sh(["curl", "-sS", "--max-time", "25", "-A", UA, page_url], timeout=35)
    urls = re.findall(r'https://scontent[^"\\]+?\.mp4[^"\\]*', p.stdout or "")
    return [u.replace("\\u0026", "&").replace("\\/", "/") for u in urls]


def verify(url):
    try:
        out = sh(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code} %{content_type}",
                  "-r", "0-1023", "--max-time", "20", "-A", UA, url], timeout=30).stdout.strip()
        ok = out.startswith("206") and "video" in out
        print(f"      verify: [{out}] → {'OK' if ok else 'FAIL'}")
        return ok
    except Exception:
        return False


def save_csv(updates):
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fn = rows[0].keys()
    n = 0
    for r in rows:
        code = r["utm_code"]
        if code in updates and updates[code] != r["video_url"]:
            r["video_url"] = updates[code]
            n += 1
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(CSV_PATH) or ".", suffix=".tmp")
    with os.fdopen(fd, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fn, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    os.chmod(tmp, 0o644)
    os.replace(tmp, CSV_PATH)
    return n


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = {r["utm_code"]: r for r in csv.DictReader(f)}

    updates = {}
    for code in DEAD:
        share = rows[code]["url"].strip()
        print(f"\n=== {code} ← {share}")
        canon, sz = canonical_from_share(share)
        print(f"  share HTML {sz}B, canonical: {canon or 'НЕ НАЙДЕН'}")
        if not canon:
            continue

        # путь 1: браузер на канонической странице
        srcs, title = browser_srcs(canon)
        print(f"  browser: {len(srcs)} srcs, title={title[:60]!r}")

        # путь 2: SSR-регэксп, если браузер пуст
        if not srcs:
            srcs = ssr_mp4(canon)
            print(f"  ssr-фоллбэк: {len(srcs)} кандидатов")

        good = ""
        for s in srcs:
            if verify(s):
                good = s
                break
        if good:
            updates[code] = good
            print(f"  ✓ НОВАЯ ССЫЛКА ({len(good)} симв.)")
        else:
            print("  ✗ не удалось оживить")
        time.sleep(1.5)

    if updates:
        n = save_csv(updates)
        print(f"\nCSV обновлён: {n} строк(и)")
    else:
        print("\nНи один пост не оживлён — нужна ручная разведка")
    return 0


if __name__ == "__main__":
    sys.exit(main())
