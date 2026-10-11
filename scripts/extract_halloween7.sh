#!/usr/bin/env bash
# v18 rev2: извлечение 7 Threads-постов для Halloween Party фида.
# share-ссылку открываем сразу в agent-browser (редирект JS-ом) →
# location.href + og:title/og:description + первый <video> → download.
set -u
OUT=/tmp/halloween
mkdir -p "$OUT"

LINKS=(
  "https://www.threads.com/share/BAOoRL3aaK/"
  "https://www.threads.com/share/BABko5lY03/"
  "https://www.threads.com/share/BAkw3M7Skl/"
  "https://www.threads.com/share/BBgaXYVElg/"
  "https://www.threads.com/share/_1x-UrjnC/"
  "https://www.threads.com/share/BAXtvYGqHB/"
  "https://www.threads.com/share/BBLXCZRYiM/"
)

i=0
for share in "${LINKS[@]}"; do
  i=$((i+1))
  echo "=== [$i] $share"
  agent-browser open "$share" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  sleep 3
  agent-browser eval "(()=>{const v=document.querySelector('video');const og=document.querySelector('meta[property=\"og:description\"]');return JSON.stringify({u:location.href.split('?')[0],d:og?og.content:'',url:v?(v.currentSrc||v.src):null,dur:v?(v.duration||0):0,w:v?(v.videoWidth||0):0,h:v?(v.videoHeight||0):0})})()" > "$OUT/meta_$i.json" 2>/dev/null
  python3 - "$i" <<'PY'
import json, sys, subprocess, os
k = sys.argv[1]
raw = open(f"/tmp/halloween/meta_{k}.json").read().strip()
try:
    data = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
except Exception as e:
    print(f"    parse_error: {e}"); sys.exit(0)
print(f"    canonical: {data.get('u','')}")
print(f"    caption  : {data.get('d','')[:110]}")
if not data.get("url"):
    print("    no_video"); sys.exit(0)
print(f"    video    : {data.get('w')}x{data.get('h')} {data.get('dur',0):.1f}s url_len={len(data['url'])}")
open(f"/tmp/halloween/vurl_{k}.txt","w").write(data["url"])
open(f"/tmp/halloween/cap_{k}.txt","w").write(data.get("d") or "")
open(f"/tmp/halloween/src_{k}.txt","w").write(data.get("u") or "")
subprocess.run(["curl","-s","--max-time","120","-o",f"/tmp/halloween/clip_{k}.mp4",data["url"]],check=False)
sz = os.path.getsize(f"/tmp/halloween/clip_{k}.mp4")
print(f"    downloaded: {sz} bytes")
# Range-проба (сервер обязан отдавать 206 — так работает наш прокси)
if sz > 0:
    u = data["url"]
    r = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code} %{size_download}",
                        "-H","Range: bytes=0-1023","--max-time","30",u],capture_output=True,text=True)
    print(f"    range-probe: {r.stdout.strip()}")
PY
done
echo "=== done"; ls -la "$OUT"
