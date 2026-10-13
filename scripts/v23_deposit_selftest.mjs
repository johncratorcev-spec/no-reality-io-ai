#!/usr/bin/env node
/**
 * v23 — E2E «завод средств» (2328.io): полный контур пачек EYE против
 * работающего dev-сервера (:3000) и мок-сервера 2328 (:9999).
 *
 *   1. регистрация/вход (email+пароль, NR_ACCESS_KEY из .env);
 *   2. POST /api/packs {sku:300} → инвойс мока 2328 (payUrl 127.0.0.1:9999);
 *   3. вебхук с ВЕРНОЙ подписью (payment_status=paid) → +300 EYE;
 *   4. повтор того же вебхука идемпотентен (дубля нет);
 *   5. вебхук с битой подписью → 401, баланс не меняется;
 *   6. PayOrder в БД → status=paid;
 *   7. cleanup: тестовый аккаунт и его строки удаляются.
 *
 * Запуск (dev-сервер с NR_SCHEDULER_PAUSE=1 и мок-ключами 2328):
 *   node scripts/mock-2328.mjs &        # порт 9999
 *   npm run dev                          # порт 3000
 *   node scripts/v23_deposit_selftest.mjs
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
const PAYMENT_KEY = "test-payment-key";

/* ---- .env ---- */
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const ACCESS_KEY = env.NR_ACCESS_KEY || "";

let passed = 0, failed = 0;
function ok(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
}

function sign2328(body, key) {
  const b64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64");
  return createHmac("sha256", key).update(b64, "utf-8").digest("hex");
}

let cookie = null;
async function api(path, init = {}) {
  const headers = { "content-type": "application/json", ...(init.headers || {}) };
  if (cookie) headers.cookie = cookie;
  const raw = init.body && typeof init.body === "string" ? init.body : init.body ? JSON.stringify(init.body) : undefined;
  const res = await fetch(`${BASE}${path}`, { ...init, body: raw, headers });
  for (const sc of res.headers.getSetCookie?.() || []) {
    const pair = sc.split(";")[0];
    if (pair.startsWith("nr_uid=") || pair.startsWith("nr_auth=")) {
      cookie = cookie ? `${cookie}; ${pair}` : pair;
    }
  }
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body };
}

/* ---------- аккаунт ---------- */
const EMAIL = `qa-dep23-${randomUUID().slice(0, 8)}@nr-qa.test.local`;
const PASSWORD = "qa-pass-2328";
let accountId = null;

const created = {
  cleanup: async () => {
    if (!accountId) return;
    await q(`DELETE FROM pay_orders WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM deposit_orders WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM badges WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM freebets WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM shop_purchases WHERE "account_id" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM withdraw_attempts WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM referral_rewards WHERE "referrer_id" = $1 OR "referee_id" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM "LedgerTxn" WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM "EmailAuth" WHERE "accountId" = $1`, [accountId]).catch(() => {});
    await q(`DELETE FROM "Account" WHERE id = $1`, [accountId]).catch(() => {});
  },
};

try {
  console.log(`\n=== v23 deposit selftest :: ${BASE} :: ${EMAIL} ===\n`);

  /* --- 1. регистрация (ключ, если задан) --- */
  console.log("[1] POST /api/auth/password");
  const r1 = await api("/api/auth/password", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD, key: ACCESS_KEY || undefined },
  });
  ok("register/login 200", r1.status === 200, JSON.stringify(r1.body).slice(0, 200));
  ok("session cookies set", Boolean(cookie));
  accountId = r1.body?.accountId ?? null;
  if (!accountId) {
    const row = await one(`select id from "Account" where email = $1`, [EMAIL]).catch(() => null);
    accountId = row?.id ?? null;
  }
  ok("accountId known", Boolean(accountId));

  /* --- 2. базовый баланс --- */
  const me0 = await api("/api/me");
  const baseline = me0.body?.account?.balanceCents ?? 0;
  ok("baseline balance read", me0.status === 200, `baseline=${baseline}`);

  /* --- 3. инвойс пачки 300 EYE = 2.5 USDT --- */
  console.log("[3] POST /api/packs {sku:300}");
  const r3 = await api("/api/packs", { method: "POST", body: { sku: 300 } });
  ok("packs 200", r3.status === 200, JSON.stringify(r3.body).slice(0, 200));
  ok("payUrl от мока 2328", typeof r3.body?.payUrl === "string" && r3.body.payUrl.includes("127.0.0.1:9999"), r3.body?.payUrl);
  ok("orderId eye-*", typeof r3.body?.orderId === "string" && r3.body.orderId.startsWith("eye-"), r3.body?.orderId);
  ok("eye=300", r3.body?.eye === 300);
  const orderId = r3.body?.orderId ?? "";
  const paymentUuid = `mock-uuid-${randomUUID().slice(0, 8)}`;

  /* --- 4. вебхук с верной подписью → +300 EYE --- */
  console.log("[4] POST /api/webhooks/2328 (signed, paid)");
  const hook = {
    uuid: paymentUuid,
    order_id: orderId,
    payment_status: "paid",
    txid: "mock-tx-2328",
    amount: "2.50",
    currency: "USDT",
    payer_amount: "2.50",
    payer_currency: "USDT",
    merchant_amount: "2.50",
  };
  const r4 = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...hook, sign: sign2328(hook, PAYMENT_KEY) }),
  });
  ok("webhook 200", r4.status === 200, String(r4.status));
  await new Promise((r) => setTimeout(r, 800));

  const me1 = await api("/api/me");
  const after1 = me1.body?.account?.balanceCents ?? -1;
  /* 1 единица balanceCents = 1 EYE (v23 fix подтверждает кабинет) */
  ok("balance +300 (300 EYE)", after1 - baseline === 300, `${baseline} → ${after1}`);

  const po = await one(
    `select status, "eye_amount" eye from pay_orders where "order_id" = $1`,
    [orderId]
  ).catch(() => null);
  ok("PayOrder status=paid", po?.status === "paid", JSON.stringify(po));

  /* --- 5. повтор вебхука идемпотентен --- */
  console.log("[5] replay webhook");
  const r5 = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...hook, sign: sign2328(hook, PAYMENT_KEY) }),
  });
  ok("replay 200", r5.status === 200);
  await new Promise((r) => setTimeout(r, 500));
  const me2 = await api("/api/me");
  ok("balance unchanged (no double credit)", (me2.body?.account?.balanceCents ?? -1) === after1);

  /* --- 6. битая подпись → 401, баланс не тронут --- */
  console.log("[6] bad-signature webhook");
  const other = { ...hook, uuid: `evil-${randomUUID().slice(0, 6)}`, order_id: `eye-evil-${randomUUID().slice(0, 6)}` };
  const r6 = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...other, sign: sign2328(other, "wrong-key") }),
  });
  ok("bad sign → 401", r6.status === 401, String(r6.status));
  const me3 = await api("/api/me");
  ok("balance still unchanged", (me3.body?.account?.balanceCents ?? -1) === after1);

  /* --- итог --- */
  console.log(`\n=== ${passed} PASS / ${failed} FAIL ===`);
} catch (e) {
  failed++;
  console.error("selftest crashed:", e?.message || e);
} finally {
  await created.cleanup().catch(() => {});
  const left = await one(
    `select count(*)::int n from "Account" where email like 'qa-dep23-%'`
  ).catch(() => ({ n: -1 }));
  console.log(`cleanup: qa-dep23 accounts left = ${left?.n ?? "?"}`);
  await close().catch(() => {});
}
process.exit(failed ? 1 : 0);
