#!/usr/bin/env node
/**
 * v16: ПАУЗА/ВОЗВРАТ раффлов для прогонов самотестов на живой БД.
 *
 * Самотесты тикают общий планировщик: пока очередь пустеет (тестовые клипы
 * удалены клінапом), любой тик продвигает raffle- клипы и прожигает их
 * окна с 0 ставок. Чтобы прогоны не съедали соревнования:
 *
 *   node scripts/raffle_guard.mjs pause    — queued-раффлы → draft (тесты их не видят)
 *   node scripts/raffle_guard.mjs resume   — draft-раффлы → queued (обнулив окна)
 *
 * resume также откатывает случайные пустые резолвы (0 ставок): Round
 * удаляется, клип → queued. Раффлы со ставками (>0) НЕ трогаются.
 */
import { q, one, close } from "./lib/supadb.mjs";

const mode = (process.argv[2] || "").trim();
if (mode !== "pause" && mode !== "resume") {
  console.error("использование: node scripts/raffle_guard.mjs pause|resume");
  process.exit(1);
}

if (mode === "pause") {
  const n = await one(
    `with upd as (update clips set status='draft', updated_at=now()
      where badge like 'raffle-%' and status='queued' returning id)
     select count(*)::int n from upd`
  );
  console.log(`pause: ${n?.n ?? 0} queued-раффлов → draft`);
} else {
  /* resume: только клипы без ставок в раунде (пустой резолв → откат) */
  const rows = await q(
    `select c.id, c.badge, c.status, r.id rid,
            (select count(*)::int from "Bet" b where b."roundId" = r.id) bets
     from clips c left join "Round" r on r."clipCode" = c.id
     where c.badge like 'raffle-%' and c.status in ('draft','resolved','live')`
  );
  for (const r of rows) {
    if (r.status === "draft") {
      await q(
        `update clips set status='queued', opens_at=null, closes_at=null,
                         resolved_at=null, updated_at=now() where id=$1`,
        [r.id]
      );
      console.log(`resume: ${r.badge} draft → queued`);
      continue;
    }
    /* resolved/live с 0 ставок — чистый откат; со ставками не трогаем */
    if ((r.bets ?? 0) > 0) {
      console.log(`skip: ${r.badge} ${r.status} — есть ставки (${r.bets}), не трогаю`);
      continue;
    }
    if (r.rid) await q(`delete from "Round" where id=$1 and "clipCode"=$2`, [r.rid, r.id]);
    await q(
      `update clips set status='queued', opens_at=null, closes_at=null,
                       resolved_at=null, updated_at=now() where id=$1`,
      [r.id]
    );
    console.log(`resume: ${r.badge} ${r.status} (0 ставок) → queued`);
  }
  const qd = await one(`select count(*)::int n from clips where status='queued'`);
  console.log(`queued total: ${qd?.n ?? 0}`);
}
await close();
