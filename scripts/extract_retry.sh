#!/bin/bash
# Извлечение с ретраями и детектом логин-стены.
# Стена: title содержит "Join Threads" (ambient-видео стены может отдавать srcs!)
# Usage: extract_retry.sh <code> [<code>...]
WALL_MARK="Join Threads"
WALL_SRC_MARK="AQP6y_fIpdO4"
for CODE in "$@"; do
  URL="https://www.threads.com/share/$CODE/"
  OUT="scripts/extract_out/$CODE.json"
  OK=0
  for ATTEMPT in 1 2 3 4 5 6; do
    agent-browser close >/dev/null 2>&1
    sleep 2
    bash scripts/extract_post.sh "$URL" "$OUT" >/dev/null 2>&1
    RES=$(python3 - "$OUT" "$WALL_MARK" "$WALL_SRC_MARK" <<'PYEOF'
import json, sys
try:
    raw = open(sys.argv[1]).read().strip()
    d = json.loads(json.loads(raw))
except Exception as e:
    print("PARSE_ERR"); sys.exit()
srcs = d.get("srcs") or []
title = d.get("title", "")
if sys.argv[2] in title:
    print("WALL_TITLE"); sys.exit()
if srcs and any(sys.argv[3] in s for s in srcs):
    print("WALL_AMBIENT"); sys.exit()
if not srcs:
    print("NO_SRCS"); sys.exit()
print("OK")
PYEOF
)
    echo "[$CODE] attempt $ATTEMPT: $RES"
    if [ "$RES" = "OK" ]; then OK=1; break; fi
    sleep $((RANDOM % 4 + 2))
  done
  [ "$OK" = "1" ] && echo "[$CODE] SUCCESS" || echo "[$CODE] FAILED after retries"
done
