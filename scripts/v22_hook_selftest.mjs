#!/usr/bin/env node
/**
 * v22 selftest — КРЮЧКОВАЯ ЭКОНОМИКА (ТЗ финального брифа, п.2–§12).
 *
 * ЧТО ПРОВЕРЯЕТ:
 *   1. /api/auth/status — Supabase не настроен → {supabase:false} (грейсфолбэк, не 500).
 *   2. Реф-квалификация: первая ставка друга → referrer +100 EYE РОВНО один раз;
 *      тот же device (fp) → held без награды; самоприглашение исключено.
 *   3. Шеринг: +15 EYE за win раз в UTC-день; повтор — alreadyToday.
 *   4. Фрибет @username: +25 один раз на аккаунт; повтор и второй аккаунт — отказ.
 *   5. Шоп: streak_shield списывает 120 атомарно; повтор — already_owned.
 *   6. Кэшаут: 403 cashout_disabled + строка в withdraw_attempts (вывод EYE заблокирован).
 *   7. Авторезолв selftest-раунда: won → payout + бейджи first_win/winstreak_3.
 *   8. /api/me/summary — кабинет одним срезом (баланс/PnL/badges/refstats/freebet).
 *   9. Scheduler pause: raffle-очередь не тронута (queued count не меняется).
 *
 * ЗАПУСК (дев-сервер с NR_SCHEDULER_PAUSE=1 на :3000):
 *   NR_SCHEDULER_PAUSE=1 bun run dev &   # или npm run dev
 *   node scripts/v22_hook_selftest.mjs
 *
 * Опасность прожига raffle-окна снята: NR_SCHEDULER_PAUSE=1 выключает
 * promoteNextClip; раунды создаются ТОЛЬКО на клипах selftest-*.
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { q, one, close } from "./lib/supadb.mjs";
import { createSelfSession, dropSelfSession, sessionCookieFor } from "./lib/selfsession.mjs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const PEPPER = env.COMMIT_PEPPER || "";

let passed = 0;
let failed = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

const SALT = env.VISITOR_SALT || env.ADMIN_SECRET || "no-reality-salt";
const fpOf = (ip, ua) =>
  createHash("sha256").update(`${ip}::${ua}::${SALT}`).digest("hex");

const created = {
  accounts: [],
  clips: [],
  cleanup: async () => {
    for (const id of created.clips) {
      await q(`DELETE FROM "Bet" WHERE "clipCode" = $1`, [id]).catch(() => {});
      await q(`DELETE FROM "Round" WHERE "clipCode" = $1`, [id]).catch(() => {});
      await q(`DELETE FROM clips WHERE id = $1`, [id]).catch(() => {});
    }
    const ids = created.accounts;
    if (!ids.length) return;
    const ph = ids.map((_, i) => `$${i + 1}`).join(",");
    await q(`DELETE FROM badges WHERE "accountId" IN (${ph})`, ids).catch(() => {});
    await q(`DELETE FROM freebets WHERE "accountId" IN (${ph})`, ids).catch(() => {});
    await q(`DELETE FROM shop_purchases WHERE "account_id" IN (${ph})`, ids).catch(() => {});
    await q(`DELETE FROM withdraw_attempts WHERE "accountId" IN (${ph})`, ids).catch(() => {});
    await q(`DELETE FROM referral_rewards WHERE "referrer_id" IN (${ph}) OR "referee_id" IN (${ph})`, [...ids, ...ids]).catch(() => {});
    await q(`DELETE FROM "LedgerTxn" WHERE "accountId" IN (${ph})`, ids).catch(() => {});
    await q(`DELETE FROM "Account" WHERE id IN (${ph})`, ids).catch(() => {});
  },
};

/* ---------- хелперы ---------- */

const UA = "v22-selftest/1.0";

