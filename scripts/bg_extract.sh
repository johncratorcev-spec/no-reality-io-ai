#!/bin/bash
# Фоновый ретрай извлечения с длинными паузами (обход троттлинга Threads).
# Лог: scripts/extract_out/bg_retry.log
LOG="scripts/extract_out/bg_retry.log"
CODES="$*"
echo "[$(date +%H:%M:%S)] bg retry start: $CODES" >> "$LOG"
for ROUND in $(seq 1 10); do
  PENDING=""
  for C in $CODES; do
    # код готов, если есть OK-файл-маркер
    if [ -f "scripts/extract_out/$C.json.ok" ]; then continue; fi
    PENDING="$PENDING $C"
  done
  [ -z "${PENDING// /}" ] && { echo "[$(date +%H:%M:%S)] ALL DONE" >> "$LOG"; break; }
  for C in $PENDING; do
    agent-browser close >/dev/null 2>&1
    sleep 2
    bash scripts/extract_post.sh "https://www.threads.com/share/$C/" "scripts/extract_out/$C.json" >/dev/null 2>&1
    RES=$(python3 - "scripts/extract_out/$C.json" <<'PYEOF'
import json, sys
try:
    raw = open(sys.argv[1]).read().strip()
    d = json.loads(json.loads(raw))
except Exception:
    print("PARSE_ERR"); sys.exit()
srcs = d.get("srcs") or []
title = d.get("title", "")
if "Join Threads" in title: print("WALL"); sys.exit()
if srcs and any("AQP6y_fIpdO4" in s for s in srcs): print("WALL_AMBIENT"); sys.exit()
if not srcs: print("NO_SRCS"); sys.exit()
print("OK")
PYEOF
)
    echo "[$(date +%H:%M:%S)] round $ROUND $C: $RES" >> "$LOG"
    if [ "$RES" = "OK" ]; then touch "scripts/extract_out/$C.json.ok"; fi
    sleep $((RANDOM % 61 + 90))
  done
done
echo "[$(date +%H:%M:%S)] bg retry exit" >> "$LOG"
