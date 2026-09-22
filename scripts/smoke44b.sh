#!/usr/bin/env bash
# Task 44 smoke B: payout math (правильный парс), профиль с подписанной
# Phantom-сессией, welcome-бонус, free-prediction ставки, seer-бейдж.
set -u
cd /home/z/my-project

PORT=3112
BASE="http://localhost:$PORT"
KEY=$(grep -E '^ADMIN_SECRET=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
KEY=${KEY:-no-reality-secret}

REFRESH_JOB=off PORT=$PORT npx next start -p $PORT >/tmp/nr44b.log 2>&1 &
SRV=$!
for i in $(seq 1 60); do
  curl -sf "$BASE/api/cryo/markets" >/dev/null 2>&1 && break
  sleep 0.5
done

pass=0; fail=0
ck() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok   $1 ($3)";
  else fail=$((fail+1)); echo "FAIL $1 (got $3, want $2)"; fi; }

echo "== setup: two bets (drip 2.00, vanish 1.00) =="
curl -s -o /dev/null -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"drip","wallet":"TestWallet44AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"2.00","mode":"demo"}'
curl -s -o /dev/null -X POST "$BASE/api/cryo/bet" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","side":"vanish","wallet":"TestWallet45AAAAAAAAAAAAAAAAAAAAAAAAAAAA","amount":"1.00","mode":"demo"}'

echo "== resolve drip → payout = 1.94 (2.00 × 0.97) =="
curl -s -o /tmp/res44.json -X POST "$BASE/api/admin/cryo/resolve?key=$KEY" -H 'content-type: application/json' \
  -d '{"postCode":"ZznHA9HM","result":"drip"}'
python3 -c "
import json
d = json.load(open('/tmp/res44.json'))
ms = {m['postCode']: m for m in d['markets']}
z = ms['ZznHA9HM']
assert z['status'] == 'resolved' and z['result'] == 'drip'
assert abs(z['myPayout'] - 1.94) < 0.005, f'payout {z[\"myPayout\"]} != 1.94'
print('PAYOUT-OK', z['myPayout'])
"; ck "payout math" 0 $?

echo "== phantom sign-in + welcome bonus =="
node - <<'NODE' > /tmp/nr44_cookie.txt
const nacl = require('tweetnacl');
const bs58 = require('bs58').default ?? require('bs58');
const kp = nacl.sign.keyPair();
const wallet = bs58.encode(kp.publicKey);
const message = `no reality. sign in\nwallet: ${wallet}\ntime: ${new Date().toISOString()}`;
const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
(async () => {
  const r = await fetch('http://localhost:3112/api/auth/phantom', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet, message, signature: bs58.encode(sig), invitedBy: 'rsmoke44a' }),
  });
  const d = await r.json();
  const cookie = r.headers.get('set-cookie') || '';
  const session = (cookie.match(/nr_phantom=([^;]+)/) || [])[1];
  console.error('status', r.status, 'welcome', JSON.stringify(d.welcome ?? null), 'refCode', d.refCode);
  console.log(`${session}\t${wallet}\t${d.refCode ?? ''}\t${d.welcome ? d.welcome.bonusCredits : 'none'}`);
})();
NODE
SESSION=$(cut -f1 /tmp/nr44_cookie.txt)
WALLET=$(cut -f2 /tmp/nr44_cookie.txt)
ck "phantom sign-in session" got "${SESSION:+got}"
echo "wallet=$SESSION" | head -c 30; echo "…"

echo "== profile: bonusCredits + early badge + refCode =="
curl -s "$BASE/api/profile" -H "cookie: nr_phantom=$SESSION" -o /tmp/prof44.json
python3 -c "
import json
d = json.load(open('/tmp/prof44.json'))
assert d.get('wallet'), d
assert d.get('bonusCredits', 0) >= 2, f\"bonus {d.get('bonusCredits')}\"
assert 'early' in d.get('badges', []), f\"badges {d.get('badges')}\"
assert d.get('refCode','').startswith('r'), d.get('refCode')
assert d.get('inviteUrl','').endswith(d.get('refCode','x')), d.get('inviteUrl')
print('PROFILE-OK credits', d['bonusCredits'], 'badges', d['badges'], 'code', d['refCode'])
"; ck "profile welcome bonus" 0 $?

echo "== free prediction (bonus bet) with session =="
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/cryo/bet" -H "cookie: nr_phantom=$SESSION" -H 'content-type: application/json' \
  -d "{\"postCode\":\"-bBc5Nno\",\"side\":\"yes\",\"wallet\":\"$WALLET\",\"mode\":\"bonus\"}")
ck "bonus bet 200" 200 "$R"

echo "== profile: credits decremented 2→1 =="
curl -s "$BASE/api/profile" -H "cookie: nr_phantom=$SESSION" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['bonusCredits'] == 1, d['bonusCredits']
print('CREDITS-OK', d['bonusCredits'])
"; ck "credits decrement" 0 $?

echo "== admin stats utm (dedup-aware >=1) =="
curl -s "$BASE/api/admin/stats?key=$KEY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d['utm']['total'] >= 1, d['utm']
assert 'video' in d['utm']['byType'], d['utm']
assert d['favorites']['total'] >= 0
print('STATS-OK', d['utm'])
"; ck "admin stats utm" 0 $?

echo ""
echo "=== PASS=$pass FAIL=$fail ==="

python3 - <<'PYEOF'
import sqlite3
con = sqlite3.connect('db/custom.db')
cur = con.cursor()
cur.execute("DELETE FROM CryoBet WHERE wallet LIKE 'TestWallet%'")
cur.execute("DELETE FROM CryoBet WHERE mode='bonus'")
cur.execute("DELETE FROM CryoOption")
cur.execute("UPDATE CryoMarket SET status='live', result=NULL, resolvedAt=NULL")
cur.execute("DELETE FROM UtmClick")
cur.execute("DELETE FROM Click WHERE utmCode='ZznHA9HM'")
cur.execute("DELETE FROM PostStats WHERE utmCode='ZznHA9HM'")
cur.execute("DELETE FROM FavoriteStats")
cur.execute("DELETE FROM Favorite")
cur.execute("DELETE FROM UserProfile")
cur.execute("DELETE FROM MagicLogin")
cur.execute("DELETE FROM ReferralProfile WHERE wallet LIKE ?", (f"%{open('/tmp/nr44_cookie.txt').read().split(chr(9))[1][:20]}%",)) if False else None
con.commit()
for t in ('CryoBet','UtmClick','UserProfile','Favorite','MagicLogin'):
    cur.execute(f"SELECT count(*) FROM {t}")
    print(t, 'left:', cur.fetchone()[0])
con.close()
PYEOF

kill $SRV 2>/dev/null
wait $SRV 2>/dev/null
echo "cleanup done"
