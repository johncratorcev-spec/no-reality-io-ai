#!/usr/bin/env node
/**
 * Selftest v5: КРИПТО-МАРКЕТ + БУСТ + новые API предикшен-ленты —
 * против работающего dev-сервера :3000, поднятого с env:
 *
 *   TWOTHOUSAND328_API_BASE=http://127.0.0.1:9999/api
 *   TWOTHOUSAND328_PAYMENT_API_KEY=test-payment-key
 *   TWOTHOUSAND328_PAYOUT_API_KEY=test-payout-key
 *   TWOTHOUSAND328_PROJECT_UUID=test-project-uuid
 *
 * Проверяет:
 *  A. крипто-покупка промпта витрины (neon-rain, $12):
 *     1. POST /api/prompts/neon-rain/checkout → payUrl мока 2328, nr_buyer
 *     2. Purchase pending в БД, orderId nr-<uuid>-<ref> (реф вшит)
 *     3. webhook с битой подписью → 401, покупка остаётся pending
 *     4. webhook payment paid (верный HMAC) → paid → ready_for_payout
 *     5. GET /api/prompts/neon-rain/status → unlocked, prompt_full,
 *        soldTotal ≥ 1 (scarcity)
 *     6. рефералка: ReferralEvent(kind=paid), payout = 20% суммы
 *     7. TrackEvent prompt_unlock + referral_earn записаны
 *  B. буст клипа (Boosted / Featured Clip):
 *     8. POST /api/boost/checkout {days:3} → amount 9.00, BoostOrder pending
 *     9. webhook paid → paidUntil ≈ now+3д, paymentId записан
 *    10. GET /api/boost/status → active:true (ранжирование поднимет)
 *    11. повторный webhook paid → идемпотентно 200
 *    12. webhook cancel на свежий pending → failed
 *    13. TrackEvent boost_purchase записан
 *  C. API предикшен-ленты:
 *    14. GET /api/bet/live → betting:number
 *    15. GET /api/bet/hard → codes:array
 *    16. GET /api/bet/leaderboard → rows:array, mine|null
 *    17. POST /api/me/attach-bets без кошелька → 400
 *
 * Запуск: node scripts/market_boost_selftest.mjs
 * Мок 2328: scripts/mock-2328.mjs (:9999) — поднимается автоматически.
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const DB_PATH = path.resolve(process.cwd(), "db/custom.db");
const PAYMENT_KEY = "test-payment-key";
const REF_CODE = "rrv5test1";
const ITEM = "neon-rain";
const CLIP = "71vsIPUu";

let passed = 0;
let failed = 0;
const cleanup = { purchases: [], boosts: [], refs: [], events: [] };

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function db() {
  return new DatabaseSync(DB_PATH);
}

function sign2328(body, key) {
  const base64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64");
  return createHmac("sha256", key).update(base64, "utf-8").digest("hex");
}

/* ---------- cookie-jar fetch (nr_buyer) ---------- */
function makeClient(name) {
  let cookie = "";
  return async function api(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        "user-agent": `market-boost-selftest/1.0 (${name})`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.getSetCookie?.() || [res.headers.get("set-cookie") || ""];
    for (const c of sc) {
      const m = /nr_buyer=([^;]+)/.exec(c || "");
      if (m) cookie = `nr_buyer=${m[1]}`;
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  };
}

/* ---------- mock-2328 launcher ---------- */
async function ensureMock() {
  try {
    await fetch("http://127.0.0.1:9999/api/v1/payment/info", {
      method: "POST",
      signal: AbortSignal.timeout(800),
    });
    console.log("[mock-2328] уже работает на :9999");
    return null;
  } catch {
    const child = spawn(
      process.execPath,
      [path.resolve(process.cwd(), "scripts/mock-2328.mjs")],
      { stdio: "ignore", detached: false }
    );
    for (let i = 0; i < 20; i++) {
      try {
        await fetch("http://127.0.0.1:9999/api/v1/payment/info", {
          method: "POST",
          signal: AbortSignal.timeout(800),
        });
        console.log("[mock-2328] поднят на :9999");
        return child;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error("mock-2328 не поднялся");
  }
}

async function webhook2328(payload, key) {
  const sign = sign2328(payload, key);
  const res = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sign }),
  });
  return res.status;
}

