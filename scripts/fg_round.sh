#!/bin/bash
# Один foreground-раунд извлечения: по 1 попытке на каждый код без .ok-маркера,
# 60с пауза между кодами. Вызывается повторно до успеха всех кодов.
CODES="$*"
for C in $CODES; do
  [ -f "scripts/extract_out/$C.json.ok" ] && continue
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
  echo "[$(date +%H:%M:%S)] $C: $RES"
  [ "$RES" = "OK" ] && touch "scripts/extract_out/$C.json.ok"
  PEND=$(for X in $CODES; do [ -f "scripts/extract_out/$X.json.ok" ] || echo -n "$X "; done)
  [ -n "${PEND// /}" ] && sleep 60
done
echo "round done: $(for X in $CODES; do [ -f "scripts/extract_out/$X.json.ok" ] && echo -n "$X "; done)"
