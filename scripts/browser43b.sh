#!/usr/bin/env bash
# Task 43 browser test, take 2: proper waits + scoped DOM checks + wallet session for heart.
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="task43b-$(date +%s)"
OUT=tool-results
mkdir -p $OUT

node scripts/cleanup43.cjs

pkill -f "run-standalone.mjs" 2>/dev/null; sleep 1
setsid env REFRESH_JOB=off PORT=3111 node scripts/run-standalone.mjs > server3111.log 2>&1 < /dev/null &
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/v/ZznHA9HM 2>/dev/null)
  [ "$code" = "200" ] && break; sleep 1
done
echo "server ready (${i}s)"

agent-browser open "http://localhost:3111/v/ZznHA9HM" >/dev/null 2>&1
sleep 3

echo "=== wallet session via metamask route (EVM cookie) ==="
agent-browser eval "
fetch('/api/auth/metamask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: '0x71C7656EC7ab88b098defB751B7401B5f6d1875f' }) }).then(r => r.json()).then(d => JSON.stringify(d)).catch(e => 'err:' + e.message)
" 2>/dev/null | tail -1

echo "=== reload deep link → wait freeze (5s watch + 1.1s cool + slide) ==="
agent-browser open "http://localhost:3111/v/ZznHA9HM" >/dev/null 2>&1
sleep 9

echo "=== scoped DOM check: active card with panel ==="
agent-browser eval "
(() => {
  const panel = document.querySelector('.nr-cryo-panel');
  if (!panel) return 'no-panel';
  const card = panel.closest('section[data-index]');
  const q = (s) => card.querySelectorAll(s).length;
  return JSON.stringify({
    videoLinks: q('a[href*=\"/r/\"], a[href*=\"threads.com\"]'),
    shareButtons: [...card.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent||'')).length,
    promptBtn: q('button[aria-label*=\"prompt\" i]'),
    heart: q('.nr-fav-btn'),
    heartOn: q('.nr-fav-on'),
    videoPaused: card.querySelector('video')?.paused ?? null,
  });
})()
" 2>/dev/null | tail -2

echo "=== stake custom 12 → click NO ==="
agent-browser eval "
(() => {
  const input = document.querySelector('.nr-cryo-custom input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '12');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(() => {
    const no = [...document.querySelectorAll('.nr-cryo-action')].find(b => b.querySelector('b')?.textContent === 'NO');
    no?.click();
  }, 120);
  return 'scheduled';
})()
" 2>/dev/null | tail -1

sleep 6
agent-browser screenshot $OUT/t43b_predicted.png >/dev/null 2>&1
agent-browser eval "
(() => JSON.stringify({
  chip: (document.querySelector('.nr-predict-chip')?.textContent || 'none').slice(0, 44),
  playing: (() => { const v = document.querySelector('video'); return v ? !v.paused : null; })(),
  chromeBack: (() => { const card = document.querySelector('.nr-predict-chip')?.closest('section'); return card ? [...card.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent||'')).length : null; })(),
}))()
" 2>/dev/null | tail -2

echo "=== heart with wallet session → burst + persist ==="
agent-browser eval "(() => { document.querySelector('.nr-fav-btn')?.click(); return 'ok'; })()" 2>/dev/null | tail -1
sleep 1.5
agent-browser screenshot $OUT/t43b_heart.png >/dev/null 2>&1
agent-browser eval "(() => JSON.stringify({ heartOn: Boolean(document.querySelector('.nr-fav-on')) }))()" 2>/dev/null | tail -1
echo "-- server-side favorites:"
curl -s -H "Cookie: nr_wallet=0x71c7656ec7ab88b098defb751b7401b5f6d1875f" http://localhost:3111/api/favorites | head -c 220; echo

echo "=== pnl page favorites strip ==="
agent-browser open "http://localhost:3111/pnl" >/dev/null 2>&1
sleep 2.5
agent-browser eval "(() => JSON.stringify({ favSection: document.body.textContent.includes('favorites'), heartList: document.querySelectorAll('section[aria-label=\\\"Favorites\\\"] a').length }))()" 2>/dev/null | tail -1
agent-browser screenshot $OUT/t43b_pnl.png >/dev/null 2>&1

echo "=== db state ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const bets = await db.cryoBet.findMany();
  console.log('bets:', bets.map(b => \`\${b.side} \${b.amount} \${b.wallet.slice(0,16)}\`));
  const favs = await db.favorite.findMany();
  console.log('favs:', favs.map(f => f.postCode));
  await db.\$disconnect();
})();
"

agent-browser close >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null
echo "BROWSER TEST 2 DONE"
