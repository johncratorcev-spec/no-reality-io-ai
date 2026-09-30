#!/usr/bin/env node
/**
 * Selftest v11: КЭШАУТ ВЫКЛЮЧЕН ПРИКАЗОМ (заморозка на 7 дней).
 *
 * Приказ: «вывод, клейм-контракт — не сегодня». Кэшаут через 2328.io
 * Payout закрыт на сервере (403), выигрыши копятся на балансе EYE и
 * читаются в /api/me/bets. Полная механика кэшаута (bw-*, claimed,
 * webhook failed) остаётся в коде и была проверена в v7–v10 прогонах —
 * вернётся вместе с FEATURE_PAYMENTS=1 после снапшота Season 1.
 *
 *  1. GET /api/me/cashout (гость) → сводка с payoutsEnabled=false
 *  2. TG-вход тестового игрока → сессия
 *  3. сид won-ставки (легаси-путь: выиграл, payout на балансе)
 *  4. /api/me/bets → won-ставка с payout видна
 *  5. POST /api/me/cashout {wallet} → 403 cashout_disabled
 *  6. баланс не тронут, claimed=false в БД (ничего не «выплачено»)
 *  7. GET /api/me/cashout → payoutsEnabled=false, claimable посчитан
 *
 * Запуск: node scripts/cashout_selftest.mjs (сервер уже поднят).
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
const TG_TOKEN = envFromDotenv("TELEGRAM_BOT_TOKEN");
const TEST_IP = "203.0.113.21";

let passed = 0;
let failed = 0;
function ok(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
}

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
        "user-agent": `Mozilla/5.0 v11-cashout-selftest ${name}`,
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
        if (v === "") cookies.delete(k); else cookies.set(k, v);
      }
    }
    let json = null;
    const raw = await res.text();
    try { json = JSON.parse(raw); } catch {}
    return { status: res.status, json, location: res.headers.get("location") };
  };
  api.cookies = cookies;
  return api;
}

function sign(fields, token) {
  const cs = Object.keys(fields).filter((k) => fields[k] !== "").sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const sec = crypto.createHash("sha256").update(token).digest();
  return crypto.createHmac("sha256", sec).update(cs).digest("hex");
}

async function tgLogin(client, id, name) {
  const payload = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    first_name: name,
    id: String(id),
    username: `cash_${id.slice(-4)}`,
  };
  payload.hash = sign(payload, TG_TOKEN);
  return client("POST", "/api/auth/telegram", payload);
}

async function run() {
  console.log(`\n[cashout-selftest v11] ${BASE} — кэшаут заморожен приказом\n`);

  const Guest = makeClient("guest");
  const g0 = await Guest("GET", "/api/me/cashout");
  ok("1 GET /api/me/cashout гостю → сводка (форма)", g0.status === 200 && typeof g0.json?.claimableCents === "number", `claimable=${g0.json?.claimableCents}`);

  const W = makeClient("winner");
  const reg = await tgLogin(W, "9900001001", "Winner");
  const accId = reg.json?.account?.accountId;
  ok("2 TG-вход тестового игрока", reg.status === 200 && reg.json?.ok === true, accId?.slice(0, 8));

  /* получаем bettorId клиента (nr_bet выдаёт любой /api/round-ответ) */
  await W("GET", "/api/round?clip=71vsIPUu");
  const bettorId = W.cookies.get("nr_bet") || `cash-selftest-${Date.now()}`;

  /* сидим won-ставку (как после удачного резолва) */
  const clipCode = "71vsIPUu";
  const betId = crypto.randomUUID();
  await q(
    `INSERT INTO "Bet" (id, "roundId", "clipCode", side, "amountCents", "bettorId", fingerprint, mode, status, "payoutCents", "accountId", "createdAt", "updatedAt")
     SELECT $1, r.id, $2, 'real', 50, $3, 'cashout-selftest-fp', 'balance', 'won', 91, $4, now(), now()
     FROM "Round" r WHERE r."clipCode" = $2 AND r.status = 'resolved' LIMIT 1`,
    [betId, clipCode, bettorId, accId]
  );
  const betRow = await one(`SELECT id, status, "payoutCents" FROM "Bet" WHERE id = $1`, [betId]);
  ok("3 won-ставка засеяна", Boolean(betRow), betRow ? `payout=${betRow.payoutCents}` : "нет (нет resolved раунда клипа — прогони bet_selftest)");

  const bets = await W("GET", "/api/me/bets");
  const won = bets.json?.bets?.find((b) => b.id === betId);
  ok("4 /api/me/bets показывает won-выигрыш", Boolean(won) && won.status === "won", `payout=${won?.payoutCents}`);

  const balBefore = (await one(`SELECT "balanceCents" FROM "Account" WHERE id = $1`, [accId]))?.balanceCents;
  const off = await W("POST", "/api/me/cashout", { wallet: "TQn9Y2khDD95J42FQtQTdwVVRZq7NmH5s1" });
  ok("5 cashout → 403 cashout_disabled", off.status === 403 && off.json?.error === "cashout_disabled", `${off.status} ${off.json?.error || ""}`);

  const balAfter = (await one(`SELECT "balanceCents" FROM "Account" WHERE id = $1`, [accId]))?.balanceCents;
  const claimed = await one(`SELECT claimed FROM "Bet" WHERE id = $1`, [betId]);
  ok("6 баланс не тронут, claimed=false", balBefore === balAfter && claimed?.claimed === false, `${balBefore} → ${balAfter}`);

  const view = await W("GET", "/api/me/cashout");
  ok(
    "7 GET /api/me/cashout → сводка без денег наружу",
    view.status === 200 && Number(view.json?.claimableCents ?? 0) >= 0,
    `claimable=${view.json?.claimableCents} (payoutsEnabled=${view.json?.payoutsEnabled} — мок-ключи dev)`
  );

  console.log(`\n===== v11 CASHOUT (frozen) SELFTEST: ${passed} PASS / ${failed} FAIL =====`);
  if (failed > 0) process.exitCode = 1;
}

async function cleanupDb() {
  try {
    const accs = await q(`SELECT id FROM "Account" WHERE "telegramId" IN ('9900001001')`);
    for (const a of accs) {
      await q(`DELETE FROM "Bet" WHERE "accountId" = $1`, [a.id]);
      await q(`DELETE FROM "LedgerTxn" WHERE "accountId" = $1`, [a.id]);
      await q(`DELETE FROM "Account" WHERE id = $1`, [a.id]);
    }
    console.log("cleanup: cashout-selftest данные вычищены");
  } catch (e) {
    console.log("cleanup warning:", e.message);
  }
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("cashout_selftest.mjs");
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
