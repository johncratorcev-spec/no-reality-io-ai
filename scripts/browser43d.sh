#!/usr/bin/env bash
# Heart burst screenshot on a regular card + /predict visual.
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="task43d-$(date +%s)"
OUT=tool-results

node scripts/cleanup43.cjs >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null; sleep 1
setsid env REFRESH_JOB=off PORT=3111 node scripts/run-standalone.mjs > server3111.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/ 2>/dev/null | rg -q 200 && break; sleep 1; done

# session cookie for favorites
agent-browser open "http://localhost:3111/v/TK4_0wTI" >/dev/null 2>&1
sleep 2.5
agent-browser eval "
fetch('/api/auth/metamask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: '0x71C7656EC7ab88b098defB751B7401B5f6d1875f' }) }).then(r => r.status).then(s => 'cookie:' + s).catch(e => 'err')
" 2>/dev/null | tail -1
agent-browser open "http://localhost:3111/v/TK4_0wTI" >/dev/null 2>&1
sleep 2
agent-browser eval "
(() => {
  const card = [...document.querySelectorAll('section[data-index]')].find(s => s.querySelector('video') && s.dataset.index === '0') || document.querySelector('section[data-index=\"0\"]');
  const heart = document.querySelector('.nr-fav-btn');
  heart?.click();
  return heart ? 'clicked' : 'no-heart';
})()
" 2>/dev/null | tail -1
agent-browser screenshot $OUT/t43d_burst.png >/dev/null 2>&1
agent-browser eval "(() => JSON.stringify({ on: Boolean(document.querySelector('.nr-fav-on')) }))()" 2>/dev/null | tail -1

agent-browser open "http://localhost:3111/predict" >/dev/null 2>&1
sleep 2.2
agent-browser screenshot $OUT/t43d_predict.png >/dev/null 2>&1

agent-browser close >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null
echo DONE
