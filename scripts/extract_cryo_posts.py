#!/usr/bin/env python3
"""Cryo-Stop (task 41): извлечение MP4-ссылок двух тестовых постов.
_-1iqf_ZY (swag) и BASOpVqCBm (creepy) — через agent-browser,
методика scripts/refresh_links.py (открыть пост → собрать video.src →
верифицировать Range-запросом). Результат — JSON в stdout."""
import json
import shutil
import subprocess
import sys
import os

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


def ab(*args, timeout=40):
    binp = next((c for c in AGENT_BROWSER_CANDIDATES if c and os.path.exists(c)), None)
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


POSTS = [
    ("https://www.threads.com/share/_-1iqf_ZY/", "swag"),
    ("https://www.threads.com/share/BASOpVqCBm/", "creepy"),
]

result = {}
for url, tag in POSTS:
    code = url.rstrip("/").rsplit("/", 1)[-1]
    try:
        srcs = extract_srcs(url)
    except Exception as e:
        result[code] = {"tag": tag, "error": str(e), "ok": False}
        continue
    good = next((s for s in srcs if verify(s)), "")
    result[code] = {
        "tag": tag,
        "ok": bool(good),
        "video_url": good,
        "candidates": len(srcs),
    }
    print(f"[{tag}] {code}: {'OK' if good else 'FAIL'} ({len(srcs)} кандидатов)", file=sys.stderr)

print(json.dumps(result, indent=2, ensure_ascii=False))
