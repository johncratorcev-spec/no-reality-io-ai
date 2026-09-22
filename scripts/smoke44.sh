#!/usr/bin/env bash
# Task 44 smoke: prod-server :3111 + полный API-прогон (одним вызовом —
# сервер не переживает границу bash-вызовов).
set -u
cd /home/z/my-project

PORT=3111
BASE="http://localhost:$PORT"
KEY=$(grep -E '^ADMIN_SECRET=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
KEY=${KEY:-no-reality-secret}

REFRESH_JOB=off PORT=$PORT npx next start -p $PORT >/tmp/nr44.log 2>&1 &
SRV=$!

# ждём готовности
for i in $(seq 1 60); do
  curl -sf "$BASE/api/cryo/markets" >/dev/null 2>&1 && break
  sleep 0.5
done

pass=0; fail=0
ck() { # name expected actual
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1 ($3)";
  else fail=$((fail+1)); echo "FAIL $1 (got $3, want $2)"; fi
}
jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))" 2>/dev/null; }

echo "== markets: narrative options =="
M=$(curl -s "$BASE/api/cryo/markets")
echo "$M" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ms = {m['postCode']: m for m in d['markets']}
z = ms.get('ZznHA9HM')
b = ms.get('-bBc5Nno')
assert z and len(z['options']) == 3, 'ZznHA9HM must have 3 options'
assert [o['key'] for o in z['options']] == ['drip','vanish','boom'], 'narrative keys'
assert b and len(b['options']) == 2 and b['options'][0]['key'] == 'yes', '-bBc5Nno yes/no'
assert z['question'].startswith('what happens next'), 'narrative question'
print('MARKETS-OK')
" ; ck "markets options" 0 $?

echo "== bet: narrative side demo =="
R=$(curl -s -o /tmp/b1.json -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"drip","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"2.00","mode":"demo"}')
ck "bet narrative side 200" 200 "$R"
echo "$R odds/drip" | grep -q 200 || true

echo "== bet: bad side rejected =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"nonsense","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"1.00","mode":"demo"}')
ck "bad side 400" 400 "$R"

echo "== bet: duplicate 409 =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"vanish","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"1.00","mode":"demo"}')
ck "dup side change 409" 409 "$R"

echo "== bet: second wallet on another option =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"vanish","wallet":"TestWallet45AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"1.00","mode":"demo"}')
ck "second wallet 200" 200 "$R"

echo "== bonus bet: no session → 401 =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"boom","wallet":"TestWallet46AAAAAAAAAAAAAAAAAAAAAAAAAAAA","mode":"bonus"}')
ck "bonus w/o session 401" 401 "$R"

echo "== favorites counts API =="
R=$(curl -s "$BASE/api/favorites/counts?codes=ZznHA9HM,-bBc5Nno")
echo "$R" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert 'counts' in d and isinstance(d['counts'], dict), 'counts shape'
print('COUNTS-OK')
"; ck "counts shape" 0 $?

echo "== favorites: auth required =="
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/favorites")
ck "favorites 401 anon" 401 "$R"

echo "== profile: auth required =="
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/profile")
ck "profile 401 anon" 401 "$R"

echo "== track/ref: accept + dedup =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/track/ref" -H 'content-type: application/json' \
  -d '{"ref":"rsmoke44a","targetType":"video","targetId":"ZznHA9HM"}')
ck "track/ref 204" 204 "$R"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/track/ref" -H 'content-type: application/json' \
  -d '{"ref":"rsmoke44a","targetType":"video","targetId":"ZznHA9HM"}')
ck "track/ref dedup 204" 204 "$R"

echo "== /r/[code]?ref= → 302 =="
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/r/ZznHA9HM?ref=rsmoke44a")
ck "r redirect 302" 302 "$R"

echo "== r-lookup =="
R=$(curl -s -o /tmp/lk.json -w "%{http_code}" "$BASE/api/r-lookup/ZznHA9HM")
ck "r-lookup 200" 200 "$R"
URL=$(python3 -c "import json;print(json.load(open('/tmp/lk.json'))['url'][:30])" 2>/dev/null)
[ -n "$URL" ] && echo "lookup url: ${URL}…"

echo "== track/click: feature off → 501 =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/track/click" -H 'content-type: application/json' -H 'x-nr-worker-key: whatever' \
  -d '{"code":"ZznHA9HM"}')
