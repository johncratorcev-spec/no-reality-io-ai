#!/usr/bin/env node
/**
 * Selftest v12: ОТКРЫТЫЕ ДВЕРИ — против работающего dev-сервера :3000
 * (Supabase Postgres). Заменяет v9_promo_selftest: секретные коды
 * (промо + лист ожидания) УДАЛЕНЫ ПРИКАЗОМ, вход открыт всем.
 *
 * A. Открытая email-регистрация:
 *    1. POST /api/auth/password (новый email, БЕЗ кодов) → 200,
 *       status=registered, isNew, cookies nr_uid+nr_auth
 *    2. /api/me → authed:true, баланс ≥ 100 (welcome), NR PASS
 *    3. DB: LedgerTxn signup_bonus = +100 ровно один
 * B. Повторный вход:
 *    4. тот же email+пароль → status=login, тот же accountId
 *    5. неверный пароль → 401 wrong_password
 * C. Кодов нет нигде:
 *    6. GET /auth → 200, в HTML нет «promo code»/«waiting list»/«NR-»
 *    7. GET /api/auth/google/start?promo=… → nr_promo_pending НЕ ставится
 *    8. POST /api/auth/password с мусорным полем promo → регистрирует
 *       как обычно (поле игнорируется)
 * D. Анти-брутфорс пароля (БД-бюджет 10/час):
 *    9. 10 неверных паролей → 401; 11-й запрос → 429 + Retry-After
 * E. Telegram-дверь остаётся под подписью:
 *   10. подписанный (токеном из env) payload → 200 ok
 *   11. подделанный hash → 401
 *
 * Запуск: node scripts/v12_open_selftest.mjs (сервер уже поднят).
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac } from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

function envFromDotenv(name) {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

const ADMIN_SECRET_ENV = envFromDotenv("ADMIN_SECRET");
const TG_TOKEN = envFromDotenv("TELEGRAM_BOT_TOKEN");
/* фиктивный XFF — детерминированный ipHash, изоляция бюджета от других тестов */
const TEST_IP = "203.0.113.42";
const LOCAL_IP_HASH = createHash("sha256")
  .update(`${TEST_IP}|${ADMIN_SECRET_ENV}`)
  .digest("hex")
  .slice(0, 32);

let passed = 0;
let failed = 0;
const cleanupAccounts = [];
const cleanupEmails = new Set();

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
        "user-agent": `Mozilla/5.0 v12-selftest/1.0 ${name}`,
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
      retryAfter: res.headers.get("retry-after"),
      html: json === null ? raw : "",
      cookies,
    };
  };
  api.cookies = cookies;
  return api;
}

/* ---------- telegram signing (спека Telegram Login Widget) ---------- */
function signTelegram(fields, token) {
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(token).digest();
  return createHmac("sha256", secret).update(checkString).digest("hex");
}

function tgPayload(token, { id, first = "Open", user, tamper = false }) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - 60),
    first_name: first,
    id: String(id),
    username: user,
  };
  const hash = signTelegram(fields, token);
  return { ...fields, hash: tamper ? "f".repeat(64) : hash };
}

