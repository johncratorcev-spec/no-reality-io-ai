#!/usr/bin/env node
/**
 * v23 — selftest архитектуры «все клипы — раффлы сразу».
 *
 *   1. вставляем 3 selftest-клипа в очередь (2 с живой ссылкой, 1 битый);
 *   2. GET /api/round?clip=… лениво тикает планировщик → bulk-promote:
 *      живые → live с окном НЕДЕЛЯ (604800с), битый → void;
 *   3. регистрируем аккаунт, ставим 25 EYE на live-раффл;
 *   4. закрываем окно (closes_at в прошлое) → ленивый тик резолвит:
 *      вердикт совпадает с меткой, выплата падает на баланс;
 *   5. cleanup: клипы/раунды/ставки/аккаунт удаляются.
 *
 * Запуск: dev-сервер с NR_SCHEDULER_PAUSE=1 (selftest-промоция разрешена
 * только для selftest-*), затем node scripts/v23_raffle_selftest.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
/* песочница не пускает внешние CDN — живой URL отдаёт сам dev-сервер */
const GOOD_MP4 = `${BASE}/selftest/alive.mp4`;
const DEAD_URL = "http://127.0.0.1:1/dead.mp4";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const PEPPER = env.COMMIT_PEPPER || "";
const ACCESS_KEY = env.NR_ACCESS_KEY || "";

let passed = 0, failed = 0;
function ok(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
}

const commitOf = (id, label) =>
  createHash("sha256").update(`${label}:${id}:${PEPPER}`).digest("hex");

async function api(path, init = {}, cookies = null) {
  const headers = { "content-type": "application/json", ...(init.headers || {}) };
  if (cookies) headers.cookie = cookies;
  const raw = init.body && typeof init.body === "string" ? init.body : init.body ? JSON.stringify(init.body) : undefined;
  const res = await fetch(`${BASE}${path}`, { ...init, body: raw, headers });
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body };
}

/* ---------- клипы и аккаунт ---------- */
const stamp = randomUUID().slice(0, 8);
const clips = [
  { id: `selftest-v23-a-${stamp}`, label: "real" },
  { id: `selftest-v23-b-${stamp}`, label: "synth" },
  { id: `selftest-v23-dead-${stamp}`, label: "real" },
];
let cookie = null;
let accountId = null;

async function cleanup() {
  for (const c of clips) {
    await q(`DELETE FROM "Bet" WHERE "clipCode" = $1`, [c.id]).catch(() => {});
    await q(`DELETE FROM "Round" WHERE "clipCode" = $1`, [c.id]).catch(() => {});
    await q(`DELETE FROM clips WHERE id = $1`, [c.id]).catch(() => {});
  }
  if (!accountId) return;
  const ph = "$1";
  await q(`DELETE FROM badges WHERE "accountId" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM freebets WHERE "accountId" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM shop_purchases WHERE "account_id" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM withdraw_attempts WHERE "accountId" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM referral_rewards WHERE "referrer_id" = ${ph} OR "referee_id" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM "LedgerTxn" WHERE "accountId" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM "EmailAuth" WHERE "accountId" = ${ph}`, [accountId]).catch(() => {});
  await q(`DELETE FROM "Account" WHERE id = ${ph}`, [accountId]).catch(() => {});
}