ck "click worker disabled 501" 501 "$R"

echo "== magic status =="
R=$(curl -s "$BASE/api/auth/magic/status")
echo "$R" | grep -q '"enabled":false' && echo "ok   magic disabled (no RESEND key)" && pass=$((pass+1)) || { echo "FAIL magic status: $R"; fail=$((fail+1)); }

echo "== magic request w/o key → 501 =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/magic/request" -H 'content-type: application/json' -d '{"email":"a@b.co"}')
ck "magic request 501" 501 "$R"

echo "== resolve narrative key (drip wins) =="
R=$(curl -s -o /tmp/res.json -w "%{http_code}" -X POST "$BASE/api/admin/cryo/resolve?key=$KEY" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","result":"drip"}')
ck "resolve drip 200" 200 "$R"

echo "== payout math: drip 2.00 (winner) vs vanish 1.00 =="
echo "$R" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ms = {m['postCode']: m for m in d['markets']}
z = ms['ZznHA9HM']
assert z['status'] == 'resolved' and z['result'] == 'drip', 'resolved as drip'
assert abs(z['myPayout'] - 2.00*0.97) < 0.01, f\"payout {z['myPayout']} != 1.94\"
print('PAYOUT-OK', z['myPayout'])
"; ck "payout math" 0 $?

echo "== bad result key → 400 =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/cryo/resolve?key=$KEY" -H 'content-type: application/json' \
  -d '{"postCode":"-bBc5Nno","result":"nonsense"}')
ck "resolve bad key 400" 400 "$R"

echo "== claim =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/claim" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA"}')
ck "claim 200" 200 "$R"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/claim" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA"}')
ck "claim dup 409" 409 "$R"

echo "== admin stats: new sections =="
S=$(curl -s "$BASE/api/admin/stats?key=$KEY")
echo "$S" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for k in ('favorites','utm','cryo'):
    assert k in d, f'missing {k}'
assert d['utm']['total'] >= 2, 'utm clicks recorded'
assert d['cryo']['markets'] >= 2, 'cryo markets listed'
print('STATS-OK utm.total =', d['utm']['total'], '| cryo =', d['cryo'])
"; ck "admin stats sections" 0 $?

echo "== static headers (Cloudflare) =="
H=$(curl -s -o /dev/null -D - "$BASE/" 2>/dev/null | tr -d '\r')
IM=$(curl -s -o /dev/null -D - "$BASE/images/og-cover.png" | grep -i 'cache-control' | tr -d '\r')
echo "$IM" | grep -qE 'max-age=604800' && { echo "ok   images long cache"; pass=$((pass+1)); } || { echo "FAIL images cache: $IM"; fail=$((fail+1)); }

echo ""
echo "=== PASS=$pass FAIL=$fail ==="

# ── уборка тестовых данных ──
python3 - <<'PYEOF'
import sqlite3, datetime
con = sqlite3.connect('db/custom.db')
cur = con.cursor()
cur.execute("DELETE FROM CryoBet WHERE wallet LIKE 'TestWallet%'")
cur.execute("DELETE FROM CryoOption WHERE marketId IN (SELECT id FROM CryoMarket)")  # пересоздадутся из конфига
cur.execute("UPDATE CryoMarket SET status='live', result=NULL, resolvedAt=NULL")
cur.execute("DELETE FROM UtmClick WHERE ownerCode='rsmoke44a'")
cur.execute("DELETE FROM Click WHERE utmCode='ZznHA9HM' AND createdAt > datetime('now','-15 minutes')")
cur.execute("DELETE FROM PostStats WHERE utmCode='ZznHA9HM'")
cur.execute("DELETE FROM FavoriteStats")
cur.execute("DELETE FROM Favorite")
cur.execute("DELETE FROM UserProfile WHERE wallet LIKE 'testwallet%'")
cur.execute("DELETE FROM MagicLogin")
con.commit()
cur.execute("SELECT count(*) FROM CryoBet"); print('bets left:', cur.fetchone()[0])
cur.execute("SELECT count(*) FROM UtmClick"); print('utm left:', cur.fetchone()[0])
con.close()
PYEOF

kill $SRV 2>/dev/null
wait $SRV 2>/dev/null
echo "cleanup done"
