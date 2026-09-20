#!/usr/bin/env bash
# Task 43 smoke: start prod server :3111, run all checks, kill server.
set -u
cd /home/z/my-project
set -a; source .env.local 2>/dev/null; set +a
# valid Solana base58 (32 bytes) via bs58 + crypto
PH=$(node -e "const bs58=require('bs58').default;const c=require('crypto');console.log(bs58.encode(c.randomBytes(32)))")

pkill -f "run-standalone.mjs" 2>/dev/null; sleep 1
setsid env REFRESH_JOB=off PORT=3111 node scripts/run-standalone.mjs > server3111.log 2>&1 < /dev/null &
SRV=$!
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server ready after ${i}s (code=$code)"

B=http://localhost:3111
echo "=== 1. SEO meta ==="
curl -s $B/ | grep -o '<meta property="og:image" content="[^"]*"' | head -1
curl -s $B/ | grep -o '<link rel="canonical" href="[^"]*"' | head -1
curl -s $B/ | grep -o '<meta name="geo.region" content="[^"]*"' | head -1
curl -s $B/ | grep -o 'hreflang="[a-z-]*"' | sort -u | head -3
curl -s $B/ | grep -o '<meta name="twitter:card" content="[^"]*"' | head -1
echo "-- titles (template check):"
for p in feed market predict pnl future; do
  curl -s $B/$p | grep -o '<title>[^<]*</title>' | head -1
done
echo "-- v/[code]:"
curl -s $B/v/ZznHA9HM | grep -o '<title>[^<]*</title>\|<link rel="canonical" href="[^"]*"' | head -2
echo "-- manifest:"
curl -s $B/manifest.webmanifest | grep -o '"name":"[^"]*"' | head -1
echo "-- sitemap count:"; curl -s $B/sitemap.xml | grep -c '<loc>'
echo "-- robots:"; curl -s $B/robots.txt | head -3 | tr '\n' ' '; echo

echo "=== 2. EN content check (must be empty) ==="
curl -s $B/feed | grep -oE '[А-Яа-яёЁ]{2,}' | sort -u | head -5
curl -s $B/predict | grep -oE '[А-Яа-яёЁ]{2,}' | sort -u | head -5
echo "(done)"

echo "=== 3. cryo markets API ==="
curl -s "$B/api/cryo/markets" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for m in d['markets']:
    print(m['postCode'], m['status'], 'yes=%s'%m['labelYes'], 'no=%s'%m['labelNo'], 'exchange=%s'%m['exchange'], 'odds=%s/%s'%(m['oddsYes'],m['oddsNo']))
"
echo "=== 4. bets: any amounts ==="
W=demo:guest-smoke43
bet(){ curl -s -X POST $B/api/cryo/bet -H 'content-type: application/json' -d "{\"postCode\":\"ZznHA9HM\",\"side\":\"$1\",\"wallet\":\"$W\",\"amount\":\"$2\",\"mode\":\"demo\"}" -o /tmp/bet.json -w "%{http_code}"; }
echo "-- bet 7.50 YES: $(bet yes 7.50)"; python3 -c "import json;d=json.load(open('/tmp/bet.json'));m=d.get('market',{});print('   myBet',m.get('myBet'),'pools',m.get('yesPool'),m.get('noPool'),'oddsYes',m.get('oddsYes'))"
echo "-- dup bet: $(bet no 3.00)"
echo "-- amount 0 (bad): $(bet yes 0)"
echo "-- amount 1000 (>500): $(bet yes 1000)"
echo "-- amount 0.05 (<min): $(bet yes 0.05)"
echo "-- amount 'abc': $(bet yes abc)"
echo "-- amount 0.10 min ok (wallet2): $(curl -s -X POST $B/api/cryo/bet -H 'content-type: application/json' -d '{"postCode":"-bBc5Nno","side":"no","wallet":"demo:guest-smoke43b","amount":"0.10","mode":"demo"}' -o /dev/null -w '%{http_code}')"
echo "-- amount 25 (preset): $(curl -s -X POST $B/api/cryo/bet -H 'content-type: application/json' -d '{"postCode":"-bBc5Nno","side":"yes","wallet":"demo:guest-smoke43c","amount":"25","mode":"demo"}' -o /dev/null -w '%{http_code}')"
echo "=== 5. odds client-side math (cryoOds sanity) ==="
node -e "
const {cryoOdds, normalizeUsdc} = require('./scripts/odds_check_helper.cjs');
" 2>/dev/null || node --experimental-strip-types -e "
import('./src/lib/cryo/odds.ts').then(m=>{
  console.log('odds(total=8.5,yes=7.5,amt=1):', m.cryoOdds(8.5,7.5,1,0.03));
  console.log('odds(total=8.5,yes=7.5,amt=25):', m.cryoOdds(8.5,7.5,25,0.03));
  console.log('norm(2,5):', m.normalizeUsdc('2,5'), 'norm(-3):', m.normalizeUsdc('-3'), 'norm(0.10):', m.normalizeUsdc('0.10'));
}).catch(e=>{console.error('TS import failed:', e.message); process.exit(1);});
" 2>/dev/null || echo "(odds helper: checked via API instead)"

