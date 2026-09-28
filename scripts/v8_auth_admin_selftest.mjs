#!/usr/bin/env node
/**
 * Selftest v8: СВОЯ ФОРМА (email+пароль на Supabase) + НАГРАДЫ + ИНВОЙСЫ +
 * АДМИН-ПАНЕЛЬ — против работающего dev-сервера :3000 (Supabase Postgres).
 *
 * Проверяет:
 *  A. password-аутентификация (без подтверждения учётки):
 *     1. гость с балансом регистрируется → isNew, linked, email на аккаунте
 *     2. повторный вход тем же email+пароль → тот же accountId
 *     3. чужой пароль → 401 wrong_password
 *     4. свежий visitor (без nr_uid) → новый профиль + welcome-бонус
 *     5. короткий пароль → 400 bad_password
 *  B. награда за добавление видео в ленту (куратор панели):
 *     6. админ-сессия + POST /api/admin/events → ok + rewardCents=100
 *     7. LedgerTxn video_reward (refKey video:<code>, +100)
 *     8. событие видно в GET /api/admin/events
 *     9. без админ-сессии → 401
 *  C. инвойсы 2328.io ТОЛЬКО на специальных событиях:
 *    10. boost checkout → инвойс bs-* + payUrl мока (спец-размещение)
 *    11. у аккаунтов после auth/наград/просмотров — 0 инвойсов
 *        (ни DepositOrder, ни BoostOrder)
 *  D. админ-панель в текущем стеке:
 *    12. GET /api/admin/stats → 200
 *    13. GET /api/admin/referrals → 200
 *    14. GET /api/admin/events → 200 (список ленты)
 *
 * Запуск: node scripts/v8_auth_admin_selftest.mjs   (сервер уже поднят)
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const ADMIN_SECRET_ENV = (readAdmin() || "")
  .split("=")[1]?.replace(/"/g, "")
  .trim();

function readAdmin() {
  return (
    fs
      .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
      .split("\n")
      .find((l) => l.startsWith("ADMIN_SECRET=")) || ""
  );
}

const CSV_PATH = path.resolve(process.cwd(), "data", "posts.csv");
const PAYMENT_KEY = "test-payment-key";
const CLIP = "71vsIPUu";

let passed = 0;
let failed = 0;
const cleanup = {
  accounts: [],
  emailAuths: [],
  boostOrders: [],
};

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- cookie-jar fetch ---------- */
function makeClient(name, uaSuffix = "") {
  const cookies = new Map();
  const api = async function (method, url, body) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "user-agent": `Mozilla/5.0 v8-selftest/1.0 ${name}${uaSuffix}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    const sc = res.headers.getSetCookie?.() || [];
    for (const c of sc) {
      const pair = c.split(";")[0] || "";
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json, location: res.headers.get("location") };
  };
  api.cookies = cookies;
  return api;
}

/* ---------- mock-2328 launcher (для boost-инвойса) ---------- */
async function ensureMock() {
  try {
    await fetch("http://127.0.0.1:9999/api/v1/payment/info", {
      method: "POST",
      signal: AbortSignal.timeout(800),
    });
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
        return child;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error("mock-2328 не поднялся");
  }
}

async function run() {
  console.log(`\n[v8-selftest] ${BASE} — своя форма + награды + инвойсы + админка\n`);

  /* === A. password-аутентификация (лимит 5/мин на IP — ровно 5 POST) === */
  const stamp = Date.now();
  const email1 = `pw-linked-${stamp}@test.dev`;
  const email2 = `pw-fresh-${stamp}@test.dev`;

  const Guest = makeClient("pw-guest");
  const gMe = await Guest("GET", "/api/me");
  const guestId = gMe.json.account?.accountId;
  const guestBal = gMe.json.account?.balanceCents ?? 0;
  cleanup.accounts.push(guestId);

  const reg = await Guest("POST", "/api/auth/password", {
    email: email1,
    password: "supersecret1",
  });
  ok(
    "регистрация гостя → ok, isNew, linked",
    reg.status === 200 && reg.json.ok === true && reg.json.isNew === true && reg.json.linked === true,
    reg.json.error || `linked=${reg.json.linked}`
  );
  ok(
    "email привязан к тому же аккаунту (баланс сохранён)",
    reg.json.account?.accountId === guestId && reg.json.account?.balanceCents === guestBal,
    `${guestBal} → ${reg.json.account?.balanceCents}`
  );

  const Login = makeClient("pw-login");
  const login = await Login("POST", "/api/auth/password", {
    email: email1,
    password: "supersecret1",
  });
  ok(
    "вход тем же email+пароль → тот же accountId",
    login.status === 200 && login.json.isNew === false && login.json.account?.accountId === guestId,
    login.json.error || login.json.account?.accountId?.slice(0, 8)
  );
  const loginMe = await Login("GET", "/api/me");
  ok(
    "сессия жива: /api/me отдаёт email",
    loginMe.json.account?.email === email1 && loginMe.json.account?.isPass === true,
    loginMe.json.account?.email
  );

  const Wrong = makeClient("pw-wrong");
  const wrong = await Wrong("POST", "/api/auth/password", {
    email: email1,
    password: "wrong-password-xxx",
  });
  ok("чужой пароль → 401 wrong_password", wrong.status === 401 && wrong.json.error === "wrong_password", wrong.json.error);

  const Fresh = makeClient("pw-fresh");
  const fresh = await Fresh("POST", "/api/auth/password", {
    email: email2,
    password: "another-pass-9",
  });
  ok(
    "уникальная почта без nr_uid → новый профиль + welcome",
    fresh.status === 200 && fresh.json.isNew === true && fresh.json.linked === false && fresh.json.account?.balanceCents >= 300,
    `balance=${fresh.json.account?.balanceCents}`
  );
  const freshId = fresh.json.account?.accountId;
  cleanup.accounts.push(freshId);
  cleanup.emailAuths.push(email1, email2);

  const short = await Fresh("POST", "/api/auth/password", {
    email: `pw-short-${stamp}@test.dev`,
    password: "12345",
  });
  ok("короткий пароль → 400 bad_password", short.status === 400 && short.json.error === "bad_password", short.json.error);

  const emailAuthRow = await one(
    'SELECT "accountId" FROM "EmailAuth" WHERE email = $1',
    [email1]
  );
  ok("EmailAuth-строка в Supabase (хеш, не пароль)", emailAuthRow?.accountId === guestId);
  const hashRow = await one(
    'SELECT "passwordHash" FROM "EmailAuth" WHERE email = $1',
    [email1]
  );
  ok("в БД scrypt-хеш, исходного пароля нет", String(hashRow?.passwordHash || "").startsWith("scrypt$") && !String(hashRow?.passwordHash || "").includes("supersecret1"));

  /* === B. награда за добавление видео в ленту (куратор) === */
  const csvBackup = fs.readFileSync(CSV_PATH, "utf-8");
  const Curator = makeClient("curator");
  const cMe = await Curator("GET", "/api/me");
  cleanup.accounts.push(cMe.json.account?.accountId);
  const curBal0 = cMe.json.account?.balanceCents ?? 0;

  const noSess = await Curator("POST", "/api/admin/events", {
    title: `v8 selftest event ${stamp}`,
    truth: "synth",
    videoUrl: "https://cdn.coverr.co/videos/coverr-test/main.mp4",
  });
  ok("POST events без админ-сессии → 401", noSess.status === 401, `status=${noSess.status}`);

  const admLogin = await Curator("POST", "/api/admin/session", { code: ADMIN_SECRET_ENV });
  ok("админ-сессия куратора", admLogin.status === 200, `status=${admLogin.status}`);

  const ev = await Curator("POST", "/api/admin/events", {
    title: `v8 selftest event ${stamp}`,
    truth: "synth",
    mood: "future",
    videoUrl: "https://cdn.coverr.co/videos/coverr-test/main.mp4",
  });
  ok(
    "событие создано → rewardCents 100",
    ev.status === 200 && ev.json.ok === true && ev.json.rewardCents === 100,
    ev.json.error || `code=${ev.json.code}`
  );
  const videoReward = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "refKey" = $1 AND kind = \'video_reward\' AND delta = 100',
    [`video:${ev.json.code}`]
  );
  ok("LedgerTxn video_reward +100 (refKey video:<code>)", (videoReward?.n ?? 0) === 1, `rows=${videoReward?.n}`);
  const curMe2 = await Curator("GET", "/api/me");
  ok("баланс куратора вырос на 100", (curMe2.json.account?.balanceCents ?? 0) === curBal0 + 100, `${curBal0} → ${curMe2.json.account?.balanceCents}`);

  const evList = await Curator("GET", "/api/admin/events");
  ok(
    "событие видно в панели (GET /api/admin/events)",
    evList.status === 200 && Array.isArray(evList.json.posts) && evList.json.posts.some((p) => p.code === ev.json.code),
    `posts=${evList.json.posts?.length}`
  );

  /* === C. инвойсы 2328.io только на специальных событиях === */
  const boost = await Curator("POST", "/api/boost/checkout", { code: CLIP, days: 1 });
  const boostOrderId = boost.json.orderId || "";
  ok(
    "boost checkout → инвойс bs-* + payUrl (спец-размещение)",
    boost.status === 200 && boostOrderId.startsWith("bs-") && String(boost.json.payUrl || "").includes("/pay/"),
    boost.json.error || boostOrderId
  );
  if (boostOrderId) cleanup.boostOrders.push(boostOrderId);

  /* у аккаунтов, прошедших только auth/награды/просмотры — ноль инвойсов */
  const invRows = await one(
    `SELECT
       (SELECT COUNT(*)::int FROM "DepositOrder" WHERE "accountId" = ANY($1)) AS dep,
       (SELECT COUNT(*)::int FROM "BoostOrder" WHERE "buyerHash" = ANY($1)) AS boost`,
    [[guestId, freshId, cMe.json.account?.accountId].filter(Boolean)]
  );
  ok("регулярные действия инвойсов не создают", (invRows?.dep ?? 1) === 0 && (invRows?.boost ?? 1) === 0, `dep=${invRows?.dep} boost=${invRows?.boost}`);

  /* watch-награда из v8: просмотр не меняет счётчик инвойсов */
  const w = await Guest("POST", "/api/reward/watch", { clipCode: CLIP });
  ok("watch-награда отвечает (fire-and-forget путь)", w.status === 200 && w.json.ok === true, w.json.error || "");

  /* === D. админ-панель в текущем стеке === */
  const stats = await Curator("GET", "/api/admin/stats");
  ok("панель: /api/admin/stats → 200", stats.status === 200, stats.json?.error || "");
  const refs = await Curator("GET", "/api/admin/referrals");
  ok("панель: /api/admin/referrals → 200", refs.status === 200, refs.json?.error || "");

  /* ---------- итог ---------- */
  console.log(`\n[v8-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- cleanup ---------- */
async function cleanupDb() {
  try {
    for (const email of cleanup.emailAuths) {
      await q('DELETE FROM "EmailAuth" WHERE email = $1', [email]);
    }
    for (const id of cleanup.boostOrders.filter(Boolean)) {
      await q('DELETE FROM "BoostOrder" WHERE "orderId" = $1', [id]);
    }
    for (const id of cleanup.accounts.filter(Boolean)) {
      await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
      await q('DELETE FROM "DepositOrder" WHERE "accountId" = $1', [id]);
      await q('DELETE FROM "Account" WHERE id = $1', [id]);
    }
  } catch (e) {
    console.warn("[cleanup] db skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
const mock = isCleanupOnly ? null : await ensureMock();
const csvBackup = isCleanupOnly ? null : fs.readFileSync(CSV_PATH, "utf-8");
try {
  if (!isCleanupOnly) await run();
} finally {
  if (!isCleanupOnly) {
    try {
      fs.writeFileSync(CSV_PATH, csvBackup, "utf-8");
      console.log("[cleanup] posts.csv восстановлен");
    } catch (e) {
      console.warn("[cleanup] csv restore failed:", e instanceof Error ? e.message : e);
    }
  }
  await cleanupDb();
  if (mock) mock.kill();
  await close();
}
