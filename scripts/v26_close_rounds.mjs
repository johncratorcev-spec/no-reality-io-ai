#!/usr/bin/env node
/**
 * v26 — «пока отключить раффл»: все открытые раунды закрываются (closes_at
 * = now), при следующем ленивом тике прода resolveExpiredRounds честно
 * авторезолвит их (выплаты победителям pari-mutuel). Ставки не пропадают —
 * ровно та же математика, что при естественном конце окна.
 */
import { q, close } from "./lib/supadb.mjs";

const open = await q(
  `select r.id, r."clipCode", r."closesAt", (select count(*)::int from "Bet" b where b."roundId" = r.id) bets
   from "Round" r where r.status in ('open','locked') order by r."closesAt" asc`
);
console.log(`открытых раундов: ${open.length}, ставок в них: ${open.reduce((s, r) => s + r.bets, 0)}`);

const res = await q(
  `update "Round" set "closesAt" = now() where status in ('open','locked') returning id`
);
console.log(`закрыто (closes_at = now()): ${res.length}`);

const check = await q(
  `select r.status, count(*)::int n from "Round" r where r."closesAt" <= now() and r.status in ('open','locked') group by r.status`
);
console.log("просроченные открытые:", JSON.stringify(check));
await close();
