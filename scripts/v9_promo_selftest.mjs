#!/usr/bin/env node
/**
 * Selftest v9: ЗАКРЫТЫЙ ЗАПУСК — против работающего dev-сервера :3000
 * (Supabase Postgres, моки GOOGLE_TOKEN_URL/TWOTHOUSAND328_* на сервере).
 *
 * A. Middleware-гейт (неавторизованных перекидывает на /auth):
 *    1. GET /              → 307 на /auth?next=…
 *    2. GET /bet           → 307 на /auth
 *    3. GET /feed          → 307 на /auth
 *    4. GET /auth          → 200 (экран «closed launch»)
 *    5. GET / с cookie nr_auth=1 → 200 (маркер членства открывает гейт)
 *    6. GET /api/me без сессии → 200 (API гейтом не закрыт — по сессиям)
 * B. Лист ожидания:
 *    7. регистрация без промо → waitlisted, account-поле отсутствует,
 *       сессионных cookie НЕ выдано
 *    8. DB: WaitlistEntry(source=form, scrypt-хеш)
 *    9. повторная регистрация того же email → по-прежнему waitlisted,
 *       строка в листе ОДНА (upsert анти-спам)
 *   10. мусорный промо-код (геометрия не та) → waitlisted invalid_code
 *   11. несуществующий код (геометрия ок) → waitlisted invalid_code
 *   12. DB: PromoAttempt(ok=false) записан
 * C. Промо-регистрация:
 *   13. валидный код → registered + cookies nr_uid+nr_auth
 *   14. /api/me с сессией → email + NR PASS
 *   15. DB: PromoCode.usedBy = accountId, баланс ≥ 300 (welcome)
 *   16. тот же код другим email → waitlisted promo_used (одноразовость)
 *   17. email из листа ожидания + свой код → registered,
 *       WaitlistEntry.convertedAccountId заполнен
 * D. Вход и пароль-бюджет:
 *   18. вход существующего email → status=login
 *   19. неверный пароль → 401 wrong_password
 * E. Анти-брутфорс промо (последним — тратит бюджет):
 *   20-25. 6 промахов подряд → waitlisted (бюджет 8/час позволяет)
 *   26. 9-й промах → 429 too_many_requests + Retry-After
 *
 * Запуск: node scripts/v9_promo_selftest.mjs  (сервер уже поднят;
 * selftest чистит свои PromoAttempt по ipHash local и до, и после прогона)
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

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
/* v9: фиктивный XFF — детерминированный ipHash и изоляция бюджета
   selftest'а от реальных IP (Next dev подставляет ::ffff:127.0.0.1) */
const TEST_IP = "203.0.113.7";
const LOCAL_IP_HASH = createHash("sha256")
  .update(`${TEST_IP}|${ADMIN_SECRET_ENV}`)
  .digest("hex")
  .slice(0, 32);

/* selftest-коды: ПРАВИЛЬНАЯ геометрия — NR + 12 символов алфавита (14 всего) */
const SEED = ["NR2345WWWWWWWW", "NR2345UUUUUUUU"];

let passed = 0;
let failed = 0;
const cleanupAccounts = [];
const cleanupEmails = new Set();
const cleanupWaitlist = new Set();

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- cookie-jar клиент (перехватывает set-cookie) ---------- */
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
        "user-agent": `Mozilla/5.0 v9-selftest/1.0 ${name}`,
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

async function seedPromos() {
  for (const code of SEED) {
    await q(
      'INSERT INTO "PromoCode" (id, code, batch) VALUES (gen_random_uuid(), $1, \'selftest\') ON CONFLICT (code) DO NOTHING',
      [code]
    );
  }
}

