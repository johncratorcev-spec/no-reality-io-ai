#!/usr/bin/env node
/**
 * v26 — восстановление 19 раффлов после void-шторма: ссылки обновлены
 * (v26_refresh_dead), клипы и раунды возвращаются в resolved — вердикты
 * раскрываются честно (label_commit не менялся). Единственная ставка
 * раффла-12 остаётся рефанднутой (void) — она проигрывала (real против
 * verdict synth), рефанд щедрее честного исхода, коррекция не нужна.
 */
import { q, close } from "./lib/supadb.mjs";

const IDS = "3enf3mt9ut,6s7znyk2sr,anc3cqw3j2,b43qf72xft,dyu8cir923,fcwwwvdagn,i8szu9ez5x,k9qjmi4ggk,ka83dce693,kk3c77jgs6,nam42fpjgd,rtp7j3w3yp,sb38za2rwh,uinu6kmriw,weykmrtd7c,wj4cc7kui6,x3gpq8c6hz,xbijdardty,xewit89nej".split(",");

const r1 = await q(
  `update clips set status = 'resolved', resolved_at = now(), updated_at = now()
   where id = any($1::text[]) and status = 'void' returning id`,
  [IDS]
);
console.log(`клипов восстановлено в resolved: ${r1.length}`);

const r2 = await q(
  `update "Round" r set status = 'resolved', "resolvedAt" = now()
   where r."clipCode" = any($1::text[]) and r.status = 'void' returning r.id`,
  [IDS]
);
console.log(`раундов восстановлено в resolved: ${r2.length}`);

const st = await q(`select status, count(*)::int n from clips group by status order by status`);
console.log("статусы clips:", JSON.stringify(st));
const rd = await q(`select status, count(*)::int n from "Round" group by status`);
console.log("статусы rounds:", JSON.stringify(rd));
await close();
