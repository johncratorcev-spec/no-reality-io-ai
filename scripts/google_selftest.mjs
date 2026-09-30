#!/usr/bin/env node
/**
 * Selftest v7: GOOGLE SIGN-IN — против работающего dev-сервера :3000
 * с моком токен-эндпоинта Google (:9998, GOOGLE_TOKEN_URL):
 *
 *   GOOGLE_TOKEN_URL=http://127.0.0.1:9998/token
 *   (.env должен содержать GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
 *
 * Проверяет ПОЛНЫЙ app-side OAuth-флоу (единственное, что не эмулируется —
 * сам consent-экран Google, внешний сервис):
 *  A. статус и start:
 *     1. GET /api/auth/google/status → enabled:true (ключи подхвачены)
 *     2. GET /api/auth/google/start → 303 на accounts.google.com/o/oauth2/v2/auth
 *     3. в URL есть client_id, response_type=code, scope openid email profile
 *     4. redirect_uri = <base>/api/auth/google/callback
 *     5. state-cookie nr_g_state: HttpOnly + SameSite=Lax
 *     6. state в cookie === state в URL (binding)
 *  B. безопасность:
 *     7. callback с чужим state → /bet?auth=google_state, сессии нет
 *     8. callback без state-cookie → google_state
 *     9. email_verified=false → google_profile, сессии нет
 *    10. aud ≠ наш client_id → google_profile (подделка токена)
 *    11. открытый редирект ?next=//evil.com → санитизирован до /bet
 *  C. вход/регистрация (мок токен-эндпоинта):
 *    12. регистрация новым email → 303 + nr_uid-cookie (uuid)
 *    13. DB: Account(email).passTier = 1
 *    14. DB: LedgerTxn signup_bonus = +100 (регистрационный бонус, v11)
 *    15. повторный вход тем же email → ТОТ ЖЕ аккаунт (без дубля)
 *    16. DB: аккаунт 1 шт., signup_bonus 1 шт. (идемпотентно)
 *    17. привязка гостя: nr_uid гостя + новый email → email на госте,
 *        баланс гостя сохранён, дубль бонуса не выдан
 *    18. GET /api/me с сессией → баланс ≥ 100 виден
 *  D. анти-брутфорс (последним, съедает rate limit):
 *    19. лавина GET /start → 429
 *
 * Запуск: node scripts/google_selftest.mjs   (перед этим dev :3000 с
 * GOOGLE_TOKEN_URL=http://127.0.0.1:9998/token)
 */

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const MOCK_PORT = 9998;

function envFromDotenv(name) {
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  /* кавычки обязательны к срезу: иначе aud-мисматч (сервер берёт env без кавычек) */
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || envFromDotenv("GOOGLE_CLIENT_ID");

let passed = 0;
let failed = 0;
const cleanupAccounts = []; // id аккаунтов на удаление
const cleanupEmails = new Set();
const cleanupWaitlist = new Set(); // v9: заявки листа ожидания

/* v9: свои промокоды selftest-партии (отличаются от v8: G/H/K; NR + 12 тела) */
const SEED = ["NR2345GGGGGGGG", "NR2345HHHHHHHH", "NR2345KKKKKKKK", "NR2345MMMMMMMM"];
const ADMIN_SECRET_ENV = envFromDotenv("ADMIN_SECRET").replace(/"/g, "");
/* фиктивный XFF — детерминированный ipHash и изолированный бюджет */
const TEST_IP = "203.0.113.9";
const LOCAL_IP_HASH = createHash("sha256")
  .update(`${TEST_IP}|${ADMIN_SECRET_ENV}`)
  .digest("hex")
  .slice(0, 32);

async function seedPromos() {
  for (const code of SEED) {
    await q(
      'INSERT INTO "PromoCode" (id, code, batch) VALUES (gen_random_uuid(), $1, \'selftest\') ON CONFLICT (code) DO NOTHING',
      [code]
    );
  }
}

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- мок Google token-эндпоинта (:9998) ----------
   code имеет формат "mock:<email>:<aud>:<verified>" — мок собирает
   id_token (подпись не проверяется приложением: токен получен напрямую
   от токен-эндпоинта по TLS, проверяется только aud — см. google.ts). */
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function startMockGoogle() {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && (req.url || "").includes("/token")) {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const params = new URLSearchParams(raw);
        const code = params.get("code") || "";
        const [, email, aud, verified] = code.split(":");
        const header = b64url({ alg: "none", typ: "JWT" });
        const payload = b64url({
          email,
          email_verified: verified === "1",
          aud,
          exp: Math.floor(Date.now() / 1000) + 600,
        });
        const body = JSON.stringify({ id_token: `${header}.${payload}.mocksig` });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(body);
      });
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("mock-google-ok");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

/* ---------- cookie-jar клиент ---------- */
function makeClient(name) {
  const cookies = new Map();
  const api = async function api(url) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method: "GET",
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "x-forwarded-for": TEST_IP,
        "user-agent": `Mozilla/5.0 google-selftest/1.0 ${name}`,
      },
      redirect: "manual",
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const c of setCookies) {
      const pair = c.split(";")[0] || "";
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return {
      status: res.status,
      json,
      location: res.headers.get("location"),
      setCookies,
      cookies,
    };
  };
  api.cookies = cookies;
  return api;
}