async function run() {
  console.log(`\n[v9-selftest] ${BASE} — закрытый запуск: гейт / лист ожидания / промо / анти-брутфорс\n`);
  await seedPromos();
  const stamp = Date.now();

  /* === A. middleware-гейт === */
  console.log("\n[A] middleware-гейт");
  const Anon = makeClient("anon");

  const home = await Anon("GET", "/");
  ok(
    "1. GET / без сессии → редирект на /auth?next=/",
    home.status === 307 && (home.location || "").startsWith("/auth") && (home.location || "").includes("next=%2F"),
    `${home.status} → ${home.location}`
  );
  const bet = await Anon("GET", "/bet");
  ok("2. GET /bet без сессии → /auth", bet.status === 307 && (bet.location || "").includes("/auth"), bet.location || "");
  const feed = await Anon("GET", "/feed");
  ok("3. GET /feed без сессии → /auth", feed.status === 307 && (feed.location || "").includes("/auth"), feed.location || "");

  const authPage = await Anon("GET", "/auth");
  ok(
    "4. GET /auth → 200 (экран входа отдаётся)",
    authPage.status === 200 && (authPage.html.includes("closed launch") || authPage.html.includes("loading") || authPage.html.includes("no-reality")),
    `status=${authPage.status} len=${authPage.html.length}`
  );

  const Member = makeClient("member");
  Member.cookies.set("nr_auth", "1");
  const memberHome = await Member("GET", "/");
  ok("5. GET / с nr_auth=1 → 200 (гейт открыт)", memberHome.status === 200, `status=${memberHome.status}`);

  const apiMe = await Anon("GET", "/api/me");
  ok("6. /api/me без сессии → 200 (API не за гейтом)", apiMe.status === 200 && apiMe.json?.account, apiMe.json?.error || "");

  /* === B. лист ожидания (свежий клиент: без гостевой сессии из /api/me) === */
  console.log("\n[B] лист ожидания");
  const WlClient = makeClient("wl");
  const emailWl = `v9-wl-${stamp}@test.dev`;
  cleanupWaitlist.add(emailWl);
  const wl = await WlClient("POST", "/api/auth/password", { email: emailWl, password: "waitlist-pass-1" });
  ok(
    "7. без промо → waitlisted, account-поле нет, cookie нет",
    wl.status === 200 && wl.json.ok === true && wl.json.status === "waitlisted" && wl.json.reason === "no_code" && wl.json.account === undefined && !wl.cookies.get("nr_uid") && !wl.cookies.get("nr_auth"),
    JSON.stringify(wl.json.reason || wl.json.error)
  );
  const wlRow = await one('SELECT "passwordHash", source FROM "WaitlistEntry" WHERE email = $1', [emailWl]);
  ok("8. DB: WaitlistEntry(source=form, scrypt)", String(wlRow?.passwordHash || "").startsWith("scrypt$") && wlRow?.source === "form");

  const wl2 = await WlClient("POST", "/api/auth/password", { email: emailWl, password: "waitlist-pass-2" });
  const wlCount = await one('SELECT COUNT(*)::int AS n FROM "WaitlistEntry" WHERE email = $1', [emailWl]);
  ok(
    "9. повтор без промо → waitlisted, строка ОДНА (upsert)",
    wl2.json?.status === "waitlisted" && wlCount?.n === 1,
    `rows=${wlCount?.n}`
  );

  const wlBad = await WlClient("POST", "/api/auth/password", { email: emailWl, password: "waitlist-pass-1", promo: "PROMO-12345" });
  ok("10. мусорный код (геометрия нет) → waitlisted invalid_code", wlBad.json?.status === "waitlisted" && wlBad.json?.reason === "invalid_code", wlBad.json?.reason || "");

  const wlMissing = await WlClient("POST", "/api/auth/password", { email: emailWl, password: "waitlist-pass-1", promo: "NR2345ZZZZZZZZ" });
  ok("11. несуществующий код (геометрия ок) → waitlisted invalid_code", wlMissing.json?.status === "waitlisted" && wlMissing.json?.reason === "invalid_code", wlMissing.json?.reason || "");

  const attempts = await one(
    'SELECT COUNT(*)::int AS n FROM "PromoAttempt" WHERE "ipHash" = $1 AND kind = \'promo\' AND ok = false',
    [LOCAL_IP_HASH]
  );
  ok("12. DB: промахи промо записаны (≥2)", (attempts?.n ?? 0) >= 2, `rows=${attempts?.n}`);

  /* === C. промо-регистрация === */
  console.log("\n[C] промо-регистрация");
  const emailP = `v9-promo-${stamp}@test.dev`;
  cleanupEmails.add(emailP);
  const reg = await Anon("POST", "/api/auth/password", {
    email: emailP,
    password: "promo-pass-12345",
    promo: "nr-2345-wwww-wwww", // дефисы/регистр — нормализатор должен съесть
  });
  const regId = reg.json?.account?.accountId;
  ok(
    "13. валидный код (в любом регистре/с дефисами) → registered + cookies",
    reg.status === 200 && reg.json?.status === "registered" && reg.json?.isNew === true && /^[0-9a-f-]{36}$/.test(regId || "") && reg.cookies.get("nr_auth") === "1",
    reg.json?.error || regId?.slice(0, 8)
  );
  cleanupAccounts.push(regId);

  const me = await Anon("GET", "/api/me");
  ok("14. /api/me → email + NR PASS", me.json?.account?.email === emailP && me.json?.account?.isPass === true, me.json?.account?.email || "");

  const promoRow = await one('SELECT "usedBy" FROM "PromoCode" WHERE code = $1', [SEED[0]]);
  const bal = await one('SELECT "balanceCents" FROM "Account" WHERE id = $1', [regId]);
  ok("15. DB: код погашен этим аккаунтом, баланс ≥ 300", promoRow?.usedBy === regId && Number(bal?.balanceCents ?? 0) >= 300, `bal=${bal?.balanceCents}`);

  const emailP2 = `v9-reuse-${stamp}@test.dev`;
  cleanupWaitlist.add(emailP2);
  const Reuse = makeClient("reuse");
  const reuse = await Reuse("POST", "/api/auth/password", { email: emailP2, password: "reuse-pass-12345", promo: SEED[0] });
  ok("16. тот же код другим email → waitlisted promo_used", reuse.json?.status === "waitlisted" && reuse.json?.reason === "promo_used", reuse.json?.reason || "");

  /* email из листа ожидания активируется промо */
  const emailWl2 = `v9-wl2-${stamp}@test.dev`;
  cleanupWaitlist.add(emailWl2);
  const Wl2 = makeClient("wl2");
  await Wl2("POST", "/api/auth/password", { email: emailWl2, password: "convert-pass-1" });
  const conv = await Wl2("POST", "/api/auth/password", { email: emailWl2, password: "convert-pass-1", promo: SEED[1] });
  const convId = conv.json?.account?.accountId;
  cleanupAccounts.push(convId);
  ok("17. email из листа + свой код → registered", conv.json?.status === "registered" && /^[0-9a-f-]{36}$/.test(convId || ""), conv.json?.reason || conv.json?.error || "");
  const wlConv = await one('SELECT "convertedAccountId", "approvedAt" FROM "WaitlistEntry" WHERE email = $1', [emailWl2]);
  ok("17b. DB: WaitlistEntry апрувнут (convertedAccountId, approvedAt)", wlConv?.convertedAccountId === convId && Boolean(wlConv?.approvedAt));

  /* === D. вход === */
  console.log("\n[D] вход");
  const Login = makeClient("login");
  const login = await Login("POST", "/api/auth/password", { email: emailP, password: "promo-pass-12345" });
  ok("18. вход существующего email → status=login, тот же аккаунт", login.json?.status === "login" && login.json?.account?.accountId === regId, login.json?.error || "");

  const wrong = await Login("POST", "/api/auth/password", { email: emailP, password: "totally-wrong-pass" });
  ok("19. неверный пароль → 401 wrong_password", wrong.status === 401 && wrong.json?.error === "wrong_password", wrong.json?.error || "");

  /* === E. анти-брутфорс промо (последним — тратит бюджет) ===
     Бюджет: 8 промахов/час. К этому моменту промахов: 10,11 (2) + reuse-used (1) = 3.
     Дальше 5 промахов (итого 8) должны проходить, следующий (9-й) → 429. */
  console.log("\n[E] анти-брутфорс");
  let allWaitlisted = true;
  for (let i = 0; i < 5; i++) {
    const r = await Anon("POST", "/api/auth/password", {
      email: `v9-brute-${stamp}-${i}@test.dev`,
      password: "brute-pass-12345",
      promo: `NR2345QQ${String(i).padStart(6, "5")}`,
    });
    cleanupWaitlist.add(`v9-brute-${stamp}-${i}@test.dev`);
    if (r.json?.status !== "waitlisted") {
      allWaitlisted = false;
      console.log(`    attempt ${i}: ${r.status} ${JSON.stringify(r.json)}`);
      break;
    }
  }
  ok("20-24. 5 промахов в бюджете → все waitlisted", allWaitlisted);
  const over = await Anon("POST", "/api/auth/password", {
    email: `v9-brute-${stamp}-over@test.dev`,
    password: "brute-pass-12345",
    promo: "NR2345QQQQQQQQ",
  });
  ok("25. 9-й промах → 429 + Retry-After", over.status === 429 && Boolean(over.retryAfter), `status=${over.status} retry=${over.retryAfter}`);

  /* ---------- итог ---------- */
  console.log(`\n[v9-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- чистка бюджета и тестовых строк ---------- */
async function cleanupDb() {
  try {
    await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);
    await q('DELETE FROM "PromoCode" WHERE batch = \'selftest\'', []);
    for (const email of cleanupWaitlist) {
      await q('DELETE FROM "WaitlistEntry" WHERE email = $1', [email]);
    }
    for (const email of cleanupEmails) {
      /* LedgerTxn должен уйти раньше аккаунта (FK LedgerTxn_accountId_fkey) */
      const accs = await q('SELECT id FROM "Account" WHERE email = $1', [email]);
      for (const a of accs) {
        await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [a.id]);
        await q('DELETE FROM "WaitlistEntry" WHERE "convertedAccountId" = $1', [a.id]);
      }
      await q('DELETE FROM "EmailAuth" WHERE email = $1', [email]);
      await q('DELETE FROM "Account" WHERE email = $1', [email]);
    }
    for (const id of cleanupAccounts.filter(Boolean)) {
      await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
      await q('DELETE FROM "WaitlistEntry" WHERE "convertedAccountId" = $1', [id]);
      await q('DELETE FROM "EmailAuth" WHERE "accountId" = $1', [id]);
      await q('DELETE FROM "Account" WHERE id = $1', [id]);
    }
    await q("DELETE FROM \"TrackEvent\" WHERE name IN ('waitlist_signup','promo_redeemed','password_signin','password_signup')");
  } catch (e) {
    console.warn("[cleanup] db skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
try {
  if (!isCleanupOnly) await run();
} finally {
  await cleanupDb();
  await close();
  if (isCleanupOnly) console.log("[v9-selftest] cleanup done");
}