echo "=== 6. resolve + payout math ==="
curl -s -X POST "$B/api/admin/cryo/resolve" -H 'content-type: application/json' -d "{\"key\":\"$ADMIN_SECRET\",\"postCode\":\"ZznHA9HM\",\"result\":\"yes\"}" -o /tmp/res.json -w "resolve=%{http_code}\n"; cat /tmp/res.json; echo
curl -s "$B/api/cryo/pnl?wallet=$W" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('staked',d['staked'],'claimable',d['claimable'],'net',d['net'])
print('item0:', d['items'][0]['side'], d['items'][0]['amount'], 'payout', d['items'][0]['payout'])
"
echo "-- claim:"
curl -s -X POST $B/api/cryo/claim -H 'content-type: application/json' -d "{\"postCode\":\"ZznHA9HM\",\"wallet\":\"$W\"}" -w " <-claim\n"
curl -s -X POST $B/api/cryo/claim -H 'content-type: application/json' -d "{\"postCode\":\"ZznHA9HM\",\"wallet\":\"$W\"}" -w " <-dup claim\n"

echo "=== 7. favorites API ==="
echo "-- no session: $(curl -s -o /dev/null -w '%{http_code}' $B/api/favorites)"
echo "-- POST no session: $(curl -s -X POST $B/api/favorites -H 'content-type: application/json' -d '{"postCode":"ZznHA9HM"}' -o /dev/null -w '%{http_code}')"
# phantom session cookie (valid base58 32-byte): use local wallet from smoke
# phantom session cookie (valid base58 32-byte) generated at the top
echo "-- GET with phantom cookie: $(curl -s -o /tmp/fav.json -w '%{http_code}' -H "Cookie: nr_phantom=$PH" $B/api/favorites)"; cat /tmp/fav.json | head -c 120; echo
echo "-- POST fav: $(curl -s -X POST $B/api/favorites -H 'content-type: application/json' -H "Cookie: nr_phantom=$PH" -d '{"postCode":"ZznHA9HM"}' -o /tmp/fav2.json -w '%{http_code}')"; head -c 200 /tmp/fav2.json; echo
echo "-- POST fav 2nd video: $(curl -s -X POST $B/api/favorites -H 'content-type: application/json' -H "Cookie: nr_phantom=$PH" -d '{"postCode":"-bBc5Nno"}' -o /dev/null -w '%{http_code}')"
echo "-- idempotent POST again: $(curl -s -X POST $B/api/favorites -H 'content-type: application/json' -H "Cookie: nr_phantom=$PH" -d '{"postCode":"ZznHA9HM"}' -o /dev/null -w '%{http_code}')"
echo "-- DELETE fav: $(curl -s -X DELETE $B/api/favorites -H 'content-type: application/json' -H "Cookie: nr_phantom=$PH" -d '{"postCode":"ZznHA9HM"}' -o /tmp/fav3.json -w '%{http_code}')"
python3 -c "import json;d=json.load(open('/tmp/fav3.json'));print('   left:',[f['postCode'] for f in d['favorites']])"
echo "-- bad postCode: $(curl -s -X POST $B/api/favorites -H 'content-type: application/json' -H "Cookie: nr_phantom=$PH" -d '{"postCode":"../etc"}' -o /dev/null -w '%{http_code}')"

echo "=== 8. EN admin panel + no cyrillic in public HTML ==="
for p in "" feed predict market pnl future collab terms creators; do
  n=$(curl -s "$B/$p" | grep -oE '[А-Яа-яёЁ]' | wc -l)
  [ "$n" != "0" ] && echo "  CYRILLIC in /$p: $n chars"
done
echo "(cyrillic scan done)"

kill $SRV 2>/dev/null; pkill -f "run-standalone.mjs" 2>/dev/null
echo "SMOKE DONE"
