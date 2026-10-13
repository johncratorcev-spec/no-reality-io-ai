#!/usr/bin/env bash
# v22: извлечение 9 Threads-постов для раффлов raffle-05..13.
# share-ссылку открываем сразу в agent-browser (редирект JS-ом) →
# canonical URL + og:description + автор + <video> mp4 ИЛИ фото-карусель.
set -u
OUT=/tmp/threads9
mkdir -p "$OUT"

LINKS=(
  "https://www.threads.com/share/BAgATO_vRh/"
  "https://www.threads.com/share/BAu3KK4_L9/"
  "https://www.threads.com/share/BBoN1LcYAl/"
  "https://www.threads.com/share/BAXhh5JpjK/"
  "https://www.threads.com/share/BAWfah2971/"
  "https://www.threads.com/share/BAUB2A0peE/"
  "https://www.threads.com/share/BAOv9fmMBa/"
  "https://www.threads.com/share/BAE5napSO3/"
  "https://www.threads.com/share/BBWx_CXVdx/"
)

i=0
for share in "${LINKS[@]}"; do
  i=$((i+1))
  echo "=== [$i] $share"
  agent-browser open "$share" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  sleep 3
  agent-browser eval "(()=>{const v=document.querySelector('video');const og=document.querySelector('meta[property=\"og:description\"]');const t=document.querySelector('meta[property=\"og:title\"]');const imgs=[...document.querySelectorAll('img')].map(im=>im.src).filter(s=>s.includes('scontent')&&!s.includes('profile_pic')&&s.includes('.jpg')===false||s.includes('scontent')&&s.includes('.jpg'));const im=[...document.querySelectorAll('img')].map(im=>im.src).filter(s=>s.includes('cdninstagram')||s.includes('fbcdn'));return JSON.stringify({u:location.href.split('?')[0],d:og?og.content:'',t:t?t.content:'',v:v?(v.currentSrc||v.src):null,dur:v?(v.duration||0):0,w:v?(v.videoWidth||0):0,h:v?(v.videoHeight||0):0,imgs:im.slice(0,6)})})()" > "$OUT/meta_$i.json" 2>/dev/null
  python3 - "$i" <<'PY'
import json, sys, os
k = sys.argv[1]
raw = open(f"/tmp/threads9/meta_{k}.json").read().strip()
try:
    data = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
except Exception as e:
    print(f"    parse_error: {e}"); sys.exit(0)
print(f"    canonical: {data.get('u','')}")
print(f"    title    : {data.get('t','')[:80]}")
print(f"    caption  : {data.get('d','')[:110]}")
for im in (data.get("imgs") or [])[:4]:
    print(f"    img      : {im[:120]}")
if data.get("v"):
    print(f"    video    : {data.get('w')}x{data.get('h')} {data.get('dur',0):.1f}s url_len={len(data['v'])}")
    open(f"/tmp/threads9/vurl_{k}.txt","w").write(data["v"])
else:
    print("    no_video")
open(f"/tmp/threads9/cap_{k}.txt","w").write(data.get("d") or "")
open(f"/tmp/threads9/src_{k}.txt","w").write(data.get("u") or "")
open(f"/tmp/threads9/title_{k}.txt","w").write(data.get("t") or "")
open(f"/tmp/threads9/imgs_{k}.json","w").write(json.dumps(data.get("imgs") or []))
PY
done
echo "=== done"
