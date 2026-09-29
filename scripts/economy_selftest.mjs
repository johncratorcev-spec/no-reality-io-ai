#!/usr/bin/env node
/**
 * Selftest v6: ВНУТРЕННЯЯ ЭКОНОМИКА — против работающего dev-сервера :3000
 * с тестовыми ключами 2328 (мок :9999):
 *
 *   TWOTHOUSAND328_API_BASE=http://127.0.0.1:9999/api
 *   TWOTHOUSAND328_PAYMENT_API_KEY=test-payment-key
 *   TWOTHOUSAND328_PAYOUT_API_KEY=test-payout-key
 *   TWOTHOUSAND328_PROJECT_UUID=test-project-uuid
 *
 * Проверяет (порог входа = 0, баланс = источник истины):
 *  A. мгновенный аккаунт:
 *     1. GET /api/me → аккаунт + welcome-бонус; повторный GET → идемпотентно
 *  B. награды за целевые клики + антифрод:
 *     2. клик target1 → credited
 *     3. клик target2 сразу → too_fast (velocity)
 *     4. клик target2 через паузу → credited
 *     5. повторный клик target1 → duplicate (посуточный дедуп)
 *     6. бот-UA → bot
 *  C. NR PASS:
 *     7. passTier=1 (сессия google/magic; крипто-привязка удалена v7.1 — прямой SQL)
 *     8. daily-бонус → credited, streak 1
 *     9. повторный daily в тот же UTC-день → no-op
 *  D. крипто-пополнение (внутренний баланс = источник истины):
 *    10. POST /api/wallet/deposit → инвойс dp-*, payUrl мока
 *    11. webhook с битой подписью → 401, баланс не меняется
 *    12. webhook paid (верный HMAC) → баланс пополнен
 *    13. повторный webhook paid → идемпотентно (двойного зачисления нет)
 *  E. ставка с баланса:
 *    14. POST /api/bet mode=balance → active, баланс списан, пул вырос
 *    15. повторная ставка на раунд → already_bet
 *    16. ставка сверх баланса → insufficient_balance (402)
 *  F. резолв → выплата на баланс:
 *    17. после closesAt раунд resolved, win → LedgerTxn bet_payout, баланс вырос
 *    17b. v8: верная ставка → guess_reward +10 (идемпотентный refKey)
 *  G. награда за UTM-переходы:
 *    18. GET /r/<clip>?ref=<owner> (новый visitor) → UtmClick + utm_reward
 *    19. повторный заход того же visitor → дубля нет
 *  W. v8: награда за просмотр ленты (вместо Instagram-задания):
 *    20. три разных клипа → на 3-м credited +10; повтор клипа → already
 *    21. 4-й клип → не кратен N → без начисления
 *    22./routes /api/reward/instagram удалены (404)
 *  H. сервис жив:
 *    23. GET /api/health → ok, db:up
 *
 * Запуск: node scripts/economy_selftest.mjs
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import path from "node:path";

import { readFileSync } from "node:fs";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const ADMIN_SECRET_ENV = (readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
  .split("\n")
  .find((l) => l.startsWith("ADMIN_SECRET=")) || "")
  .split("=")[1]?.replace(/"/g, "")
  .trim();

const PAYMENT_KEY = "test-payment-key";
const CLIP = "71vsIPUu";
const OWNER_CODE = "recontest1";
const OWNER_WALLET = "0xecontest0000000000000000000000000000dead1";

let passed = 0;
let failed = 0;
const cleanup = {
  accounts: [],
  deposits: [],
  rounds: [],
  bets: [],
  utmClicks: [],
  refProfiles: [],
  events: [],
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


function sign2328(body, key) {
  const base64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64");
  return createHmac("sha256", key).update(base64, "utf-8").digest("hex");
}

/* ---------- cookie-jar fetch (nr_uid + nr_bet + nr_wallet) ---------- */
function makeClient(name, uaSuffix = "") {
  const cookies = new Map();
  return async function api(method, url, body) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "user-agent": `Mozilla/5.0 economy-selftest/1.0 ${name}${uaSuffix}`,
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
}