try {
  console.log(`\n=== v23 raffle selftest :: ${BASE} :: ${stamp} ===\n`);

  /* --- 1. очередь: два живых + один битый, метки real/synth --- */
  for (const c of clips) {
    const url = c.id.includes("dead") ? DEAD_URL : GOOD_MP4;
    await q(
      `INSERT INTO clips (id, source_url, video_url, caption_public, label, label_commit, status,
         listed_by, media_type, media_json, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'queued','selftest','video','{}', now(), now())`,
      [c.id, `https://threads.example/${c.id}`, url, "v23 selftest raffle", c.label, commitOf(c.id, c.label)]
    );
  }
  ok("3 queued selftest clips inserted", true);

  /* --- 2. ленивый тик через /api/round?clip= → bulk-promote --- */
  console.log("[2] lazy tick → bulk promote");
  const probe = await api(`/api/round?clip=${clips[0].id}`, {}, cookie);
  ok("round probe answered", probe.status === 200, JSON.stringify(probe.body).slice(0, 120));
  await new Promise((r) => setTimeout(r, 1500));

  const a = await one(
    `select status, opens_at, closes_at, extract(epoch from (closes_at - opens_at))::int win
       from clips where id = $1`, [clips[0].id]
  );
  ok("live clip A status=live", a?.status === "live", JSON.stringify(a));
  ok("window = 604800s (неделя)", a?.win >= 604700 && a?.win <= 604900, `win=${a?.win}`);

  const b = await one(`select status from clips where id = $1`, [clips[1].id]);
  ok("live clip B status=live", b?.status === "live");
  const d = await one(`select status from clips where id = $1`, [clips[2].id]);
  ok("dead clip → void", d?.status === "void");

  const ra = await one(
    `select id, status, "poolRealCents", "poolSynthCents" from "Round" where "clipCode" = $1`,
    [clips[0].id]
  );
  ok("round A created open", ra?.status === "open", JSON.stringify(ra));

  /* --- 3. регистрация + ставка 25 EYE на REAL раффла A --- */
  console.log("[3] account + bet");
  const email = `qa-v23-${stamp}@nr-qa.test.local`;
  const r1 = await api("/api/auth/password", {
    method: "POST",
    body: { email, password: "qa-pass-2328", key: ACCESS_KEY || undefined },
  });
  for (const sc of (r1.rawCookies || [])) { /* noop */ }
  // cookies: повторный вызов fetch не отдаёт set-cookie тут — забираем из заголовков
  ok("account ready", r1.status === 200, JSON.stringify(r1.body).slice(0, 120));
  const acc = await one(`select id from "Account" where email = $1`, [email]);
  accountId = acc?.id ?? null;
  ok("accountId found", Boolean(accountId));

  // сессия: логин через второй вызов и перехват set-cookie
  const res2 = await fetch(`${BASE}/api/auth/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "qa-pass-2328" }),
  });
  cookie = (res2.headers.getSetCookie?.() || []).map((s) => s.split(";")[0]).join("; ");
  ok("session cookie captured", cookie.includes("nr_uid=") || cookie.includes("nr_auth="));

  const me0 = await api("/api/me", {}, cookie);
  const baseline = me0.body?.account?.balanceCents ?? -1;
  ok("baseline balance=100", baseline === 100, `baseline=${baseline}`);

  const bet = await api(
    "/api/bet",
    { method: "POST", body: { round_id: ra.id, side: "real", amount_cents: 25, mode: "balance" } },
    cookie
  );
  ok("bet placed active", bet.status === 200 && bet.body?.status === "active", JSON.stringify(bet.body).slice(0, 160));

  const ra2 = await one(
    `select "poolRealCents", "poolSynthCents" from "Round" where id = $1`, [ra.id]
  );
  ok("poolReal=25 after bet", ra2?.poolRealCents === 25, JSON.stringify(ra2));

  /* --- 4. закрыли окно → ленивый авторезолв --- */
  console.log("[4] force window close → auto-resolve");
  await q(`UPDATE "Round" SET "closesAt" = now() - interval '5 seconds' WHERE id = $1`, [ra.id]);
  await q(`UPDATE clips SET closes_at = now() - interval '5 seconds' WHERE id = $1`, [clips[0].id]);

  const r3 = await api(`/api/round/${ra.id}`, {}, cookie);
  ok("resolved via lazy tick", r3.body?.round?.status === "resolved", JSON.stringify(r3.body?.round ?? {}).slice(0, 200));
  ok("verdict matches label (real)", r3.body?.round?.resolvedAs === "real");
  ok("hash matched", r3.body?.round?.hashMatched === true);

  const me1 = await api("/api/me", {}, cookie);
  const after = me1.body?.account?.balanceCents ?? -1;
  /* единственный победитель: payout = prize(25 − rake 10%) = 22 + guess-награда ≥ 22 */
  ok("payout credited (net ≥ −3)", after - baseline >= -3, `${baseline} → ${after}`);

  const betRow = await one(
    `select status, "payoutCents" pay from "Bet" where "roundId" = $1 limit 1`, [ra.id]
  );
  ok("bet won", betRow?.status === "won" && (betRow?.pay ?? 0) > 0, JSON.stringify(betRow));

  /* --- итог --- */
  console.log(`\n=== ${passed} PASS / ${failed} FAIL ===`);
} catch (e) {
  failed++;
  console.error("selftest crashed:", e?.message || e);
} finally {
  await cleanup().catch(() => {});
  const left = await one(
    `select count(*)::int n from clips where id like 'selftest-v23-%'`
  ).catch(() => ({ n: -1 }));
  console.log(`cleanup: selftest-v23 clips left = ${left?.n ?? "?"}`);
  await close().catch(() => {});
}
process.exit(failed ? 1 : 0);
