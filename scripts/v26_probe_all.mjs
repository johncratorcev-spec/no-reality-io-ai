#!/usr/bin/env node
/** v26 — проба живости ссылок всех активных клипов (как checkVideoAlive рантайма) */
import { q, close } from "./lib/supadb.mjs";

async function probe(url) {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1" }, signal: AbortSignal.timeout(9000) });
    if (r.ok || r.status === 206) return "ok-range";
    const r2 = await fetch(url, { signal: AbortSignal.timeout(9000) });
    return `fallback ${r2.status}`;
  } catch (e) {
    return `ERR ${String(e.message).slice(0, 30)}`;
  }
}

const rows = await q(`select id, status, video_url from clips where status in ('live','resolved','soon') order by status, id`);
let ok = 0, dead = 0;
for (const r of rows) {
  const res = await probe(r.video_url);
  const good = res === "ok-range" || res === "fallback 200" || res === "fallback 206";
  if (good) ok++; else dead++;
  console.log(`${good ? "OK  " : "DEAD"} ${r.status.padEnd(8)} ${r.id} ${res}`);
}
console.log(`\nитого: живых ${ok}, мёртвых ${dead}`);
await close();
