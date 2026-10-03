#!/usr/bin/env bash
# v16: извлечение видео из 5 Threads-постов для раффлов.
# Использует agent-browser (headless) для обхода JS-рендера Threads.
set -u
OUT=/tmp/raffle
mkdir -p "$OUT"

declare -A POSTS=(
  [1]="https://www.threads.com/@mmayrday/post/Dd_TT9UCOPT"
  [2]="https://www.threads.com/@namro_r/post/Dd_eyUxkafC"
  [3]="https://www.threads.com/@azed_ai/post/Dd_p_uKCmJc"
  [4]="https://www.threads.com/@igor_shikk/post/DeBFGjeEmUR"
  [5]="https://www.threads.com/@rizkyy.muhammadwiky/post/Dd_aKr5D5Bw"
)

for k in 2 3 4 5 1; do
  url="${POSTS[$k]}"
  echo "=== [$k] $url"
  agent-browser open "$url" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  sleep 2
  agent-browser get title 2>/dev/null | head -2 | sed 's/^/    title: /'
  agent-browser eval "(()=>{const v=document.querySelector('video');if(!v)return JSON.stringify({err:'no_video'});return JSON.stringify({url:v.currentSrc||v.src,dur:v.duration||0,w:v.videoWidth,h:v.videoHeight})})()" > "$OUT/meta_$k.json" 2>/dev/null
  python3 - "$k" <<'PY'
import json, sys, subprocess
k = sys.argv[1]
raw = open(f"/tmp/raffle/meta_{k}.json").read().strip()
try:
    data = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
except Exception as e:
    print(f"    parse_error: {e}"); sys.exit(0)
if "err" in data:
    print(f"    {data['err']} (гео-блок или нет видео)"); sys.exit(0)
url = data["url"]
print(f"    video: {data['w']}x{data['h']} {data['dur']:.1f}s url_len={len(url)}")
subprocess.run(["curl", "-s", "--max-time", "90", "-o", f"/tmp/raffle/clip_{k}.mp4", url], check=False)
import os
sz = os.path.getsize(f"/tmp/raffle/clip_{k}.mp4")
print(f"    downloaded: {sz} bytes -> clip_{k}.mp4")
PY
done
echo "=== done"; ls -la "$OUT"
