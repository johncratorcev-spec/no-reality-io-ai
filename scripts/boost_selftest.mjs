#!/usr/bin/env node
/**
 * Selftest v11: ПЛАТНЫЕ БУСТЫ ВЫКЛЮЧЕНЫ ПРИКАЗОМ (заморозка на 7 дней).
 *
 * Приказ: «платежи выключить» — инвойсы bs-* не создаются, чекаут
 * отвечает 403 payments_disabled; статус-поллинг остаётся публичным
 * (карточки читают свой paidUntil). Ранжирование FEATURED по старым
 * paidUntil живёт до конца срока — деньги в игру не возвращаются.
 *
 *  1. GET /api/boost/status?code → 200 (публичный, без инвойса)
 *  2. POST /api/boost/checkout → 403 payments_disabled
 *  3. BoostOrder в БД не появился (никаких строк от чекаута)
 *  4. POST без авторизации → тоже 403 (гейт платежей раньше auth)
 *  5. повторный чекаут → 403 (нет ре-инвойсов и мусора)
 *
 * Запуск: node scripts/boost_selftest.mjs (сервер уже поднят).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const TEST_IP = "203.0.113.22";

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
        "user-agent": `Mozilla/5.0 v11-boost-selftest ${name}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    let json = null;
    const raw = await res.text();
    try { json = JSON.parse(raw); } catch {}
    return { status: res.status, json };
  };
  api.cookies = cookies;
  return api;
}

async function run() {
  console.log(`\n[boost-selftest v11] ${BASE} — бусты заморожены приказом\n`);

  const stamp = Date.now();
  const before = await one(`SELECT COUNT(*)::int AS n FROM "BoostOrder" WHERE "buyerHash" = $1`, [`v11-boost-${stamp}`]);

  const C = makeClient("curator");
  const status = await C("GET", "/api/boost/status?code=71vsIPUu");
  ok("1 status-поллинг публичен", status.status === 200, JSON.stringify(status.json || {}).slice(0, 80));

  const off = await C("POST", "/api/boost/checkout", { code: "71vsIPUu", days: 1 });
  ok("2 чекаут → 403 payments_disabled", off.status === 403 && off.json?.error === "payments_disabled", `${off.status} ${off.json?.error || ""}`);

  const rows = await one(
    `SELECT COUNT(*)::int AS n FROM "BoostOrder" WHERE "buyerHash" = $1 OR "createdAt" > now() - interval '1 minute' AND "orderId" LIKE 'bs-%'`,
    [`v11-boost-${stamp}`]
  );
  ok("3 BoostOrder не создан", (rows?.n ?? 0) === (before?.n ?? 0), `rows=${rows?.n}`);

  const anon = makeClient("anon");
  const off2 = await anon("POST", "/api/boost/checkout", { code: "71vsIPUu", days: 3 });
  ok("4 гость тоже получает 403 (гейт раньше auth)", off2.status === 403 && off2.json?.error === "payments_disabled", String(off2.status));

  const off3 = await C("POST", "/api/boost/checkout", { code: "71vsIPUu", days: 7 });
  ok("5 повторный чекаут → 403 без инвойсов", off3.status === 403 && off3.json?.error === "payments_disabled", String(off3.status));

  console.log(`\n===== v11 BOOST (frozen) SELFTEST: ${passed} PASS / ${failed} FAIL =====`);
  if (failed > 0) process.exitCode = 1;
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("boost_selftest.mjs");
if (isDirectRun) {
  run()
    .then(close)
    .catch(async (e) => {
      console.error("selftest crashed:", e);
      await close();
      process.exitCode = 1;
    });
}