async function run() {
  console.log(`\n[v12-selftest] ${BASE} — открытые двери: никаких секретных кодов\n`);
  /* чистим бюджет неудач этого ipHash — идемпотентный прогон */
  await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);

  const stamp = Date.now();
  const email1 = `v12-open-${stamp}@test.dev`;
  const email2 = `v12-garbage-${stamp}@test.dev`;

  /* ---------- A. открытая регистрация ---------- */
  console.log("[A] открытая email-регистрация");
  const Reg = makeClient("reg");
  const reg = await Reg("POST", "/api/auth/password", {
    email: email1,
    password: "open-sesame-12",
  });
  const regId = reg.json?.account?.accountId;
  cleanupAccounts.push(regId);
  cleanupEmails.add(email1);
  ok(
    "1. регистрация без кодов → registered + сессия",
    reg.status === 200 && reg.json?.ok === true && reg.json?.status === "registered" && reg.json?.isNew === true && Boolean(regId) && Reg.cookies.get("nr_auth")?.startsWith("v1."),
    JSON.stringify(reg.json?.error || reg.json?.status)
  );

  const me = await Reg("GET", "/api/me");
  ok(
    "2. /api/me → authed, баланс ≥ 100 (welcome), PASS",
    me.json?.authed === true && (me.json?.account?.balanceCents ?? 0) >= 100 && me.json?.account?.isPass === true,
    `bal=${me.json?.account?.balanceCents}`
  );

  const bonus = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = \'signup_bonus\' AND delta = 100',
    [regId]
  );
  ok("3. DB: signup_bonus +100 ровно один", bonus?.n === 1, `n=${bonus?.n}`);

  /* ---------- B. повторный вход ---------- */
  console.log("\n[B] повторный вход");
  const Again = makeClient("again");
  const again = await Again("POST", "/api/auth/password", {
    email: email1,
    password: "open-sesame-12",
  });
  ok(
    "4. тот же email+пароль → login, тот же accountId",
    again.status === 200 && again.json?.status === "login" && again.json?.isNew === false && again.json?.account?.accountId === regId,
    again.json?.error
  );

  const Wrong = makeClient("wrong");
  const wrong = await Wrong("POST", "/api/auth/password", {
    email: email1,
    password: "not-the-password",
  });
  ok("5. неверный пароль → 401 wrong_password", wrong.status === 401 && wrong.json?.error === "wrong_password", wrong.json?.error);

  /* ---------- C. кодов нет нигде ---------- */
  console.log("\n[C] секретные коды отсутствуют");
  const Page = makeClient("page");
  const auth = await Page("GET", "/auth");
  const html = (auth.html || "").toLowerCase();
  ok(
    "6. /auth: 200, нет «promo code»/«waiting list»/«nr-xxxx»",
    auth.status === 200 && !html.includes("promo code") && !html.includes("waiting list") && !html.includes("nr-xxxx"),
    auth.status === 200 ? "чисто" : `status=${auth.status}`
  );

  const G = makeClient("gstart");
  const gs = await G("GET", "/api/auth/google/start?promo=NR2345GGGGGGGG&next=%2Fbet");
  ok(
    "7. google start?promo=… → nr_promo_pending не выставляется",
    (gs.status === 303 || gs.status === 503) && !G.cookies.get("nr_promo_pending"),
    `status=${gs.status}`
  );

  const Garb = makeClient("garbage");
  const garb = await Garb("POST", "/api/auth/password", {
    email: email2,
    password: "open-sesame-12",
    promo: "NR-FAKE-CODE-XXXX",
  });
  const garbId = garb.json?.account?.accountId;
  cleanupAccounts.push(garbId);
  cleanupEmails.add(email2);
  ok(
    "8. поле promo игнорируется → обычная регистрация",
    garb.status === 200 && garb.json?.status === "registered" && Boolean(garbId),
    JSON.stringify(garb.json?.error || garb.json?.status)
  );

  /* ---------- D. анти-брутфорс пароля ---------- */
  console.log("\n[D] бюджет неверных паролей (10/час)");
  let got429 = null;
  for (let i = 1; i <= 11; i++) {
    const r = await Wrong("POST", "/api/auth/password", {
      email: email1,
      password: `bad-pass-${i}-xxxxxxxx`,
    });
    if (r.status === 429) {
      got429 = { at: i, retryAfter: r.retryAfter };
      break;
    }
  }
  ok(
    "9. 10 промахов → 401, дальше 429 + Retry-After",
    /* чек №5 уже потратил 1 промах этого ipHash → 429 приходит на i=10
       (11-я суммарная попытка), а не на i=11 */
    got429 && got429.at === 10 && Number(got429.retryAfter) > 0,
    got429 ? `429 на попытке ${got429.at}, retry-after=${got429.retryAfter}` : "429 не получен"
  );

  /* ---------- E. telegram-дверь под подписью ---------- */
  console.log("\n[E] telegram-вход защищён HMAC");
  if (!TG_TOKEN) {
    ok("10/11. TELEGRAM_BOT_TOKEN не задан в .env — проверка пропущена", true);
  } else {
    const tgId = `99${String(stamp).slice(-8)}`;
    const Tg = makeClient("tg");
    const good = await Tg("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: tgId, user: "v12_open" }));
    ok(
      "10. подписанный payload → 200 ok + сессия",
      good.status === 200 && good.json?.ok === true && Boolean(Tg.cookies.get("nr_auth")),
      JSON.stringify(good.json?.error || good.json?.created)
    );
    const tgAcc = good.json?.account?.accountId;
    if (good.json?.created !== false) cleanupAccounts.push(tgAcc);

    const Bad = makeClient("tg-bad");
    const bad = await Bad("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: tgId, user: "v12_open", tamper: true }));
    ok("11. подделанный hash → 401", bad.status === 401, bad.json?.error);
  }

  /* ---------- cleanup ---------- */
  console.log("\n[cleanup]");
  for (const id of cleanupAccounts.filter(Boolean)) {
    await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
    await q('DELETE FROM "Bet" WHERE "accountId" = $1', [id]).catch(() => null);
    await q('DELETE FROM "EmailAuth" WHERE "accountId" = $1', [id]);
    await q('DELETE FROM "Session" WHERE "accountId" = $1', [id]).catch(() => null);
    await q('DELETE FROM "Account" WHERE id = $1', [id]);
  }
  for (const email of cleanupEmails) {
    await q('DELETE FROM "WaitlistEntry" WHERE email = $1', [email]).catch(() => null);
  }
  await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);
  console.log(`  удалено аккаунтов: ${cleanupAccounts.filter(Boolean).length}`);

  console.log(`\n=== ИТОГ: ${passed} PASS / ${failed} FAIL ===`);
  await close();
  process.exit(failed ? 1 : 0);
}

run().catch(async (e) => {
  console.error("FATAL:", e);
  await close().catch(() => null);
  process.exit(1);
});
