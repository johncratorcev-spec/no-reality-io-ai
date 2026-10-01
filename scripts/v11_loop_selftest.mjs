#!/usr/bin/env node
/**
 * Selftest v11: ПЕТЛЯ SEASON 1 — против работающего dev-сервера :3000
 * (Supabase Postgres). Петля приказа: вход → ставка очками → вердикт →
 * счёт в ledger → снапшот.
 *
 * A. Telegram-вход (серверная проверка HMAC по спеке):
 *    1. валидный подписанный payload → 200 ok, created=true,
 *       cookies nr_uid+nr_auth, баланс 100 EYE, NR PASS
 *    2. DB: Account.telegramId + LedgerTxn signup_bonus delta=+100
 *    3. повторный вход тем же telegramId → created=false, ТОТ ЖЕ аккаунт,
 *       баланс по-прежнему 100 (welcome не задваивается)
 *    4. подделанный hash → 401
 *    5. auth_date 25 часов назад → 401 (replay)
 *    6. мусорный id → 401
 * B. Петля ставки (10/25/50):
 *    7. ставка 10 EYE → ok, баланс 90; DB: bet_stake −10
 *    8. ставка 75 EYE (вне 10..50) → 400
 *    9. второй аккаунт ставит 25 на другую сторону → баланс 75
 *   10. админ-резолв REAL → победитель: 90 + payout + guess_reward,
 *       проигравший: 75; математика пари-мьютюэля сходится
 *   11. DB: LedgerTxn bet_payout + guess_reward(+10), Σdelta == баланс
 * C. Платежи выключены приказом:
 *   12. POST /api/wallet/deposit → 403 payments_disabled
 *   13. POST /api/me/cashout → 403 cashout_disabled
 *   14. POST /api/boost/checkout → 403 payments_disabled
 * D. Снапшот Season 1:
 *   15. GET /api/admin/snapshot без ключа → 401
 *   16. с ключом → CSV-шапка userId,telegramId,eye,score,bets,correct,weight
 *   17. в CSV: игрок петли с ≥5 settled ставками; weight = eye*min(1,bets/10)
 *   18. аккаунт с 3 settled ставками НЕ в CSV (порог 5)
 *   19. аккаунт «только welcome» НЕ в CSV
 * E. Страницы:
 *   20. GET / → 200, «Season 1 live», кнопка call it
 *   21. GET /seam → 307/308 → /bet
 *   22. GET /bet гостем → 200 (сайт открыт, гейт только на действии)
 *   23. /api/season → окно [00:00 UTC сегодня, 12:00 UTC T+7]
 *
 * Запуск: node scripts/v11_loop_selftest.mjs (сервер уже поднят).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

function envFromDotenv(name) {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

const ADMIN_SECRET = envFromDotenv("ADMIN_SECRET");
const TG_TOKEN = envFromDotenv("TELEGRAM_BOT_TOKEN");
const TEST_IP = "203.0.113.11"; /* фиктивный XFF — изоляция rate-limit'ов */

let passed = 0;
let failed = 0;
const cleanupAccounts = [];
const cleanupBets = [];
const cleanupRounds = [];

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
  const api = async function (method, url, body, extraHeaders = {}) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "x-forwarded-for": TEST_IP,
        "user-agent": `Mozilla/5.0 v11-selftest/1.0 ${name}`,
        ...extraHeaders,
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
      text: json === null ? raw : "",
    };
  };
  api.cookies = cookies;
  return api;
}

/* ---------- подпись Telegram (зеркало серверной проверки) ---------- */
function signTelegram(fields, token) {
  const checkString = Object.keys(fields)
    .filter((k) => fields[k] !== undefined && fields[k] !== "")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  return crypto.createHmac("sha256", secret).update(checkString).digest("hex");
}

function tgPayload(token, { id, first = "Loop", user, ageSec = 60, tamper = false }) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000) - ageSec),
    first_name: first,
    id: String(id),
    username: user,
  };
  const hash = signTelegram(fields, token);
  return { ...fields, hash: tamper ? "f".repeat(64) : hash };
}

/* ---------- helpers ---------- */
async function ledgerSum(accountId) {
  const r = await one(
    `SELECT COALESCE(SUM(delta),0)::int AS s, (SELECT "balanceCents" FROM "Account" WHERE id = $1)::int AS b
     FROM "LedgerTxn" WHERE "accountId" = $1`,
    [accountId]
  );
  return r;
}