/* ---------- тест ---------- */
async function run() {
  console.log(`\n[market-boost-selftest] ${BASE} — крипто-маркет + буст (v5)\n`);

  const C = makeClient("buyer-v5");

  /* === A. крипто-покупка промпта === */
  const co = await C("POST", `/api/prompts/${ITEM}/checkout`, { ref: REF_CODE });
  ok("checkout принял (crypto-only)", co.status === 200 && typeof co.json.payUrl === "string", co.json.payUrl || co.json.error);
  ok("инвойс от мока 2328", String(co.json.payUrl || "").includes("/pay/"));
  ok("сумма $12.00", co.json.amountUsdt === "12.00", co.json.amountUsdt);

  const payUuid = String(co.json.payUrl || "").split("/pay/")[1] || "";
  const pur = db()
    .prepare("SELECT id, orderId, status, amountUsdt FROM Purchase WHERE paymentId = ?")
    .get(payUuid);
  ok("Purchase pending в БД", pur?.status === "pending", pur?.status);
  ok("реф вшит в orderId", String(pur?.orderId || "").endsWith(`-${REF_CODE}`), pur?.orderId);
  cleanup.purchases.push(pur?.id);
  cleanup.refs.push(pur?.orderId);

  /* webhook: битая подпись → 401, статус не меняется */
  const bad = await webhook2328(
    { uuid: payUuid, order_id: pur.orderId, payment_status: "paid", txid: "mock-tx-1", amount: "12.00", currency: "USDT" },
    "wrong-key-XXXX"
  );
  ok("webhook с битой подписью → 401", bad === 401);
  const stillPending = db().prepare("SELECT status FROM Purchase WHERE id = ?").get(pur.id);
  ok("после 401 покупка осталась pending", stillPending?.status === "pending");

  /* webhook: верная подпись → paid → ready_for_payout */
  const good = await webhook2328(
    { uuid: payUuid, order_id: pur.orderId, payment_status: "paid", txid: "mock-tx-1", amount: "12.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("payment webhook принят", good === 200);
  const paidRow = db().prepare("SELECT status FROM Purchase WHERE id = ?").get(pur.id);
  ok("покупка paid → ready_for_payout", paidRow?.status === "ready_for_payout", paidRow?.status);

  /* статус: unlocked + prompt + soldTotal */
  const st1 = await C("GET", `/api/prompts/${ITEM}/status`);
  ok("status unlocked после оплаты", st1.json.unlocked === true);
  ok("prompt_full выдан", typeof st1.json.prompt === "string" && st1.json.prompt.length > 40, `${st1.json.prompt?.length ?? 0} симв.`);
  ok("soldTotal (scarcity) ≥ 1", (st1.json.soldTotal ?? 0) >= 1, `sold=${st1.json.soldTotal}`);
  ok("цена в статусе", st1.json.priceUsdt === "12.00", st1.json.priceUsdt);

  /* чужой покупатель не видит промпт */
  const Stranger = makeClient("stranger");
  const st2 = await Stranger("GET", `/api/prompts/${ITEM}/status`);
  ok("чужому prompt не отдаётся", st2.json.unlocked === false && st2.json.prompt == null);

  /* рефералка: ReferralEvent(kind=paid) с 20% */
  const refRow = db()
    .prepare("SELECT refCode, kind, amountUsdt, payoutUsdt FROM ReferralEvent WHERE orderId = ?")
    .get(pur.orderId);
  ok("ReferralEvent kind=paid", refRow?.kind === "paid", refRow?.kind);
  ok("рефереру 20% = 2.40 USDT", refRow?.payoutUsdt === "2.40", refRow?.payoutUsdt);

  /* аналитика */
  const evUnlock = db()
    .prepare("SELECT COUNT(*) AS n FROM TrackEvent WHERE name = 'prompt_unlock' AND clipCode = ?")
    .get(ITEM);
  ok("TrackEvent prompt_unlock", (evUnlock?.n ?? 0) >= 1);
  const evRefEarn = db()
    .prepare("SELECT COUNT(*) AS n FROM TrackEvent WHERE name = 'referral_earn'")
    .get();
  ok("TrackEvent referral_earn", (evRefEarn?.n ?? 0) >= 1);
  cleanup.events.push(ITEM);

  /* === B. буст клипа === */
  const B = makeClient("booster-v5");
  const bo = await B("POST", "/api/boost/checkout", { code: CLIP, days: 3 });
  ok("boost checkout принял", bo.status === 200 && typeof bo.json.payUrl === "string", bo.json.error || bo.json.amountUsdt);
  ok("буст $9.00 за 3 дня", bo.json.amountUsdt === "9.00", bo.json.amountUsdt);
  const boostUuid = String(bo.json.payUrl || "").split("/pay/")[1] || "";
  const boostRow = db().prepare("SELECT id, orderId, status, days, amountUsdt FROM BoostOrder WHERE paymentId = ?").get(boostUuid);
  ok("BoostOrder pending в БД", boostRow?.status === "pending" && boostRow?.days === 3, boostRow?.status);
  ok("orderId bs-*", String(boostRow?.orderId || "").startsWith("bs-"), boostRow?.orderId);
  cleanup.boosts.push(boostRow?.id);

  const bBad = await webhook2328(
    { uuid: boostUuid, order_id: boostRow.orderId, payment_status: "paid", txid: "mock-tx-2", amount: "9.00", currency: "USDT" },
    "wrong-key-XXXX"
  );
  ok("boost webhook битая подпись → 401", bBad === 401);

  const bGood = await webhook2328(
    { uuid: boostUuid, order_id: boostRow.orderId, payment_status: "paid", txid: "mock-tx-2", amount: "9.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("boost payment webhook принят", bGood === 200);
  const paidBoost = db().prepare("SELECT status, paidUntil FROM BoostOrder WHERE id = ?").get(boostRow.id);
  ok("буст paid, paidUntil установлен", paidBoost?.status === "paid" && Boolean(paidBoost?.paidUntil), paidBoost?.paidUntil);
  const paidUntilMs = paidBoost?.paidUntil ? new Date(paidBoost.paidUntil).getTime() : 0;
  const expectMs = Date.now() + 3 * 24 * 3600 * 1000;
  ok("paidUntil ≈ now+3д", Math.abs(paidUntilMs - expectMs) < 60_000, `${Math.round((paidUntilMs - Date.now()) / 3600000)}ч до конца`);

  /* идемпотентность: повторный paid → 200, paidUntil не сдвигается */
  const dup = await webhook2328(
    { uuid: boostUuid, order_id: boostRow.orderId, payment_status: "paid", txid: "mock-tx-2", amount: "9.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("повторный webhook → 200 (идемпотентно)", dup === 200);
  const dupBoost = db().prepare("SELECT paidUntil FROM BoostOrder WHERE id = ?").get(boostRow.id);
  ok("paidUntil не сдвинулся", String(dupBoost?.paidUntil) === String(paidBoost?.paidUntil));

  /* статус-эндпоинт видит активный буст */
  const bst = await B("GET", `/api/boost/status?code=${CLIP}`);
  ok("boost/status active:true", bst.json.active === true);

  /* cancel → failed на свежем ордере */
  const bo2 = await B("POST", "/api/boost/checkout", { code: CLIP, days: 1 });
  const uuid2 = String(bo2.json.payUrl || "").split("/pay/")[1] || "";
  const row2 = db().prepare("SELECT id, orderId FROM BoostOrder WHERE paymentId = ?").get(uuid2);
  cleanup.boosts.push(row2?.id);
  const cancelled = await webhook2328(
    { uuid: uuid2, order_id: row2.orderId, payment_status: "cancel", txid: null, amount: "3.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("cancel webhook принят", cancelled === 200);
  const failedRow = db().prepare("SELECT status FROM BoostOrder WHERE id = ?").get(row2.id);
  ok("буст cancel → failed", failedRow?.status === "failed", failedRow?.status);

  const evBoost = db()
    .prepare("SELECT COUNT(*) AS n FROM TrackEvent WHERE name = 'boost_purchase' AND clipCode = ?")
    .get(CLIP);
  ok("TrackEvent boost_purchase", (evBoost?.n ?? 0) >= 1);

  /* === C. API предикшен-ленты === */
  const V = makeClient("viewer-v5");
  const live = await V("GET", "/api/bet/live");
  ok("bet/live отвечает", live.status === 200 && typeof live.json.betting === "number", `betting=${live.json.betting}`);
  const hard = await V("GET", "/api/bet/hard");
  ok("bet/hard отвечает", hard.status === 200 && Array.isArray(hard.json.codes), `codes=${hard.json.codes?.length ?? 0}`);
  const lb = await V("GET", "/api/bet/leaderboard");
  ok("bet/leaderboard отвечает", lb.status === 200 && Array.isArray(lb.json.rows), `rows=${lb.json.rows?.length ?? 0}`);
  const attachNoWallet = await V("POST", "/api/me/attach-bets");
  ok("attach-bets без кошелька → 400", attachNoWallet.status === 400);

  /* boost checkout на несуществующий клип → 404 */
  const badClip = await V("POST", "/api/boost/checkout", { code: "zzzzzzzz", days: 1 });
  ok("boost на неизвестный клип → 404", badClip.status === 404);

  /* ---------- итог ---------- */
  console.log(`\n[market-boost-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- cleanup тестовых строк ---------- */
function cleanupDb() {
  try {
    const d = db();
    for (const id of cleanup.purchases) {
      if (!id) continue;
      d.prepare("DELETE FROM Purchase WHERE id = ?").run(id);
    }
    for (const id of cleanup.boosts) {
      if (!id) continue;
      d.prepare("DELETE FROM BoostOrder WHERE id = ?").run(id);
    }
    for (const oid of cleanup.refs) {
      if (!oid) continue;
      d.prepare("DELETE FROM ReferralEvent WHERE orderId = ?").run(oid);
    }
    if (cleanup.events.length || cleanup.refs.length) {
      d.prepare("DELETE FROM TrackEvent WHERE name IN ('prompt_unlock','referral_earn','boost_purchase')").run();
    }
    d.close();
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  cleanupDb();
  console.log("[market-boost-selftest] cleanup done");
} else {
  const mock = await ensureMock();
  try {
    await run();
  } finally {
    cleanupDb();
    if (mock) mock.kill();
  }
}
