#!/usr/bin/env bash
# Task 43 browser test: freeze → minimal panel → custom stake → bet → PREDICTED
# + favorites heart + /predict page + console errors. Server + browser in ONE call.
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="task43-$(date +%s)"
OUT=tool-results
mkdir -p $OUT

echo "=== cleanup test data ==="
node scripts/cleanup43.cjs

echo "=== start server ==="
pkill -f "run-standalone.mjs" 2>/dev/null; sleep 1
setsid env REFRESH_JOB=off PORT=3111 node scripts/run-standalone.mjs > server3111.log 2>&1 < /dev/null &
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/v/ZznHA9HM 2>/dev/null)
  [ "$code" = "200" ] && break; sleep 1
done
echo "server ready (${i}s, /v/ZznHA9HM=$code)"

echo "=== open deep link to SWAG market card ==="
agent-browser open "http://localhost:3111/v/ZznHA9HM" >/dev/null 2>&1
sleep 3
agent-browser screenshot $OUT/t43_watch.png >/dev/null 2>&1
echo "-- waiting 5s watch + 1.2s cooling + panel slide..."
sleep 8
agent-browser screenshot $OUT/t43_market.png >/dev/null 2>&1

echo "=== DOM: frozen card must show ZERO video links ==="
agent-browser eval "
(() => {
  const q = (s) => document.querySelectorAll(s).length;
  return JSON.stringify({
    shareBtns: [...document.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent||'')).length,
    threadsLinks: [...document.querySelectorAll('a')].filter(a => /\\/r\\//.test(a.getAttribute('href')||'') && a.textContent.includes('threads')).length,
    hasPanel: q('.nr-cryo-panel') > 0,
    hasActions: q('.nr-cryo-action') === 2,
    hasChips: q('.nr-cryo-chip'),
    hasCustomInput: Boolean(document.querySelector('.nr-cryo-custom input')),
    horizon: q('.nr-cryo-horizon') > 0,
    videoPaused: (() => { const v = document.querySelector('video'); return v ? v.paused : null; })(),
  });
})()
" 2>/dev/null | tail -2

echo "=== set custom stake 12 → click NO ==="
agent-browser eval "
(() => {
  const input = document.querySelector('.nr-cryo-custom input');
  if (!input) return 'no-input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '12');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()
" 2>/dev/null | tail -1
sleep 0.5
agent-browser screenshot $OUT/t43_stake12.png >/dev/null 2>&1
agent-browser eval "
(() => {
  const btns = [...document.querySelectorAll('.nr-cryo-action')];
  const no = btns.find(b => b.querySelector('b')?.textContent === 'NO');
  if (!no) return 'no-btn';
  const note = no.querySelector('.nr-cryo-action-note')?.textContent;
  const odds = no.querySelector('.nr-cryo-action-odds')?.textContent;
  no.click();
  return JSON.stringify({ odds, note });
})()
" 2>/dev/null | tail -2
sleep 2.5
agent-browser screenshot $OUT/t43_predicted.png >/dev/null 2>&1
echo "-- after bet:"
agent-browser eval "
(() => JSON.stringify({
  predictedChip: [...document.querySelectorAll('a,span')].some(e => /PREDICTED/.test(e.textContent||'')),
  chipText: (document.querySelector('.nr-predict-chip')?.textContent || '').slice(0, 40),
  videoPlaying: (() => { const v = document.querySelector('video'); return v ? !v.paused : null; })(),
}))()
" 2>/dev/null | tail -2

echo "=== favorites heart burst ==="
agent-browser eval "
(() => {
  const btn = document.querySelector('.nr-fav-btn');
  if (!btn) return 'no-heart';
  btn.click();
  return 'clicked';
})()
" 2>/dev/null | tail -1
sleep 1.2
agent-browser screenshot $OUT/t43_heart.png >/dev/null 2>&1
agent-browser eval "(() => JSON.stringify({ heartOn: Boolean(document.querySelector('.nr-fav-on')) }))()" 2>/dev/null | tail -1

echo "=== /predict page ==="
agent-browser open "http://localhost:3111/predict" >/dev/null 2>&1
sleep 2
agent-browser screenshot $OUT/t43_predict.png >/dev/null 2>&1
agent-browser eval "(() => JSON.stringify({ howToLd: document.body.innerHTML.includes('\\\"@type\\\":\\\"HowTo\\\"') || document.body.innerHTML.includes('HowTo'), yesNo: (document.body.textContent.match(/YES|NO/g)||[]).length > 5 }))()" 2>/dev/null | tail -1

echo "=== console errors ==="
agent-browser console 2>/dev/null | rg -i 'error' | rg -v '404|favicon|net::ERR' | head -5
echo "(console scan done)"

agent-browser close >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null
echo "BROWSER TEST DONE"