/** полный флоу: start → state из cookie → callback с мок-code */
async function googleFlow(client, { email, aud, verified, next, promo }) {
  const start = await client(
    `/api/auth/google/start${promo ? `?promo=${encodeURIComponent(promo)}` : ""}`
  );
  const state = start.cookies.get("nr_g_state");
  const loc = new URL(start.location);
  const cbCode = `mock:${email}:${aud || CLIENT_ID}:${verified ? 1 : 0}`;
  const cb = await client(
    `/api/auth/google/callback?code=${encodeURIComponent(cbCode)}&state=${encodeURIComponent(state || "")}${next ? `&next=${next}` : ""}`
  );
  return { start, cb, state, loc };
}

/* ---------- тесты ---------- */
async function run() {
  await seedPromos();
  /* --- A. статус и start --- */
  console.log("\n[A] статус и start");
  const anon = makeClient("anon");

  const st = await anon("/api/auth/google/status");
  ok("1. status → enabled:true (ключи подхвачены)", st.json?.enabled === true, JSON.stringify(st.json));

  const start = await anon("/api/auth/google/start");
  ok("2. start → 303 на accounts.google.com", start.status === 303 && (start.location || "").startsWith("https://accounts.google.com/o/oauth2/v2/auth"), `status=${start.status}`);

  const authUrl = new URL(start.location || "");
  ok("3. client_id + response_type + scope", authUrl.searchParams.get("client_id") === CLIENT_ID && authUrl.searchParams.get("response_type") === "code" && (authUrl.searchParams.get("scope") || "").includes("openid"), `client_id=${(authUrl.searchParams.get("client_id") || "").slice(0, 18)}…`);

  const redirectUri = authUrl.searchParams.get("redirect_uri") || "";
  ok("4. redirect_uri = <base>/api/auth/google/callback", redirectUri.endsWith("/api/auth/google/callback"), redirectUri);

  const scState = (start.setCookies.find((c) => c.startsWith("nr_g_state=")) || "").toLowerCase();
  ok("5. state-cookie HttpOnly + SameSite=lax", scState.includes("httponly") && scState.includes("samesite=lax"), scState.split(";").slice(1, 3).join(";").trim());

  const state = start.cookies.get("nr_g_state");
  ok("6. state в cookie === state в URL", Boolean(state) && authUrl.searchParams.get("state") === state);

  /* --- B. безопасность --- */
  console.log("\n[B] безопасность callback");
  const badState = makeClient("bad-state");
  await badState("/api/auth/google/start"); // своя state-cookie
  const r7 = await badState("/api/auth/google/callback?code=mock:x@t.local:aud:1&state=AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA");
  ok("7. чужой state → auth=google_state, сессии нет", (r7.location || "").includes("auth=google_state") && (r7.location || "").includes("/auth") && !r7.cookies.get("nr_uid"), r7.location || "");

  const noCookie = makeClient("no-cookie");
  const r8 = await noCookie("/api/auth/google/callback?code=mock:x@t.local:aud:1&state=whatever");
  ok("8. без state-cookie → google_state", (r8.location || "").includes("auth=google_state"), r8.location || "");

  const unverified = makeClient("unverified");
  const r9 = await googleFlow(unverified, { email: "unverified@test.local", verified: false });
  ok("9. email_verified=false → google_profile", (r9.cb.location || "").includes("auth=google_profile") && !unverified.cookies.get("nr_uid"), r9.cb.location || "");

  const wrongAud = makeClient("wrong-aud");
  const r10 = await googleFlow(wrongAud, { email: "evil@test.local", aud: "attacker-client-id.apps.googleusercontent.com", verified: true });
  ok("10. aud чужой → google_profile (токен подделки отклонён)", (r10.cb.location || "").includes("auth=google_profile") && !wrongAud.cookies.get("nr_uid"), r10.cb.location || "");

  const openRedir = makeClient("open-redirect");
  const r11 = await googleFlow(openRedir, { email: "redir@test.local", verified: true, next: "//evil.com", promo: SEED[0] });
  ok("11. открытый редирект санитизирован → /bet (регистрация с промо)", (r11.cb.location || "").endsWith("/bet") && !(r11.cb.location || "").includes("evil.com") && r11.cb.cookies.get("nr_auth")?.startsWith("v1.") || "", r11.cb.location || "");
  cleanupEmails.add("redir@test.local");
  cleanupAccounts.push(r11.cb.cookies.get("nr_uid"));

  /* --- C. вход/регистрация (v9: регистрация ТОЛЬКО с промо) --- */
  console.log("\n[C] регистрация / вход / привязка гостя (гейт промо)");
  const user = makeClient("signup");
  const email1 = "g-signup-1@test.local";
  const r12 = await googleFlow(user, { email: email1, verified: true, promo: SEED[3] });
  const uid1 = r12.cb.cookies.get("nr_uid");
  ok("12. регистрация с промо → 303 + nr_uid + nr_auth", r12.cb.status === 303 && /^[0-9a-f-]{36}$/i.test(uid1 || "") && r12.cb.cookies.get("nr_auth")?.startsWith("v1.") || "", `uid=${(uid1 || "").slice(0, 8)}… loc=${r12.cb.location}`);
  cleanupEmails.add(email1);
  cleanupAccounts.push(uid1);

  const d1 = await one('SELECT id, email, "passTier" FROM "Account" WHERE email = $1', [email1]);
  ok("13. DB: Account создан, passTier=1 (NR PASS)", d1 && Number(d1.passTier) === 1, d1 ? `id=${d1.id.slice(0, 8)}… tier=${d1.passTier}` : "нет аккаунта");

  const bonus1 = await one('SELECT delta, kind FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = \'signup_bonus\'', [uid1]);
  ok("14. DB: signup_bonus = +100 EYE", bonus1 && Number(bonus1.delta) === 100, bonus1 ? `delta=${bonus1.delta}` : "нет начисления");

  const user2 = makeClient("login-again");
  const r15 = await googleFlow(user2, { email: email1, verified: true });
  const uidAgain = r15.cb.cookies.get("nr_uid");
  ok("15. повторный вход тем же email → тот же аккаунт", uidAgain === uid1, `uid=${(uidAgain || "").slice(0, 8)}…`);

  const cntAcc = await one('SELECT COUNT(*)::int AS n FROM "Account" WHERE email = $1', [email1]);
  const cntBonus = await one('SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = \'signup_bonus\'', [uid1]);
  ok("16. DB: без дублей (1 аккаунт, 1 бонус)", cntAcc.n === 1 && cntBonus.n === 1, `accounts=${cntAcc.n} bonuses=${cntBonus.n}`);

  /* 17. привязка гостя: баланс сохраняется */
  const guestId = globalThis.crypto.randomUUID();
  await q(
    'INSERT INTO "Account" (id, "balanceCents", "createdAt", "updatedAt") VALUES ($1, 777, now(), now())',
    [guestId]
  );
  await q(
    'INSERT INTO "LedgerTxn" (id, "accountId", delta, kind, "refKey") VALUES ($1, $2, 777, \'signup_bonus\', $3)',
    [globalThis.crypto.randomUUID(), guestId, `signup:${guestId}`]
  );
  cleanupAccounts.push(guestId);

  const guest = makeClient("guest-link");
  guest.cookies.set("nr_uid", guestId);
  const emailG = "g-guest-link@test.local";
  cleanupEmails.add(emailG);
  const r17 = await googleFlow(guest, { email: emailG, verified: true, promo: SEED[1] });
  const uidGuest = r17.cb.cookies.get("nr_uid");
  const guestAfter = await one('SELECT id, email, "passTier", "balanceCents" FROM "Account" WHERE id = $1', [guestId]);
  ok(
    "17. гость привязан: email на нём, PASS, баланс 777 сохранён",
    uidGuest === guestId && guestAfter && guestAfter.email === emailG && guestAfter.passTier === 1 && Number(guestAfter.balanceCents) === 777,
    guestAfter ? `email=${guestAfter.email} tier=${guestAfter.passTier} balance=${guestAfter.balanceCents}` : "гость пропал"
  );
  const guestBonus = await one('SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = \'signup_bonus\'', [guestId]);
  ok("17b. дубль бонуса гостю не выдан", guestBonus.n === 1, `txns=${guestBonus.n}`);

  /* 18. /api/me с сессией после google-регистрации */
  const me = await user("/api/me");
  const meAcc = me.json?.account || me.json;
  ok("18. /api/me: сессия жива, баланс ≥ 100", meAcc?.accountId === uid1 && Number(meAcc?.balanceCents ?? 0) >= 100, JSON.stringify({ accountId: meAcc?.accountId?.slice(0, 8), balance: meAcc?.balanceCents }));

  /* --- C2. v9: google-гейт (закрытый запуск) --- */
  console.log("\n[C2] v9 google-гейт: без промо → лист ожидания");

  /* 19. новый google-email БЕЗ промо → /auth?waitlisted=1, сессии нет */
  const gated = makeClient("gated");
  const emailGate = "g-gated-waitlist@test.local";
  cleanupEmails.add(emailGate);
  const r19 = await googleFlow(gated, { email: emailGate, verified: true });
  ok(
    "19. новый email без промо → waitlisted на /auth (сессии нет)",
    r19.cb.status === 303 && (r19.cb.location || "").includes("/auth?waitlisted=1") && (r19.cb.location || "").includes("reason=no_code") && !r19.cb.cookies.get("nr_uid"),
    r19.cb.location || ""
  );
  const wlG = await one('SELECT source FROM "WaitlistEntry" WHERE email = $1', [emailGate]);
  ok("19b. DB: WaitlistEntry(source=google)", wlG?.source === "google");
  cleanupWaitlist.add(emailGate);

  /* 20. повторный google-вход того же waitlisted-email С промо → аккаунт */
  const gated2 = makeClient("gated2");
  const r20 = await googleFlow(gated2, { email: emailGate, verified: true, promo: SEED[2] });
  const uidGate = r20.cb.cookies.get("nr_uid");
  ok(
    "20. тот же email + промо → registered + nr_auth",
    r20.cb.status === 303 && /^[0-9a-f-]{36}$/i.test(uidGate || "") && r20.cb.cookies.get("nr_auth")?.startsWith("v1.") || "" && (r20.cb.location || "").endsWith("/bet"),
    r20.cb.location || ""
  );
  cleanupAccounts.push(uidGate);
  const wlG2 = await one('SELECT "convertedAccountId" FROM "WaitlistEntry" WHERE email = $1', [emailGate]);
  ok("20b. DB: WaitlistEntry апрувнут после регистрации", wlG2?.convertedAccountId === uidGate);

  /* 21. pending-promo cookie: геометрия проверяется на start */
  const pend = makeClient("pending");
  const r21ok = await pend("/api/auth/google/start?promo=NR2345GGGGGGGG");
  ok(
    "21. start?promo=<валидная геометрия> → nr_promo_pending выставлен",
    r21ok.status === 303 && pend.cookies.get("nr_promo_pending") === "NR2345GGGGGGGG",
    pend.cookies.get("nr_promo_pending") || "нет cookie"
  );
  const pend2 = makeClient("pending2");
  await pend2("/api/auth/google/start?promo=GARBAGE-CODE");
  ok(
    "22. start?promo=<мусор> → cookie НЕ выставлен (геометрия отсечена)",
    !pend2.cookies.get("nr_promo_pending")
  );

  /* --- D. анти-брутфорс (последним) --- */
  console.log("\n[D] анти-брутфорс start");
  const brutes = makeClient("brute");
  let got429 = false;
  for (let i = 0; i < 25; i++) {
    const r = await brutes("/api/auth/google/start");
    if (r.status === 429) {
      got429 = true;
      break;
    }
  }
  ok("23. лавина /start → 429 (rate limit)", got429);
}

/* ---------- cleanup ---------- */
async function cleanupDb() {
  try {
    for (const id of cleanupAccounts.filter(Boolean)) {
      await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
      await q('DELETE FROM "Account" WHERE id = $1', [id]);
    }
    for (const email of cleanupEmails) {
      await q('DELETE FROM "Account" WHERE email = $1', [email]);
    }
    for (const email of cleanupWaitlist) {
      await q('DELETE FROM "WaitlistEntry" WHERE email = $1', [email]);
    }
    await q('DELETE FROM "PromoCode" WHERE batch = \'selftest\'', []);
    await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [LOCAL_IP_HASH]);
    await q("DELETE FROM \"TrackEvent\" WHERE name IN ('google_signin','google_signup','google_waitlist','promo_redeemed','waitlist_signup')");
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  await cleanupDb();
  await close();
  console.log("[google-selftest] cleanup done");
} else {
  let server = null;
  try {
    server = await startMockGoogle();
    console.log(`[google-selftest] мок Google token-эндпоинта: :${MOCK_PORT}`);
    await run();
  } finally {
    await cleanupDb();
    await close();
    server?.close();
  }
  console.log(`\n[google-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}