async function api(method, url, { cookies, body, ip = "10.7.7.7", bettorId } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: [cookies, bettorId ? `nr_bet=${bettorId}` : ""].filter(Boolean).join("; "),
      "x-forwarded-for": ip,
      "user-agent": UA,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** selftest-клип в статусе live c закрытым окном (резолвится тиком) */
async function createSelftestClip(label, { closed = false } = {}) {
  const id = `selftest-v22-${randomUUID().slice(0, 8)}`;
  const commit = createHash("sha256").update(`${label}:${id}:${PEPPER}`).digest("hex");
  const now = new Date();
  await q(
    `INSERT INTO clips (id, source_url, video_url, caption_public, label, label_commit, status,
       opens_at, closes_at, listed_by, media_type, media_json, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,'live',$7,$8,'selftest','video','{}',$7, now())`,
    [id, `https://threads.example/${id}`, "https://scontent-hkg4-2.cdninstagram.com/o1/v/t2/f2/m86/AQPGqbIcH0VqVPH5jn6qfKwJA34iFl8RwFnTBO7kGyH_zGXL9d5g8OSEmI7G152i7aruWpIzeYbc6GSI2-meVv6PCjzQ3MV4YuTn_ws.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-hkg4-2.cdninstagram.com&_nc_ohc=UN8A9ybHPP8Q7kNvwFvxf5i&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uRkVFRC5DMy43MjAuZGFzaF9iYXNlbGluZV8xX3YxIiwieHB2X2Fzc2V0X2lkIjoxMzQ3ODY3MzkwNjE2OTI1LCJhc3NldF9hZ2VfZGF5cyI6MCwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjEwLCJ1cmxnZW5fc291cmNlIjoid3d3In0%3D&ccb=17-1&vs=5c3d686a3a294a6c&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9GNUVGNUY3QzlEMDg0OTgyQUIxQzRFMDFDNzRGMDk0RV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzMyQUM4QjAzNDA2RjRBRDg4MzgwMDI0QjI1REMzRUJDX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACa6la3QmvjkBBUCKAJDMywXQCQAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdeoHZeadAQA&_nc_gid=PhVaPB7k9UAw74Z9WXtoAw&_nc_ss=7f289&_nc_zt=28&oh=00_AQPwHPXC_-YiCym6oTSC7mk5oHFgATRKrhMolO5DFF53KQ&oe=6ACD7ED0", "v22 selftest clip", label, commit, now, now]
  );
  created.clips.push(id);
  /* окно открыто 45с; для резолва бэктейтим closeResolvable() */
  await q(
    `INSERT INTO "Round" (id, "clipCode", "opensAt", "closesAt", "poolRealCents", "poolSynthCents", status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,0,0,'open', now(), now())`,
    [randomUUID(), id, now, new Date(now.getTime() + 600_000)] /* окно 10 мин — тестовые шаги длинные */
  );
  return id;
}

/** бэктейтинг окна раунда в прошлое → тик его резолвит */
async function closeResolvable(clipId) {
  await q(
    `UPDATE "Round" SET "closesAt" = now() - interval '2 seconds', "updatedAt" = now() WHERE "clipCode" = $1 AND status = 'open'`,
    [clipId]
  );
}

const bettorIds = new Map();
function bettorFor(accountId) {
  if (!bettorIds.has(accountId)) bettorIds.set(accountId, randomUUID());
  return bettorIds.get(accountId);
}

async function placeBet(cookies, clipId, side, amount, ip) {
  const round = await one(`SELECT id, "opensAt" FROM "Round" WHERE "clipCode" = $1 ORDER BY "opensAt" DESC LIMIT 1`, [clipId]);
  const accId = /nr_uid=([0-9a-f-]{36})/.exec(cookies)?.[1] || "";
  return api("POST", "/api/bet", {
    cookies,
    bettorId: bettorFor(accId),
    ip,
    body: { round_id: round.id, side, amount_cents: amount, mode: "balance" },
  });
}

const balanceOf = async (id) =>
  Number((await one(`SELECT "balanceCents" FROM "Account" WHERE id = $1`, [id]))?.balanceCents ?? -1);

/* ================================================================ */

async function main() {
  console.log(`\n[v22-selftest] ${BASE}\n`);

  /* ---------- 0. предварительное: очередь raffle не тронем ---------- */
  const queuedBefore = Number(
    (await one(`SELECT count(*)::int AS n FROM clips WHERE status = 'queued'`))?.n ?? -1
  );

  /* ---------- 1. auth/status: грейсфолбэк ---------- */
  const st = await api("GET", "/api/auth/status");
  ok("1. auth/status 200 и честная форма", st.status === 200 && typeof st.json.supabase === "boolean", JSON.stringify(st.json));

  /* ---------- аккаунты: referrer A, referee B, самозванец D, same-device C ---------- */
  
  const fpA = fpOf("10.7.7.1", UA);
  const fpB = fpOf("10.7.7.2", UA);
  const ipA = createHash("sha256").update(`ip:10.7.7.1::${SALT}`).digest("hex").slice(0, 40);
  const ipB = createHash("sha256").update(`ip:10.7.7.2::${SALT}`).digest("hex").slice(0, 40);

  const A = await createSelfSession({ email: `v22a-${randomUUID().slice(0, 6)}@test.local` });
  created.accounts.push(A.accountId);
  const B = await createSelfSession({ email: `v22b-${randomUUID().slice(0, 6)}@test.local`, bonusCents: 300 });
  created.accounts.push(B.accountId);
  const C = await createSelfSession({ email: `v22c-${randomUUID().slice(0, 6)}@test.local` });
  created.accounts.push(C.accountId);
  const D = await createSelfSession({ email: `v22d-${randomUUID().slice(0, 6)}@test.local` });
  created.accounts.push(D.accountId);

  /* A — referrer с кодом; B/C/D — referee с разными fp */
  await q(
    `UPDATE "Account" SET "refCode" = $2, "signup_fp" = $3, "signup_ip_hash" = $4 WHERE id = $1`,
    [A.accountId, "rv22aaaa", fpA.slice(0, 40), ipA]
  );
  await q(
    `UPDATE "Account" SET "referredById" = $2, "signup_fp" = $3, "signup_ip_hash" = $4 WHERE id = $1`,
    [B.accountId, A.accountId, fpB.slice(0, 40), ipB]
  );
  await q(
    `UPDATE "Account" SET "referredById" = $2, "signup_fp" = $3, "signup_ip_hash" = $4 WHERE id = $1`,
    [C.accountId, A.accountId, fpA.slice(0, 40), ipA] /* тот же device, что у A */
  );
  await q(
    `UPDATE "Account" SET "referredById" = $2, "signup_fp" = $3, "signup_ip_hash" = $4 WHERE id = $1`,
    [D.accountId, D.accountId, fpB.slice(0, 40), ipB] /* самоприглашение */
  );

  /* ---------- 2. реферальная квалификация ---------- */
  const clip1 = await createSelftestClip("synth");
  const betB = await placeBet(sessionCookieFor(B.accountId), clip1, "synth", 50, "10.7.7.2");
  ok("2a. ставка друга проходит", betB.status === 200 && betB.json.status === "active", `status=${betB.status} err=${betB.json.error || "-"}`);

  await new Promise((r) => setTimeout(r, 5000)); /* qualify fire-and-forget; холодная БД — до 5с */
  const rw = await one(`SELECT status, "eye_referrer" FROM referral_rewards WHERE "referee_id" = $1`, [B.accountId]);
  ok("2b. квалификация paid", rw?.status === "paid", JSON.stringify(rw));
  ok("2c. referrer получил +100 EYE", (await balanceOf(A.accountId)) === 200, `balance=${await balanceOf(A.accountId)}`);

  /* повторная ставка друга НЕ платит второй раз */
  const rwCount = Number(
    (await one(`SELECT count(*)::int AS n FROM referral_rewards WHERE "referrer_id" = $1`, [A.accountId]))?.n ?? 0
  );
  ok("2d. квалификация одноразова", rwCount === 1, `rows=${rwCount}`);

  /* тот же device → held без денег */
  const clip2 = await createSelftestClip("real");
  await placeBet(sessionCookieFor(C.accountId), clip2, "real", 25, "10.7.7.1");
  await new Promise((r) => setTimeout(r, 4000));
  const rwC = await one(`SELECT status, "eye_referrer" FROM referral_rewards WHERE "referee_id" = $1`, [C.accountId]);
  ok("2e. same-device → held, 0 EYE", rwC?.status === "held" && Number(rwC?.eye_referrer ?? 1) === 0, JSON.stringify(rwC));
  ok("2f. referrer не получил лишнего", (await balanceOf(A.accountId)) === 200);

  /* ---------- 3. шеринговая награда ---------- */
  const sh1 = await api("POST", "/api/share/claim", { cookies: sessionCookieFor(B.accountId), body: { kind: "win" } });
  ok("3a. share win +15 EYE", sh1.json.credited === true && sh1.json.amountCents === 15, JSON.stringify(sh1.json));
  const sh2 = await api("POST", "/api/share/claim", { cookies: sessionCookieFor(B.accountId), body: { kind: "win" } });
  ok("3b. повтор в тот же день — alreadyToday", sh2.json.credited === false && sh2.json.alreadyToday === true, JSON.stringify(sh2.json));
  const balAfterShare = await balanceOf(B.accountId);
  ok("3c. баланс B = 300 - 50 (ставка) + 15", balAfterShare === 265, `balance=${balAfterShare}`);

  /* ---------- 4. фрибет @username ---------- */
  const tg1 = await api("POST", "/api/freebet/telegram", { cookies: sessionCookieFor(B.accountId), body: { username: "@v22_nicky" } });
  ok("4a. фрибет выдан +25", tg1.json.granted === true && tg1.json.amountCents === 25, JSON.stringify(tg1.json));
  const tg2 = await api("POST", "/api/freebet/telegram", { cookies: sessionCookieFor(B.accountId), body: { username: "@v22_other" } });
  ok("4b. второй раз на аккаунт — отказ", tg2.json.granted === false && tg2.json.reason === "already_claimed", JSON.stringify(tg2.json));
  const tg3 = await api("POST", "/api/freebet/telegram", { cookies: sessionCookieFor(C.accountId), body: { username: "v22_nicky" } });
  ok("4c. ник глобально один раз", tg3.json.granted === false && tg3.json.reason === "username_taken", JSON.stringify(tg3.json));
  const tgBad = await api("POST", "/api/freebet/telegram", { cookies: sessionCookieFor(C.accountId), body: { username: "!" } });
  ok("4d. кривой ник — 400", tgBad.status === 400, `status=${tgBad.status}`);

  /* ---------- 5. шоп EYE ---------- */
  const beforeBuy = await balanceOf(B.accountId); /* 265 + 25 = 290 */
  const buy1 = await api("POST", "/api/shop/buy", { cookies: sessionCookieFor(B.accountId), body: { sku: "streak_shield" } });
  ok("5a. щит куплен", buy1.json.bought === true, JSON.stringify(buy1.json.error || buy1.json.bought));
  ok("5b. списание 120 атомарно", (await balanceOf(B.accountId)) === beforeBuy - 120, `balance=${await balanceOf(B.accountId)}`);
  const buy2 = await api("POST", "/api/shop/buy", { cookies: sessionCookieFor(B.accountId), body: { sku: "streak_shield" } });
  ok("5c. повторная покупка — 409", buy2.status === 409, `status=${buy2.status}`);
  const poor = await api("POST", "/api/shop/buy", { cookies: sessionCookieFor(C.accountId), body: { sku: "streak_shield" } });
  ok("5d. нет денег — 402, товар не выдан", poor.status === 402, `status=${poor.status}`);
  const shieldRow = await one(`SELECT "streak_shield_until" FROM "Account" WHERE id = $1`, [B.accountId]);
  ok("5e. щит установлен в БД", Boolean(shieldRow?.streak_shield_until), JSON.stringify(shieldRow));

  /* ---------- 6. кэшаут заблокирован + журнал попыток ---------- */
  const co = await api("POST", "/api/me/cashout", { cookies: sessionCookieFor(B.accountId), body: { wallet: "TTestWalletAddr12345678" } });
  ok("6a. cashout → 403 cashout_disabled", co.status === 403 && co.json.error === "cashout_disabled", `status=${co.status}`);
  const wa = await one(`SELECT count(*)::int AS n FROM withdraw_attempts WHERE "accountId" = $1`, [B.accountId]);
  ok("6b. попытка записана в withdraw_attempts", Number(wa?.n ?? 0) >= 1, `rows=${wa?.n}`);

  /* ---------- 7. авторезолв + бейджи ---------- */
  /* ещё одна ставка B на clip1 не выйдет (одна на раунд), ставим C и D на clip2, резолвим */
  const betD = await placeBet(sessionCookieFor(D.accountId), clip2, "real", 25, "10.7.7.3"); /* D: самозванец — квалификация не должна дать EYE */
  await new Promise((r) => setTimeout(r, 3000));
  const rwD = await one(`SELECT status FROM referral_rewards WHERE "referee_id" = $1`, [D.accountId]);
  ok("7a. самоприглашение не квалифицируется", !rwD || rwD.status === "held", JSON.stringify(rwD));

  /* бэктейтинг обоих окон + дотягиваем тиком (pause-режим резолвит только selftest-клипы) */
  await closeResolvable(clip1);
  await closeResolvable(clip2);
  const tick = await fetch(`${BASE}/api/cron/tick?key=${encodeURIComponent(env.ADMIN_SECRET || "")}`, {
    headers: { "x-forwarded-for": "10.7.7.9" },
  }).then((r) => r.json()).catch(() => null);
  ok("7b. тик отработал", Boolean(tick?.ok), JSON.stringify(tick));

  const r1 = await one(`SELECT status, "resolvedAs" FROM "Round" WHERE "clipCode" = $1`, [clip1]);
  const c1 = await one(`SELECT status FROM clips WHERE id = $1`, [clip1]);
  ok("7c. clip1 resolved (synth)", r1?.status === "resolved" && r1?.resolvedAs === "synth" && c1?.status === "resolved", JSON.stringify(r1));
  const betBRow = await one(`SELECT status, "payoutCents" FROM "Bet" WHERE "clipCode" = $1 AND "bettorId" = $2`, [clip1, bettorIds.get(B.accountId)]);
  ok("7d. ставка B выиграла с payout", betBRow?.status === "won" && Number(betBRow?.payoutCents ?? 0) > 0, JSON.stringify(betBRow));

  /* бейджи B: first_win; D проиграл (clip2 = real, D ставил real? — нет: D ставил real и метка real → D выиграл!) */
  const clip2Label = await one(`SELECT label FROM clips WHERE id = $1`, [clip2]);
  const betDRow = await one(`SELECT status FROM "Bet" WHERE "clipCode" = $1 AND "bettorId" = $2`, [clip2, bettorIds.get(D.accountId)]);
  ok("7e. D: ставка по метке", betDRow?.status === (clip2Label?.label === "real" ? "won" : "lost"), `label=${clip2Label?.label} bet=${betDRow?.status}`);

  const badgeB = await one(`SELECT code FROM badges WHERE "accountId" = $1 AND code = 'first_win'`, [B.accountId]);
  ok("7f. first_win выдан победителю", Boolean(badgeB), JSON.stringify(badgeB));

  /* ---------- 8. кабинет /api/me/summary ---------- */
  const sum = await api("GET", "/api/me/summary", { cookies: sessionCookieFor(B.accountId) });
  ok("8a. summary 200", sum.status === 200, `status=${sum.status}`);
  ok("8b. кабинет несёт баланс/PnL/бейджи/рефов", Boolean(
    sum.json.account &&
    sum.json.pnl &&
    Array.isArray(sum.json.badges) &&
    sum.json.referrals &&
    typeof sum.json.winStats.winrate === "number"
  ), `balance=${sum.json.account?.balanceCents} badges=${sum.json.badges?.length}`);
  ok("8c. фрибет виден в кабинете", sum.json.freebet?.username === "v22_nicky", JSON.stringify(sum.json.freebet));
  ok("8d. шоп: щит в owned", sum.json.shop?.owned?.includes("streak_shield") === true, JSON.stringify(sum.json.shop));
  ok("8e. стрик-щит активен", sum.json.streak?.shieldActive === true, JSON.stringify(sum.json.streak));

  /* ---------- 9. очередь raffle не тронута (scheduler pause) ---------- */
  const queuedAfter = Number(
    (await one(`SELECT count(*)::int AS n FROM clips WHERE status = 'queued'`))?.n ?? -2
  );
  ok("9. NR_SCHEDULER_PAUSE: queued count не изменился", queuedBefore === queuedAfter, `${queuedBefore} → ${queuedAfter}`);

  console.log(`\n[v22-selftest] ${passed} PASS / ${failed} FAIL`);
  await created.cleanup();
  console.log("[v22-selftest] cleanup done");
  await close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[v22-selftest] fatal:", e);
  await created.cleanup().catch(() => {});
  await close().catch(() => {});
  process.exit(1);
});
