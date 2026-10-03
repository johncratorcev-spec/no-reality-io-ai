#!/usr/bin/env node
/**
 * Selftest v16: ОТКРЫТЫЕ ДВЕРИ — против работающего dev-сервера :3000
 * (Supabase Postgres). Наследник v12: password/telegram/magic-вход
 * УДАЛЕНЫ, единственная дверь — Google (passport-google-oauth20).
 *
 * A. Удалённые двери:
 *    1. POST /api/auth/password → 404
 *    2. POST /api/auth/telegram → 404
 *    3. GET /api/auth/magic/status → 404
 * B. Google-дверь:
 *    4. GET /api/auth/google/status → 200 (enabled по наличию ключей)
 *    5. GET /auth → 200, HTML с google-CTA, без «promo code»/«waiting list»
 *    6. GET /api/auth/google/start?promo=… → nr_promo_pending НЕ ставится
 * C. Сессии:
 *    7. сессия → /api/me authed:true, баланс ≥ 100 (welcome), NR PASS
 *    8. DB: LedgerTxn signup_bonus = +100 ровно один
 * D. Сайт открыт гостю:
 *    9. GET / и GET /bet → 200 без сессии
 *
 * Запуск: node scripts/v12_open_selftest.mjs (сервер уже поднят).
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";
import { createSelfSession, dropSelfSession } from "./lib/selfsession.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

function envFromDotenv(name) {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

const ADMIN_SECRET_ENV = envFromDotenv("ADMIN_SECRET");
/* фиктивный XFF — детерминированный ipHash, изоляция бюджета от других тестов */
const TEST_IP = "203.0.113.42";
const LOCAL_IP_HASH = createHash("sha256")
  .update(`${TEST_IP}|${ADMIN_SECRET_ENV}`)
  .digest("hex")
  .slice(0, 32);

let passed = 0;
let failed = 0;
const cleanupAccounts = [];

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- cookie-jar клиент ---------- */
function makeClient(name) {
  const cookies = new Map();
  const api = async function (method, url, body) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "x-forwarded-for": TEST_IP,
        "user-agent": `Mozilla/5.0 v16-selftest/1.0 ${name}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const pair = c.split(";")[0] || "";
      const eq = pair.indexOf("=");
      if (eq > 0) {
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1).trim();
        if (v === "") cookies.delete(k);
        else cookies.set(k, v);
      }
    }
    let json = null;
    const raw = await res.text();
    try {
      json = JSON.parse(raw);
    } catch {}
    return {
      status: res.status,
      json,
      location: res.headers.get("location"),
      html: json === null ? raw : "",
      cookies,
    };
  };
  api.cookies = cookies;
  return api;
}

async function run() {
  console.log(`\n[v16-selftest] ${BASE} — открытые двери: вход только Google\n`);
  /* чистим бюджет неудач этого ipHash — идемпотентный прогон */
  await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);

  const stamp = Date.now();

  /* ---------- A. удалённые двери ---------- */
  console.log("[A] password/telegram/magic удалены");
  const Gone = makeClient("gone");
  const pw = await Gone("POST", "/api/auth/password", {
    email: `v16-gone-${stamp}@test.dev`,
    password: "whatever-123",
  });
  ok("1. POST /api/auth/password → 404 (метод удалён)", pw.status === 404, `status=${pw.status}`);
  const tg = await Gone("POST", "/api/auth/telegram", { id: "9900000042" });
  ok("2. POST /api/auth/telegram → 404 (метод удалён)", tg.status === 404, `status=${tg.status}`);
  const mg = await Gone("GET", "/api/auth/magic/status");
  ok("3. GET /api/auth/magic/status → 404 (метод удалён)", mg.status === 404, `status=${mg.status}`);

  /* ---------- B. Google-дверь ---------- */
  console.log("\n[B] Google — единственная дверь");
  const st = await Gone("GET", "/api/auth/google/status");
  ok(
    "4. GET /api/auth/google/status → 200 (enabled флаг)",
    st.status === 200 && typeof st.json?.enabled === "boolean",
    JSON.stringify(st.json)
  );

  const authPage = await Gone("GET", "/auth");
  const html = (authPage.html || "").toLowerCase();
  ok(
    "5. GET /auth → 200, google-CTA есть, старых дверей нет",
    authPage.status === 200 &&
      html.includes("google") &&
      !html.includes("promo code") &&
      !html.includes("waiting list") &&
      !html.includes("data-telegram-login"),
    `len=${(authPage.html || "").length}`
  );

  const start = await Gone("/api/auth/google/start?promo=NR2345GGGGGGGG");
  ok(
    "6. start?promo=… → nr_promo_pending НЕ ставится (303/503 по ключам)",
    (start.status === 303 || start.status === 503) && !Gone.cookies.get("nr_promo_pending"),
    `status=${start.status}`
  );

  /* ---------- C. сессии ---------- */
  console.log("\n[C] сессии (v16: напрямую)");
  const s1 = await createSelfSession({ email: `v16-open-${stamp}@test.dev` });
  cleanupAccounts.push(s1.accountId);
  const Me = makeClient("me");
  const raw = s1.cookies;
  Me.cookies.set("nr_uid", raw.split("nr_uid=")[1]?.split(";")[0] || "");
  Me.cookies.set("nr_auth", raw.split("nr_auth=")[1] || "");
  const me = await Me("GET", "/api/me");
  ok(
    "7. /api/me → authed, баланс ≥ 100 (welcome), PASS",
    me.json?.authed === true && (me.json?.account?.balanceCents ?? 0) >= 100 && me.json?.account?.isPass === true,
    `bal=${me.json?.account?.balanceCents}`
  );
  const bonus = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = \'signup_bonus\' AND delta = 100',
    [s1.accountId]
  );
  ok("8. DB: signup_bonus +100 ровно один", bonus?.n === 1, `n=${bonus?.n}`);

  /* ---------- D. сайт открыт гостю ---------- */
  console.log("\n[D] сайт открыт без сессии");
  const home = await makeClient("guest")("GET", "/");
  ok("9a. GET / → 200 гостю", home.status === 200, `status=${home.status}`);
  const bet = await makeClient("guest2")("GET", "/bet");
  ok("9b. GET /bet → 200 гостю (беттинг за авторизацией)", bet.status === 200, `status=${bet.status}`);
}

/* ---------- cleanup ---------- */
async function cleanupDb() {
  try {
    for (const id of cleanupAccounts.filter(Boolean)) {
      await dropSelfSession(id);
    }
    await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  await cleanupDb();
  await close();
  console.log("[v16-selftest] cleanup done");
} else {
  try {
    await run();
  } finally {
    await cleanupDb();
    await close();
  }
  console.log(`\n[v16-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}
