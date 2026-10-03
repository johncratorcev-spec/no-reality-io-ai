#!/usr/bin/env node
/** v16: статус раунд-пайплайна на проде — live-раунды, раффлы, очереди. */
import { q, close } from "./lib/supadb.mjs";

const live = await q(
  `select c.id clip_id, c.badge, r.status round_status, r."opensAt" ra_open, r."closesAt" ra_close,
          (select count(*)::int from "Bet" b where b."roundId" = r.id) bets
   from clips c left join "Round" r on r."clipCode" = c.id
   where c.status = 'live' or r.status in ('open','locked')`
);
console.log("live/open rounds:", JSON.stringify(live));

const raffles = await q(
  `select c.id, c.badge, c.status clip_status, r.status round_status,
          (select count(*)::int from "Bet" b where b."roundId" = r.id) bets
   from clips c left join "Round" r on r."clipCode" = c.id
   where c.badge like 'raffle-%' order by c.badge`
);
console.log("raffles:", JSON.stringify(raffles));

const queued = await q(
  `select count(*)::int n from clips where status = 'queued'`
);
console.log("queued total:", JSON.stringify(queued));
await close();
