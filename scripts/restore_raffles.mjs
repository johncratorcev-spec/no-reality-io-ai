#!/usr/bin/env node
/**
 * v16: восстановление раффлов после самотестов.
 *
 * Самотесты с тик-гигиеной (глобальный closesAt=past + cron/tick) прогнали
 * queued-раффлы через пайплайн с 0 ставок. Ставок нет → резолвы пустые →
 * чистый откат: пустые Round-строки удаляются, клипы возвращаются в queued,
 * opens/closes/resolved обнуляются. label_commit НЕ трогается (метки те же).
 */
import { q, one, close } from "./lib/supadb.mjs";

const raffles = await q(
  `select c.id, c.badge, c.status, r.id rid, r.status rs,
          (select count(*)::int from "Bet" b where b."roundId" = r.id) bets
   from clips c left join "Round" r on r."clipCode" = c.id
   where c.badge like 'raffle-%' order by c.badge`
);
console.log("before:", JSON.stringify(raffles));

const totalBets = raffles.reduce((s, r) => s + (r.bets ?? 0), 0);
if (totalBets > 0) {
  console.error(`СТОП: у раффлов есть ставки (${totalBets}) — откат невозможен вручную`);
  await close();
  process.exit(1);
}

/* 1. пустые раунды раффлов — вон */
for (const r of raffles) {
  if (r.rid) {
    await q(`delete from "Round" where id = $1 and "clipCode" = $2`, [r.rid, r.id]);
  }
}

/* 2. клипы → queued, окна обнулены */
await q(
  `update clips
      set status = 'queued',
          opens_at = null,
          closes_at = null,
          resolved_at = null,
          updated_at = now()
    where badge like 'raffle-%'`
);

/* 3. верификация */
const after = await q(
  `select c.badge, c.status, r.status rs from clips c
   left join "Round" r on r."clipCode" = c.id
   where c.badge like 'raffle-%' order by c.badge`
);
console.log("after:", JSON.stringify(after));

/* 4. гигиена тестовых аккаунтов (selfsession/тестовые email) */
const testAccs = await q(
  `select id from "Account" where email like '%@test.dev' or email like '%@test.local'`
);
console.log("test accounts left:", testAccs.length);
for (const a of testAccs) {
  await q(`delete from "LedgerTxn" where "accountId" = $1`, [a.id]);
  await q(`delete from "Account" where id = $1`, [a.id]);
}
const left = await one(
  `select count(*)::int n from "Account" where email like '%@test.dev' or email like '%@test.local'`
);
console.log("test accounts after cleanup:", left?.n);

const q2 = await one(`select count(*)::int n from clips where status = 'queued'`);
console.log("queued total:", q2?.n);
await close();
