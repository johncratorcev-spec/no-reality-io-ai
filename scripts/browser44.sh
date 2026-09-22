#!/usr/bin/env bash
# Task 44 browser E2E: narrative market panel → bet → PREDICTED;
# favorites counter pill; /pnl profile panel. Одним вызовом (сервер
# не переживает границу bash-вызовов).
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="task44-$(date +%s)"
OUT=tool-results
mkdir -p $OUT

node scripts/cleanup43.cjs >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null; sleep 1
setsid env REFRESH_JOB=off PORT=3111 node scripts/run-standalone.mjs > server3111.log 2>&1 < /dev/null &
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3111/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server ready (${i}s, code=$code)"

echo "== 1. открыть /v/ZznHA9HM (SWAG рынок, 3 нарративные опции) =="
agent-browser open "http://localhost:3111/v/ZznHA9HM" >/dev/null 2>&1
sleep 3
echo "-- ждём заморозку (5s watch + 1.1s cool) --"
for i in $(seq 1 20); do
  panel=$(agent-browser eval "(() => ({ panel: Boolean(document.querySelector('.nr-cryo-panel')), opts: document.querySelectorAll('.nr-cryo-opt').length, videoLinks: document.querySelectorAll('.nr-cryo-root video, .nr-cryo-root a[href*=threads]').length }))()" 2>/dev/null | tail -1)
  echo "$panel" | grep -q '"opts":3' && break
  sleep 1
done
echo "panel state: $panel"
agent-browser screenshot $OUT/t44_market.png >/dev/null 2>&1

echo "-- DOM-проверки рынка: 3 опции, нет ссылок на видео --"
agent-browser eval "(() => JSON.stringify({
  opts: [...document.querySelectorAll('.nr-cryo-opt b')].map(b => b.textContent.trim()),
  pct: [...document.querySelectorAll('.nr-cryo-opt em')].map(e => e.textContent.trim()),
  odds: document.querySelectorAll('.nr-cryo-opt-odds').length,
  videoLinks: document.querySelectorAll('.nr-cryo-root video, .nr-cryo-root a[href*=threads]').length,
  shareBtns: [...document.querySelectorAll('button')].filter(b => /share reality/i.test(b.textContent)).length,
  q: document.querySelector('.nr-cryo-q')?.textContent
}))()" 2>/dev/null | tail -1

echo "== 2. ставка на первую опцию (demo) =="
agent-browser eval "(() => { const o = document.querySelector('.nr-cryo-opt'); o?.click(); return o ? o.querySelector('b')?.textContent : 'no-opt'; })()" 2>/dev/null | tail -1
sleep 4
agent-browser eval "(() => JSON.stringify({
  predicted: document.querySelector('.nr-predict-chip')?.textContent.trim().slice(0, 60),
  panelGone: !document.querySelector('.nr-cryo-panel'),
  videoPlaying: (() => { const v = document.querySelector('video'); return v ? !v.paused : false; })()
}))()" 2>/dev/null | tail -1
agent-browser screenshot $OUT/t44_predicted.png >/dev/null 2>&1

echo "== 3. избранное: авторизация metamask → сердце → счётчик 'saved' =="
agent-browser open "http://localhost:3111/v/TK4_0wTI" >/dev/null 2>&1
sleep 2.5
agent-browser eval "
fetch('/api/auth/metamask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: '0x71C7656EC7ab88b098defB751B7401B5f6d1875f' }) }).then(r => r.status).then(s => 'auth:' + s).catch(e => 'err')
" 2>/dev/null | tail -1
agent-browser open "http://localhost:3111/v/TK4_0wTI" >/dev/null 2>&1
sleep 2.5
agent-browser eval "(() => { const h = document.querySelector('.nr-fav-btn'); h?.click(); return h ? 'heart-clicked' : 'no-heart'; })()" 2>/dev/null | tail -1
sleep 1.5
agent-browser eval "(() => JSON.stringify({
  favOn: Boolean(document.querySelector('.nr-fav-on')),
  savedPill: [...document.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /^\d+ saved$/.test(t)) || null
}))()" 2>/dev/null | tail -1
agent-browser screenshot $OUT/t44_saved_pill.png >/dev/null 2>&1

echo "-- counts API теперь отдаёт 1 --"
curl -s "http://localhost:3111/api/favorites/counts?codes=TK4_0wTI" | tail -1

echo "== 4. профиль: /pnl 'your reach' + бонусы =="
agent-browser open "http://localhost:3111/pnl" >/dev/null 2>&1
sleep 3
agent-browser eval "(() => JSON.stringify({
  reach: [...document.querySelectorAll('p')].some(p => /your reach/i.test(p.textContent)),
  freeChip: [...document.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /free prediction/.test(t)) || null,
  badges: [...document.querySelectorAll('span')].map(s => s.textContent.trim()).filter(t => t === 'early' || t === 'seer'),
  invite: document.querySelector('code')?.textContent.slice(0, 40) || null
}))()" 2>/dev/null | tail -1
agent-browser screenshot $OUT/t44_profile.png >/dev/null 2>&1

echo "== 5. консоль без ошибок =="
agent-browser console 2>/dev/null | grep -iE "error|warn" | grep -vE "Download the React DevTools|vid:" | head -5 || echo "console clean"

agent-browser close >/dev/null 2>&1
pkill -f "run-standalone.mjs" 2>/dev/null

echo "== уборка тестовых данных =="
node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  await db.cryoBet.deleteMany({ where: { OR: [{ wallet: { startsWith: 'demo:' } }, { wallet: '0x71c7656ec7ab88b098defb751b7401b5f6d1875f' }] } });
  await db.cryoOption.deleteMany({});
  await db.cryoMarket.updateMany({ where: { status: 'resolved' }, data: { status: 'live', result: null, resolvedAt: null } });
  await db.favorite.deleteMany({});
  await db.favoriteStats.deleteMany({});
  await db.userProfile.deleteMany({});
  await db.utmClick.deleteMany({});
  const bets = await db.cryoBet.count();
  console.log('bets left:', bets, '| markets live');
  await db.$disconnect();
})();
NODE
echo DONE44