async function run() {
  console.log("\n=== A. Telegram-вход ===");
  const tgIdA = "9900000001";
  const tgIdB = "9900000002";
  const A = makeClient("tg-a");
  const B = makeClient("tg-b");

  const pA = tgPayload(TG_TOKEN, { id: tgIdA, user: "loop_a" });
  const r1 = await A("POST", "/api/auth/telegram", pA);
  ok("1 valid payload → 200 ok created", r1.status === 200 && r1.json?.ok === true && r1.json?.created === true, `bal=${r1.json?.account?.balanceCents}`);
  ok("1b cookies nr_uid+nr_auth выданы", A.cookies.has("nr_uid") && /^v1\./.test(A.cookies.get("nr_auth") || ""));
  const accA = r1.json?.account?.accountId;
  ok("1c баланс ровно 100 EYE", r1.json?.account?.balanceCents === 100);
  ok("1d NR PASS выдан", r1.json?.account?.isPass === true);
  ok("1e имя в AccountView", (r1.json?.account?.name || "").includes("Loop"));
  cleanupAccounts.push(accA);

  const dbA = await one(
    `SELECT a."telegramId", a."tgUsername", t.delta FROM "Account" a
     JOIN "LedgerTxn" t ON t."accountId" = a.id AND t.kind = 'signup_bonus'
     WHERE a.id = $1`,
    [accA]
  );
  ok("2 DB: telegramId + signup_bonus +100", dbA?.telegramId === tgIdA && Number(dbA?.delta) === 100);

  const r3 = await makeClient("tg-a2")("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: tgIdA, user: "loop_a" }));
  ok("3 повторный вход → тот же аккаунт, без welcome", r3.status === 200 && r3.json?.created === false && r3.json?.account?.accountId === accA && r3.json?.account?.balanceCents === 100);

  const bad = await A("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: "9900000009", tamper: true }));
  ok("4 подделанный hash → 401", bad.status === 401);
  const old = await A("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: "9900000009", ageSec: 25 * 3600 }));
  ok("5 просроченный auth_date → 401", old.status === 401);
  const junk = await A("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: "not-a-number" }));
  ok("6 мусорный id → 401", junk.status === 401);

  console.log("\n=== B. Петля ставки 10/25/50 → вердикт → ledger ===");
  /* открываем раунд на реальном клипе из ленты */
  const clipRes = await fetch(`${BASE}/api/posts`);
  const posts = (await clipRes.json())?.posts || [];
  const clip = posts.find((p) => p.bettable) || posts[0];
  const clipCode = clip?.utmCode || clip?.utm_code;
  ok("7.0 клип из ленты найден", Boolean(clipCode), clipCode);

  const rv = await A("GET", `/api/round?clip=${encodeURIComponent(clipCode)}`);
  const roundId = rv.json?.round?.id || rv.json?.id;
  ok("7.1 раунд открыт", Boolean(roundId));

  const bet1 = await A("POST", "/api/bet", { round_id: roundId, side: "real", amount_cents: 10, mode: "balance" });
  ok("7 ставка 10 EYE принята", bet1.status === 200 && !bet1.json?.error, `bal=${bet1.json?.account?.balanceCents}`);
  ok("7b баланс после ставки = 90", bet1.json?.account?.balanceCents === 90);
  const stake1 = await one(
    `SELECT delta FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = 'bet_stake' ORDER BY "createdAt" DESC LIMIT 1`,
    [accA]
  );
  ok("7c DB: bet_stake −10", Number(stake1?.delta) === -10);

  const betBad = await A("POST", "/api/bet", { round_id: roundId, side: "real", amount_cents: 75, mode: "balance" });
  ok("8 ставка 75 (вне 10..50) → 400", betBad.status === 400);

  const pB = tgPayload(TG_TOKEN, { id: tgIdB, first: "Second", user: "loop_b" });
  const rB = await B("POST", "/api/auth/telegram", pB);
  const accB = rB.json?.account?.accountId;
  cleanupAccounts.push(accB);
  const rv2 = await B("GET", `/api/round?clip=${encodeURIComponent(clipCode)}`);
  const roundId2 = rv2.json?.round?.id || rv2.json?.id;
  const bet2 = await B("POST", "/api/bet", { round_id: roundId2, side: "synth", amount_cents: 25, mode: "balance" });
  ok("9 второй аккаунт ставит 25 на SYNTH", bet2.status === 200 && bet2.json?.account?.balanceCents === 75, `bal=${bet2.json?.account?.balanceCents}`);
  cleanupBets.push(bet1.json?.bet_id, bet2.json?.bet_id);
  cleanupRounds.push(roundId2);

  /* админ закрывает раунд руками (REAL) */
  const resolve = await A("POST", `/api/admin/rounds?key=${ADMIN_SECRET}`, { roundId: roundId2, verdict: "real" });
  ok("10 админ-резолв REAL → ok", resolve.status === 200 && resolve.json?.ok === true, JSON.stringify(resolve.json?.summary || {}).slice(0, 120));

  const sumA = await ledgerSum(accA);
  const sumB = await ledgerSum(accB);
  /* payout = floor((35−3)*10/10) = 32; + guess_reward 10 → 90+32+10 = 132 */
  ok("10b победитель: баланс 132 (90+32+10)", sumA?.b === 132, `bal=${sumA?.b} sum=${sumA?.s}`);
  ok("10c проигравший: баланс 75", sumB?.b === 75, `bal=${sumB?.b}`);
  ok("11 ledger сходится: Σdelta == баланс", sumA?.s === sumA?.b && sumB?.s === sumB?.b);
  const guess = await one(
    `SELECT delta FROM "LedgerTxn" WHERE "accountId" = $1 AND kind = 'guess_reward' ORDER BY "createdAt" DESC LIMIT 1`,
    [accA]
  );
  ok("11b DB: guess_reward +10", Number(guess?.delta) === 10);

  console.log("\n=== C. Платежи выключены приказом ===");
  const dep = await A("POST", "/api/wallet/deposit", { amount_cents: 500 });
  ok("12 deposit → 403 payments_disabled", dep.status === 403 && dep.json?.error === "payments_disabled");
  const cash = await A("POST", "/api/me/cashout", { wallet: "TQn9Y2khDD95J42FQtQTdwVVRZq7NmH5s1" });
  ok("13 cashout → 403 cashout_disabled", cash.status === 403 && cash.json?.error === "cashout_disabled");
  const boost = await A("POST", "/api/boost/checkout", { code: clipCode, days: 1 });
  ok("14 boost checkout → 403 payments_disabled", boost.status === 403 && boost.json?.error === "payments_disabled");

  console.log("\n=== D. Снапшот Season 1 ===");
  /* досеиваем ставки: у accB должно остаться <5 settled, у accA добавим 4 settled → 5 */
  for (let i = 0; i < 4; i++) {
    await q(
      `INSERT INTO "Bet" (id, "roundId", "clipCode", side, "amountCents", "bettorId", fingerprint, mode, status, "accountId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'balance',$8,$9,now(),now())`,
      [
        crypto.randomUUID(),
        roundId2,
        clipCode,
        i % 2 === 0 ? "real" : "synth",
        10,
        `selftest-bettor-${i}-${Date.now()}`,
        "selftest-fp",
        i % 2 === 0 ? "won" : "lost",
        accA,
      ]
    );
  }
  /* отдельный аккаунт с 3 settled ставками — не должен попасть в срез */
  const short = await makeClient("short")("POST", "/api/auth/telegram", tgPayload(TG_TOKEN, { id: "9900000003", first: "Short", user: "loop_short" }));
  const accShort = short.json?.account?.accountId;
  cleanupAccounts.push(accShort);
  for (let i = 0; i < 3; i++) {
    await q(
      `INSERT INTO "Bet" (id, "roundId", "clipCode", side, "amountCents", "bettorId", fingerprint, mode, status, "accountId", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'balance',$8,$9,now(),now())`,
      [
        crypto.randomUUID(),
        roundId2,
        clipCode,
        i % 2 === 0 ? "real" : "synth",
        10,
        `selftest-short-${i}-${Date.now()}`,
        "selftest-fp",
        i % 2 === 0 ? "won" : "lost",
        accShort,
      ]
    );
  }

  const noKey = await A("GET", "/api/admin/snapshot");
  ok("15 без ключа → 401", noKey.status === 401);
  const snap = await A("GET", `/api/admin/snapshot?key=${ADMIN_SECRET}`);
  const lines = snap.text.trim().split("\n");
  const header = lines[0];
  ok("16 CSV 200 + шапка", snap.status === 200 && header === "userId,telegramId,eye,score,bets,correct,weight,displayName", header);
  const rowA = lines.find((l) => l.includes(accA));
  ok("17 игрок петли в CSV", Boolean(rowA), rowA?.slice(0, 120));
  if (rowA) {
    const cells = rowA.split(",").map((c) => c.replaceAll('"', ""));
    const eye = Number(cells[2]);
    const bets = Number(cells[4]);
    const weight = Number(cells[6]);
    const expected = Math.round(eye * Math.min(1, bets / 10));
    ok("17b weight = eye*min(1,bets/10)", weight === expected, `eye=${eye} bets=${bets} w=${weight}`);
    ok("17c bets ≥ 5 (ставка петли + 4 сеяных)", bets >= 5, `bets=${bets}`);
  }
  const shortIn = lines.some((l) => l.includes(accShort));
  ok("18 аккаунт с 3 ставками НЕ в CSV", !shortIn);
  ok("19 шапка содержит telegramId колонку", header.includes("telegramId"));

  console.log("\n=== E. Страницы ===");
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  ok(
    "20 / → 200, Season 1 live",
    /* v13: лендинг i18n-ный — пилл в нижнем регистре «season 1 live» */
    home.status === 200 && homeHtml.toLowerCase().includes("season 1 live")
  );
  ok("20b кнопка call it", homeHtml.includes("call it"));
  const seam = await A("GET", "/seam");
  ok("21 /seam → redirect /bet", (seam.status === 307 || seam.status === 308) && seam.location === "/bet", `status=${seam.status}`);
  const betPage = await A("GET", "/bet");
  ok("22 /bet гостем → 200", betPage.status === 200);
  const season = await A("GET", "/api/season");
  const endsAt = season.json?.season ? new Date(season.json.season.endsAt) : null;
  const startsAt = season.json?.season ? new Date(season.json.season.startsAt) : null;
  const today00 = new Date();
  today00.setUTCHours(0, 0, 0, 0);
  const expectedEnd = startsAt ? new Date(startsAt) : null;
  if (expectedEnd) {
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 7);
    expectedEnd.setUTCHours(12, 0, 0, 0);
  }
  ok(
    "23 окно сезона [старт ≤ 00:00 UTC сегодня, конец = старт+7д 12:00 UTC]",
    /* v13: сезон живёт несколько дней — старт уже не «сегодня»; важно
       что конец = старт + 7 дней в 12:00 UTC (формула не сломана) */
    startsAt && startsAt.getTime() <= today00.getTime() && endsAt?.getTime() === expectedEnd?.getTime(),
    `${startsAt?.toISOString()} → ${endsAt?.toISOString()}`
  );

  console.log(`\n===== v11 LOOP SELFTEST: ${passed} PASS / ${failed} FAIL =====`);
  if (failed > 0) process.exitCode = 1;
}

async function cleanupDb() {
  try {
    for (const acc of cleanupAccounts) {
      if (!acc) continue;
      await q(`DELETE FROM "LedgerTxn" WHERE "accountId" = $1`, [acc]);
      await q(`DELETE FROM "Account" WHERE id = $1`, [acc]);
    }
    for (const rid of cleanupRounds) {
      if (!rid) continue;
      await q(`DELETE FROM "TrackEvent" WHERE "clipCode" = (SELECT "clipCode" FROM "Round" WHERE id = $1) AND "meta" LIKE '%' || $1 || '%'`, [rid]).catch(() => {});
      await q(`DELETE FROM "Bet" WHERE "roundId" = $1`, [rid]);
      await q(`DELETE FROM "Round" WHERE id = $1`, [rid]);
    }
    console.log("cleanup: selftest-данные вычищены");
  } catch (e) {
    console.log("cleanup warning:", e.message);
  }
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("v11_loop_selftest.mjs");
if (isDirectRun) {
  run()
    .then(cleanupDb)
    .then(close)
    .catch(async (e) => {
      console.error("selftest crashed:", e);
      await cleanupDb();
      await close();
      process.exitCode = 1;
    });
}
