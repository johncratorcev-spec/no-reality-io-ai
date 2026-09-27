#!/usr/bin/env node
/**
 * Selftest v6: БУСТ + API предикшен-ленты (продажа промптов удалена из
 * продукта — рыночные проверки переехали в историю, экономика живёт в
 * economy_selftest.mjs) — против работающего dev-сервера :3000 с env:
 *
 *   TWOTHOUSAND328_API_BASE=http://127.0.0.1:9999/api
 *   TWOTHOUSAND328_PAYMENT_API_KEY=test-payment-key
 *   TWOTHOUSAND328_PAYOUT_API_KEY=test-payout-key
 *   TWOTHOUSAND328_PROJECT_UUID=test-project-uuid
 *
 * Проверяет:
 *  B. буст клипа (Boosted / Featured Clip):
 *     1. POST /api/boost/checkout {days:3} → amount 9.00, BoostOrder pending
 *     2. webhook paid → paidUntil ≈ now+3д, paymentId записан
 *     3. GET /api/boost/status → active:true (ранжирование поднимет)
 *     4. повторный webhook paid → идемпотентно 200
 *     5. webhook cancel на свежий pending → failed
 *     6. TrackEvent boost_purchase записан
 *  C. API предикшен-ленты:
 *     7. GET /api/bet/live → betting:number
 *     8. GET /api/bet/hard → codes:array
 *     9. GET /api/bet/leaderboard → rows:array
 *    10. POST /api/me/attach-bets без кошелька → 400
 *  D. продажа промптов удалена:
 *    11. GET /market → 308 на /bet
 *    12. POST /api/prompts/x/checkout → 404
 *
 * Запуск: node scripts/boost_selftest.mjs
 * Мок 2328: scripts/mock-2328.mjs (:9999) — поднимается автоматически.
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const DB_PATH = path.resolve(process.cwd(), "db/custom.db");
const PAYMENT_KEY = "test-payment-key";
const CLIP = "71vsIPUu";

let passed = 0;
let failed = 0;
const cleanup = { boosts: [], events: [] };

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

/* ---------- cookie-jar fetch ---------- */
function makeClient(name) {
  let cookie = "";
  return async function api(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        "user-agent": `boost-selftest/1.0 (${name})`,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json, location: res.headers.get("location") };
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
  console.log(`\n[boost-selftest] ${BASE} — буст + API ленты (v6)\n`);

  const B = makeClient("booster-v6");

  /* === B. буст клипа === */
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
  cleanup.events.push("boost_purchase");

  /* === C. API предикшен-ленты === */
  const V = makeClient("viewer-v6");
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

  /* === D. продажа промптов удалена (v6) === */
  const marketRedirect = await fetch(`${BASE}/market`, { redirect: "manual" });
  ok("/market → 308", marketRedirect.status === 308, marketRedirect.headers.get("location") || "");
  const promptsGone = await V("POST", "/api/prompts/neon-rain/checkout", {});
  ok("api/prompts checkout удалён → 404", promptsGone.status === 404);
  const marketPageGone = await V("GET", "/market/thanks");
  ok("страница /market/thanks удалена", marketPageGone.status === 308);

  /* ---------- итог ---------- */
  console.log(`\n[boost-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- cleanup тестовых строк ---------- */
function cleanupDb() {
  try {
    const d = db();
    for (const id of cleanup.boosts) {
      if (!id) continue;
      d.prepare("DELETE FROM BoostOrder WHERE id = ?").run(id);
    }
    if (cleanup.events.length) {
      d.prepare("DELETE FROM TrackEvent WHERE name IN ('boost_purchase')").run();
    }
    d.close();
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  cleanupDb();
  console.log("[boost-selftest] cleanup done");
} else {
  const mock = await ensureMock();
  try {
    await run();
  } finally {
    cleanupDb();
    if (mock) mock.kill();
  }
}