/* ---------- v10: регистрация вместо мгновенного гостя ---------- */
/* код правильной геометрии: NR + 12 символов алфавита 31 (без 0/O/1/I/L) */
function freshCode() {
  const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const ts = Date.now().toString(36).toUpperCase().replace(/[01OLI]/g, "X");
  const rand = Math.random().toString(36).toUpperCase().replace(/[01OLI]/g, "X");
  let body = ((ts + rand + "XXXXXXXXXXXX").replace(/[^2-9A-HJKMNP-Z]/g, "X")).slice(0, 12);
  return "NR" + body;
}

/** регистрирует игрока с сеяным промокодом (v10: гостям аккаунтов нет) */
async function registerClient(api, tag) {
  const code = freshCode();
  await q(
    'INSERT INTO "PromoCode" (id, code, batch) VALUES (gen_random_uuid(), $1, \'selftest\') ON CONFLICT (code) DO NOTHING',
    [code]
  );
  const email = `v10-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.dev`;
  const res = await api("POST", "/api/auth/password", {
    email,
    password: "selftest-pass-1",
    promo: code,
  });
  if (res.status !== 200 || res.json?.status !== "registered") {
    console.warn(`[register ${tag}] FAILED:`, res.status, JSON.stringify(res.json));
  }
  return { email, code, res };
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
  console.log(`\n[economy-selftest] ${BASE} — внутренняя экономика (v10: ставки/награды за auth)\n`);

  /* === A. v10: аккаунт только через регистрацию (гостя больше нет) === */
  const U = makeClient("player");
  const regU = await registerClient(U, "player");
  const accId = regU.res.json.account?.accountId;
  ok(
    "аккаунт создан регистрацией (гость без аккаунта)",
    regU.res.status === 200 && regU.res.json.status === "registered" && Boolean(accId),
    accId?.slice(0, 8)
  );
  ok(
    "welcome-бонус начислен (300)",
    regU.res.json.account?.balanceCents === 300,
    `balance=${regU.res.json.account?.balanceCents}`
  );
  const me2 = await U("GET", "/api/me");
  ok(
    "повторный GET /api/me идемпотентен + authed:true",
    me2.json.authed === true && me2.json.account?.balanceCents === 300,
    `authed=${me2.json.authed} balance=${me2.json.account?.balanceCents}`
  );
  cleanup.accounts.push(accId);

  const balOf = async () => {
    const m = await U("GET", "/api/me");
    return m.json.account?.balanceCents ?? -1;
  };

  /* === B. награды за целевые клики + антифрод === */
  const c1 = await U("POST", "/api/reward/click", { target: "featured:econ-a" });
  ok("клик по цели → credited", c1.json.credited === true && c1.json.reward_cents === 5, `+${c1.json.reward_cents}`);
  const c2 = await U("POST", "/api/reward/click", { target: "featured:econ-b" });
  ok("второй клик сразу → too_fast", c2.json.credited === false && c2.json.reason === "too_fast", c2.json.reason);
  await new Promise((r) => setTimeout(r, 2200));
  const c3 = await U("POST", "/api/reward/click", { target: "featured:econ-b" });
  ok("после паузы → credited", c3.json.credited === true, `+${c3.json.reward_cents}`);
  await new Promise((r) => setTimeout(r, 2200));
  const c4 = await U("POST", "/api/reward/click", { target: "featured:econ-a" });
  ok("повтор цели → duplicate (дедуп дня)", c4.json.credited === false && c4.json.reason === "duplicate", c4.json.reason);

  const Bot = makeClient("bot");
  const regBot = await registerClient(Bot, "bot");
  cleanup.accounts.push(regBot.res.json.account?.accountId);
  const cb = await Bot("POST", "/api/reward/click", { target: "featured:econ-bot" });
  ok("бот-UA → отклонён", cb.json.credited === false && cb.json.reason === "bot", cb.json.reason);

  /* === C. NR PASS === */
  const W = makeClient("wallet-user");
  const regW = await registerClient(W, "wallet");
  const wAccId = regW.res.json.account?.accountId;
  cleanup.accounts.push(wAccId);
  /* v7.1: PASS выдаёт google/magic-вход; здесь эмулируем уже-вошедшего
     пользователя прямым SQL (роут /api/me/link-wallet удалён вместе
     с крипто-подключением) */
  await q('UPDATE "Account" SET "passTier" = 1 WHERE id = $1', [wAccId]);
  const d1 = await W("POST", "/api/me/daily");
  ok("daily-бонус PASS → credited", d1.json.credited === true && d1.json.streakDays === 1, `+${d1.json.amountCents}`);
  const d2 = await W("POST", "/api/me/daily");
  ok("повторный daily в тот же день → no-op", d2.json.credited === false, `streak=${d2.json.streakDays}`);

  /* === D. крипто-пополнение: webhook = источник истины === */
  const balBefore = await balOf();
  let dep = await U("POST", "/api/wallet/deposit", { amount_cents: 500 });
  if (!String(dep.json.pay_url || "").includes("/pay/")) {
    /* cold-start retry: первый запрос после рестарта сервера может прийти
       до полной готовности мока/клиента — повторяем один раз */
    await new Promise((r) => setTimeout(r, 1500));
    dep = await U("POST", "/api/wallet/deposit", { amount_cents: 500 });
  }
  ok("инвойс создан (crypto)", dep.status === 200 && dep.json.mode === "crypto" && String(dep.json.pay_url || "").includes("/pay/"), dep.json.error || dep.json.order_id);
  const depUuid = String(dep.json.pay_url || "").split("/pay/")[1] || "";
  const depRow = await one(
    'SELECT id, "orderId", status, "amountCents", "accountId" FROM "DepositOrder" WHERE "paymentId" = $1',
    [depUuid]
  );
  ok("DepositOrder pending, dp-*", depRow?.status === "pending" && String(depRow?.orderId || "").startsWith("dp-"), depRow?.orderId);
  cleanup.deposits.push(depRow?.id);
  cleanup.accounts.push(depRow?.accountId);

  const badDep = await webhook2328(
    { uuid: depUuid, order_id: depRow.orderId, payment_status: "paid", txid: "mock-tx-d1", amount: "5.00", currency: "USDT" },
    "wrong-key-XXXX"
  );
  ok("депозит webhook битая подпись → 401", badDep === 401);
  const balAfterBad = await balOf();
  ok("после 401 баланс не тронут", balAfterBad === balBefore, `${balAfterBad} === ${balBefore}`);

  const goodDep = await webhook2328(
    { uuid: depUuid, order_id: depRow.orderId, payment_status: "paid", txid: "mock-tx-d1", amount: "5.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("депозит webhook принят", goodDep === 200);
  const balAfterPaid = await balOf();
  ok("баланс пополнен (+$5)", balAfterPaid === balBefore + 500, `${balBefore} → ${balAfterPaid}`);
  const depPaid = await one('SELECT status FROM "DepositOrder" WHERE id = $1', [depRow.id]);
  ok("DepositOrder paid", depPaid?.status === "paid");

  const dupDep = await webhook2328(
    { uuid: depUuid, order_id: depRow.orderId, payment_status: "paid", txid: "mock-tx-d1", amount: "5.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("повторный webhook → 200", dupDep === 200);
  const ledgerDep = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "refKey" = $1 AND kind = \'deposit\'',
    [`deposit:${depUuid}`]
  );
  ok("двойного зачисления нет (refKey unique)", (ledgerDep?.n ?? 0) === 1, `rows=${ledgerDep?.n}`);

  /* --- v7: бонус-мультипликатор пакета (1000 → +10%) --- */
  const balBeforeBig = await balOf();
  const depBig = await U("POST", "/api/wallet/deposit", { amount_cents: 1000 });
  ok(
    "пакет 1000: инвойс с бонусом",
    depBig.status === 200 && depBig.json.bonus_cents === 100 && depBig.json.bonus_pct === 10,
    `bonus=${depBig.json.bonus_cents}/${depBig.json.bonus_pct}% ${depBig.json.error || ""}`
  );
  const bigUuid = String(depBig.json.pay_url || "").split("/pay/")[1] || "";
  const bigRow = await one(
    'SELECT id, "orderId", "bonusCents" FROM "DepositOrder" WHERE "paymentId" = $1',
    [bigUuid]
  );
  ok("DepositOrder.bonusCents = 100", bigRow?.bonusCents === 100, `row=${bigRow?.bonusCents}`);
  cleanup.deposits.push(bigRow?.id);
  cleanup.accounts.push(bigRow?.accountId);
  const goodBig = await webhook2328(
    { uuid: bigUuid, order_id: bigRow.orderId, payment_status: "paid", txid: "mock-tx-big", amount: "10.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("бонус-пакет webhook принят", goodBig === 200);
  const balAfterBig = await balOf();
  ok("баланс +1100 (1000 + бонус 10%)", balAfterBig === balBeforeBig + 1100, `${balBeforeBig} → ${balAfterBig}`);
  const bonusTxn = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "refKey" = $1 AND kind = \'deposit_bonus\'',
    [`deposit_bonus:${bigUuid}`]
  );
  ok("ledger deposit_bonus записан", (bonusTxn?.n ?? 0) === 1, `rows=${bonusTxn?.n}`);

  /* === E. ставка с баланса === */
  const roundOpen = await U("GET", `/api/round?clip=${CLIP}`);
  const round = roundOpen.json.round;
  ok("раунд открыт", roundOpen.status === 200 && Boolean(round?.id), round?.id?.slice(0, 8));
  cleanup.rounds.push(round?.id);

  /* === E0. v7: крипто/demo-ставки сняты с производства === */
  const betLegacy = await U("POST", "/api/bet", {
    round_id: round.id,
    side: "real",
    amount_cents: 100,
  });
  ok("ставка без mode → bet_mode_disabled (400)", betLegacy.status === 400 && betLegacy.json.error === "bet_mode_disabled", betLegacy.json.error);
  const betCrypto = await U("POST", "/api/bet", {
    round_id: round.id,
    side: "real",
    amount_cents: 100,
    mode: "crypto",
  });
  ok("mode=crypto → bet_mode_disabled (400)", betCrypto.status === 400 && betCrypto.json.error === "bet_mode_disabled", betCrypto.json.error);

  const balBeforeBet = await balOf();
  const bet1 = await U("POST", "/api/bet", {
    round_id: round.id,
    side: "real",
    amount_cents: 100,
    mode: "balance",
  });
  ok("balance-ставка активна", bet1.status === 200 && bet1.json.status === "active" && bet1.json.mode === "balance", bet1.json.error || bet1.json.bet_id?.slice(0, 8));
  ok("баланс списан", bet1.json.balance_cents === balBeforeBet - 100, `${balBeforeBet} → ${bet1.json.balance_cents}`);
  ok("пул вырос", bet1.json.round?.poolTotalCents === 100, `pool=${bet1.json.round?.poolTotalCents}`);
  cleanup.bets.push(bet1.json.bet_id);

  const betDup = await U("POST", "/api/bet", {
    round_id: round.id,
    side: "synth",
    amount_cents: 100,
    mode: "balance",
  });
  ok("повторная ставка на раунд → already_bet", betDup.status === 409 && betDup.json.error === "already_bet");

  const betTooBig = await U("POST", "/api/bet", {
    round_id: round.id,
    side: "real",
    amount_cents: 100000,
    mode: "balance",
  });
  ok("сверх лимита → bad_amount", betTooBig.status === 400 && betTooBig.json.error === "bad_amount");

  /* ставка сверх баланса: новичок с пустым балансом (welcome=300 → ставим 500) */
  const Poor = makeClient("poor");
  const regPoor = await registerClient(Poor, "poor");
  cleanup.accounts.push(regPoor.res.json.account?.accountId);
  const poorRound = await Poor("GET", `/api/round?clip=${CLIP}`);
  /* раунд уже занят ставкой игрока с того же IP-fingerprint → поднимем свой */
  const poorRound2 = await Poor("GET", `/api/round?clip=puhGJNmX`);
  const targetRound = poorRound2.json.round ?? poorRound.json.round;
  cleanup.rounds.push(targetRound?.id);
  const poorBet = await Poor("POST", "/api/bet", {
    round_id: targetRound.id,
    side: "synth",
    amount_cents: 500,
    mode: "balance",
  });
  ok("сверх баланса → insufficient_balance (402)", poorBet.status === 402 && poorBet.json.error === "insufficient_balance", poorBet.json.error);

  /* === W0. v8: награда за просмотр ленты (вместо Instagram-задания) ===
     Свежий аккаунт: 0 отметок сегодня → детерминированная арифметика
     (every=3 клипа, +10 монет, капс 100/день). Идём до F — пока
     идёт ожидание closesAt, ничего не мешаем. */
  const Wc = makeClient("watch-user");
  const regWc = await registerClient(Wc, "watch");
  const wBal0 = regWc.res.json.account?.balanceCents ?? 0;
  cleanup.accounts.push(regWc.res.json.account?.accountId);
  const w1 = await Wc("POST", "/api/reward/watch", { clipCode: CLIP });
  ok("watch: 1-й клип → отметка без монет", w1.status === 200 && w1.json.ok === true && w1.json.credited === false, `watched=${w1.json.watchedToday}`);
  const w2 = await Wc("POST", "/api/reward/watch", { clipCode: CLIP });
  ok("watch: повтор того же клипа → already", w2.json.ok === true && w2.json.already === true && w2.json.credited === false);
  await Wc("POST", "/api/reward/watch", { clipCode: "zXMNjL2F" });
  const w3 = await Wc("POST", "/api/reward/watch", { clipCode: "wcDJIxC1" });
  ok("watch: 3-й уникальный клип → credited +10", w3.json.credited === true && w3.json.rewardCents === 10, `+${w3.json.rewardCents}`);
  ok("watch: баланс вырос на 10", (w3.json.account?.balanceCents ?? 0) === wBal0 + 10, `${wBal0} → ${w3.json.account?.balanceCents}`);
  const w4 = await Wc("POST", "/api/reward/watch", { clipCode: "AOABUGXd" });
  ok("watch: 4-й клип (некратен 3) → без монет", w4.json.credited === false, `watched=${w4.json.watchedToday}`);
  const wBad = await Wc("POST", "/api/reward/watch", { clipCode: "<script>" });
  ok("watch: мусорный clipCode → 400", wBad.status === 400, `status=${wBad.status}`);

  /* === F. резолв → выплата на баланс === */
  console.log("  … ждём closesAt раунда (окно 45с в sandbox) …");
  await new Promise((r) => setTimeout(r, 50_000));
  const roundAfter = await U("GET", `/api/round/${round.id}`);
  const rv = roundAfter.json.round;
  ok("раунд resolved", rv?.status === "resolved", `as=${rv?.resolvedAs}`);
  const betRow = await one('SELECT id, status, "payoutCents", mode, "accountId" FROM "Bet" WHERE id = $1', [bet1.json.bet_id]);
  ok("ставка closed по вердикту", betRow?.status === "won" || betRow?.status === "lost", `truth-side=${rv?.resolvedAs}, bet=real`);
  const payTxn = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "refKey" = $1 AND kind = \'bet_payout\'',
    [`betpay:${bet1.json.bet_id}`]
  );
  if (betRow?.status === "won") {
    ok("выплата пришла на баланс (LedgerTxn bet_payout)", (payTxn?.n ?? 0) === 1 && (betRow?.payoutCents ?? 0) > 0, `payout=${betRow?.payoutCents}`);
  } else {
    ok("проигрыш: выплаты нет — корректно", (payTxn?.n ?? 0) === 0);
  }

  /* v8: награда за угадывание — +10 поверх пари-мьютюэль за верную ставку */
  const guessTxn = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE "refKey" = $1 AND kind = \'guess_reward\'',
    [`guess:${bet1.json.bet_id}`]
  );
  if (betRow?.status === "won") {
    ok("угадал → guess_reward +10 (LedgerTxn)", (guessTxn?.n ?? 0) === 1, `rows=${guessTxn?.n}`);
  } else {
    ok("не угадал → guess_reward нет — корректно", (guessTxn?.n ?? 0) === 0);
  }

  const balFinal = await balOf();
  /* инвариант экономики: Σ delta по журналу = кэш баланса (включая все
     новые награды v8 — проверка переживает любую арифметику) */
  const ledgerSum = await one(
    'SELECT COALESCE(SUM(delta),0)::int AS s FROM "LedgerTxn" WHERE "accountId" = $1',
    [accId]
  );
  ok("баланс консистентен с ledger (Σdelta = balance)", balFinal === (ledgerSum?.s ?? -999), `bal=${balFinal} Σ=${ledgerSum?.s}`);

  /* === G. награда за UTM-переходы === */
  const ownerAccId = `econ-owner-${Date.now()}`;
  /* зачистка хвостов прошлых прогонов (в т.ч. убитых по таймауту) */
  await q(
    'DELETE FROM "LedgerTxn" WHERE "accountId" IN (SELECT id FROM "Account" WHERE id LIKE $1 OR wallet = $2)',
    ["econ-owner-%", OWNER_WALLET]
  );
  await q('DELETE FROM "UtmClick" WHERE "ownerCode" = $1', [OWNER_CODE]);
  await q('DELETE FROM "ReferralProfile" WHERE code = $1 OR wallet = $2', [OWNER_CODE, OWNER_WALLET]);
  await q('DELETE FROM "Account" WHERE id LIKE $1 OR wallet = $2', ["econ-owner-%", OWNER_WALLET]);
  await q(
    'INSERT INTO "Account" (id, "passTier", "balanceCents", "createdAt", "updatedAt") VALUES ($1, 1, 0, now(), now()) ON CONFLICT (id) DO UPDATE SET "passTier" = 1, "balanceCents" = 0, "updatedAt" = now()',
    [ownerAccId]
  );
  cleanup.accounts.push(ownerAccId);
  await q(
    'INSERT INTO "ReferralProfile" (wallet, code, "createdAt", "updatedAt") VALUES ($1, $2, now(), now()) ON CONFLICT (wallet) DO UPDATE SET code = $2, "updatedAt" = now()',
    [OWNER_WALLET, OWNER_CODE]
  );
  await q('UPDATE "Account" SET wallet = $1 WHERE id = $2', [OWNER_WALLET, ownerAccId]);
  cleanup.refProfiles.push(OWNER_CODE);

  const Visitor = makeClient("utm-visitor", "-visitor7");
  const r1 = await Visitor("GET", `/r/${CLIP}?ref=${OWNER_CODE}`);
  ok("UTM-редирект работает", r1.status === 302 || r1.status === 200, `status=${r1.status}`);
  const utmRow = await one(
    'SELECT COUNT(*)::int AS n FROM "UtmClick" WHERE "ownerCode" = $1 AND "targetId" = $2',
    [OWNER_CODE, CLIP]
  );
  ok("UtmClick записан", (utmRow?.n ?? 0) >= 1, `rows=${utmRow?.n}`);
  cleanup.utmClicks.push(`${OWNER_CODE}:${CLIP}`);
  const utmReward = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE kind = \'utm_reward\' AND "accountId" = $1',
    [ownerAccId]
  );
  ok("владельцу ссылки начислена utm_reward", (utmReward?.n ?? 0) === 1, `rows=${utmReward?.n}`);

  const Visitor2 = makeClient("utm-visitor", "-visitor7"); // тот же UA → тот же hash
  await Visitor2("GET", `/r/${CLIP}?ref=${OWNER_CODE}`);
  const utmReward2 = await one(
    'SELECT COUNT(*)::int AS n FROM "LedgerTxn" WHERE kind = \'utm_reward\' AND "accountId" = $1',
    [ownerAccId]
  );
  ok("повторный тот же visitor → награды нет", (utmReward2?.n ?? 0) === 1, `rows=${utmReward2?.n}`);

  /* === G2. v8: Instagram-задание снято с производства (роут удалён) === */
  const igGone = await U("POST", "/api/reward/instagram");
  ok("IG claim → 404 (роут удалён)", igGone.status === 404, `status=${igGone.status}`);
  const igGoneGet = await U("GET", "/api/reward/instagram");
  ok("IG open → 404 (роут удалён)", igGoneGet.status === 404, `status=${igGoneGet.status}`);

  /* === H. живость === */
  const health = await U("GET", "/api/health");
  ok("health ok, db up", health.status === 200 && health.json.ok === true && health.json.db === "up");

  /* === I. v7: админ-сессия (секретный код) + Google status === */
  ok("ADMIN_SECRET читается из .env", Boolean(ADMIN_SECRET_ENV), `${ADMIN_SECRET_ENV?.slice(0, 8)}…`);

  const gStatus = await U("GET", "/api/auth/google/status");
  ok(
    "google status отвечает (boolean; true при настроенных ключах)",
    gStatus.status === 200 && typeof gStatus.json.enabled === "boolean",
    `enabled=${gStatus.json.enabled}`
  );

  const admNo = makeClient("admin-probe");
  const admNoState = await admNo("GET", "/api/admin/session");
  ok("админ-сессия до входа → authed false", admNoState.status === 200 && admNoState.json.authed === false);

  const admBad = await admNo("POST", "/api/admin/session", { code: "wrong-code-123" });
  ok("неверный код → 401", admBad.status === 401, `status=${admBad.status}`);

  const admOk = await admNo("POST", "/api/admin/session", { code: ADMIN_SECRET_ENV });
  ok("верный код → 200 + cookie", admOk.status === 200, `status=${admOk.status}`);

  const admState = await admNo("GET", "/api/admin/session");
  ok("админ-сессия после входа → authed true", admState.json.authed === true);

  const admRounds = await admNo("GET", "/api/admin/rounds");
  ok("панель: раунды видны по cookie-сессии", admRounds.status === 200 && Array.isArray(admRounds.json.rounds), `rounds=${admRounds.json.rounds?.length}`);

  const admNoKey = makeClient("admin-nosess");
  const admNoKeyRes = await admNoKey("GET", "/api/admin/rounds");
  ok("без сессии/ключа → 401", admNoKeyRes.status === 401);

  /* анти-брутфорс: после 5 неудачных попыток в минуту → 429 */
  let brute429 = false;
  for (let i = 0; i < 5; i++) {
    const r = await admNoKey("POST", "/api/admin/session", { code: `brute-${i}` });
    if (r.status === 429) brute429 = true;
  }
  const bruteLast = await admNoKey("POST", "/api/admin/session", { code: "brute-final" });
  ok("брутфорс кода → 429 (rate limit)", brute429 || bruteLast.status === 429, `last=${bruteLast.status}`);

  /* ---------- итог ---------- */
  console.log(`\n[economy-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- cleanup ---------- */
async function cleanupDb() {
  try {
    if (cleanup.accounts.length) {
      const ids = cleanup.accounts.filter(Boolean);
      for (const id of ids) {
        await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
        await q('DELETE FROM "DepositOrder" WHERE "accountId" = $1', [id]);
        /* v10: аккаунты регистрационные — EmailAuth уходит ДО Account (FK) */
        await q('DELETE FROM "EmailAuth" WHERE "accountId" = $1', [id]);
        await q('DELETE FROM "WaitlistEntry" WHERE "convertedAccountId" = $1', [id]);
        await q('DELETE FROM "Account" WHERE id = $1', [id]);
      }
    }
    for (const id of cleanup.deposits.filter(Boolean)) {
      await q('DELETE FROM "DepositOrder" WHERE id = $1', [id]);
    }
    for (const id of cleanup.bets.filter(Boolean)) {
      await q('DELETE FROM "Bet" WHERE id = $1', [id]);
    }
    for (const id of cleanup.rounds.filter(Boolean)) {
      await q('DELETE FROM "Bet" WHERE "roundId" = $1', [id]);
      await q('DELETE FROM "Round" WHERE id = $1', [id]);
    }
    for (const key of cleanup.utmClicks) {
      const [owner, target] = key.split(":");
      await q('DELETE FROM "UtmClick" WHERE "ownerCode" = $1 AND "targetId" = $2', [owner, target]);
    }
    for (const code of cleanup.refProfiles) {
      await q('DELETE FROM "ReferralProfile" WHERE code = $1', [code]);
    }
    await q("DELETE FROM \"TrackEvent\" WHERE name IN ('welcome_granted','daily_claimed','pass_granted','reward_click','utm_reward','bet_placed','bet_won','bet_lost','ref_converted','topup_open','predict_modal_open','watch_reward','guess_reward','video_reward','password_signin','password_signup','waitlist_signup','promo_redeemed')");
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  } finally {
    try {
      await q('DELETE FROM "PromoCode" WHERE batch = \'selftest\'', []);
    } catch {}
    await close();
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  await cleanupDb();
  console.log("[economy-selftest] cleanup done");
} else {
  const mock = await ensureMock();
  try {
    await run();
  } finally {
    await cleanupDb();
    if (mock) mock.kill();
  }
}
