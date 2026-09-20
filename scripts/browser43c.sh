#!/usr/bin/env bash
# Task 43 browser test, take 3: deterministic playback → freeze → bet → PREDICTED.
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="task43c-$(date +%s)"
OUT=tool-results

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

echo "=== force playback (tap video) ==="
agent-browser eval "
(() => {
  const v = document.querySelector('video');
  if (!v) return 'no-video';
  v.muted = true;
  const p = v.play();
  return p ? 'play-called ready=' + v.readyState : 'no-play';
})()
" 2>/dev/null | tail -1

echo "=== poll paused/panel every 2s (10 iterations) ==="
for i in $(seq 1 10); do
  st=$(agent-browser eval "(() => { const v = document.querySelector('video'); return JSON.stringify({ t: Math.round(v?.currentTime||0), paused: v?.paused, panel: Boolean(document.querySelector('.nr-cryo-panel')) }); })()" 2>/dev/null | tail -1)
  echo "  [$i] $st"
  echo "$st" | rg -q 'panel..true' && break
  sleep 2
done

echo "=== scoped DOM check ==="
agent-browser eval "
(() => {
  const panel = document.querySelector('.nr-cryo-panel');
  if (!panel) return 'no-panel';
  const card = panel.closest('section[data-index]');
  return JSON.stringify({
    videoLinks: card.querySelectorAll('a[href*=\"/r/\"], a[href*=\"threads.com\"]').length,
    shareButtons: [...card.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent||'')).length,
    heart: card.querySelectorAll('.nr-fav-btn').length,
    chips: card.querySelectorAll('.nr-cryo-chip').length,
    horizon: Boolean(card.querySelector('.nr-cryo-horizon')),
  });
})()
" 2>/dev/null | tail -2
agent-browser screenshot $OUT/t43c_market.png >/dev/null 2>&1

echo "=== stake custom 12 → click NO → wait full melt ==="
agent-browser eval "
(() => {
  const input = document.querySelector('.nr-cryo-custom input');
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '12');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(() => {
    const no = [...document.querySelectorAll('.nr-cryo-action')].find(b => b.querySelector('b')?.textContent === 'NO');
    no?.click();
  }, 150);
  return 'scheduled';
})()
" 2>/dev/null | tail -1

sleep 8
agent-browser screenshot $OUT/t43c_predicted.png >/dev/null 2>&1
agent-browser eval "
(() => JSON.stringify({
  chip: (document.querySelector('.nr-predict-chip')?.textContent || 'none').slice(0, 44),
  playing: (() => { const v = document.querySelector('video'); return v ? !v.paused : null; })(),
  shareBack: (() => { const card = document.querySelector('.nr-predict-chip')?.closest('section'); return card ? [...card.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent||'')).length : null; })(),
  payerr: document.querySelector('.nr-cryo-payerr')?.textContent || null,
}))()
" 2>/dev/null | tail -2

echo "=== db ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const bets = await db.cryoBet.findMany();
  console.log('bets:', bets.map(b => \`\${b.side} \${b.amount} \${b.mode}\`));
  await db.\$disconnect();
})();
"

agent-browser close >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null
echo "BROWSER TEST 3 DONE"
