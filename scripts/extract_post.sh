#!/bin/bash
# Извлечение видео/автора/заголовка из Threads-поста через agent-browser.
# Usage: extract_post.sh <share_url> <out_json>
URL="$1"
OUT="$2"

agent-browser open "$URL"
agent-browser wait --load networkidle 2>/dev/null
agent-browser wait 5000

agent-browser eval '(() => {
  const srcs = Array.from(document.querySelectorAll("video")).map(v => v.src || (v.querySelector("source") && v.querySelector("source").src)).filter(Boolean);
  const a = Array.from(document.querySelectorAll("a")).map(x => x.getAttribute("href") || "").find(h => h.includes("/@"));
  const t = (document.querySelector("meta[property=\"og:description\"]") || {}).content || (document.querySelector("meta[name=\"description\"]") || {}).content || "";
  const ot = (document.querySelector("meta[property=\"og:title\"]") || {}).content || "";
  return JSON.stringify({ srcs: srcs, author: a, title: t.slice(0, 220), ogTitle: ot.slice(0, 120) });
})()' > "$OUT" 2>/dev/null

echo "--- saved: $OUT"
head -c 400 "$OUT"; echo
