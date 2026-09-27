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
 *     7. link-wallet → passTier 1
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
 *  G. награда за UTM-переходы:
 *    18. GET /r/<clip>?ref=<owner> (новый visitor) → UtmClick + utm_reward
 *    19. повторный заход того же visitor → дубля нет
 *  H. сервис жив:
 *    20. GET /api/health → ok, db:up
 *
 * Запуск: node scripts/economy_selftest.mjs
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const DB_PATH = path.resolve(process.cwd(), "db/custom.db");
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

function db() {
  return new DatabaseSync(DB_PATH);
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
  console.log(`\n[economy-selftest] ${BASE} — внутренняя экономика (v6)\n`);

  /* === A. мгновенный аккаунт === */
  const U = makeClient("player");
  const me1 = await U("GET", "/api/me");
  const accId = me1.json.account?.accountId;
  ok("аккаунт создан мгновенно", me1.status === 200 && Boolean(accId), accId?.slice(0, 8));
  ok(
    "welcome-бонус начислен",
    me1.json.account?.balanceCents === 300,
    `balance=${me1.json.account?.balanceCents}`
  );
  const me2 = await U("GET", "/api/me");
  ok("повторный GET идемпотентен", me2.json.account?.balanceCents === 300, `balance=${me2.json.account?.balanceCents}`);
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
  const cb = await Bot("POST", "/api/reward/click", { target: "featured:econ-bot" });
  ok("бот-UA → отклонён", cb.json.credited === false && cb.json.reason === "bot", cb.json.reason);

  /* === C. NR PASS === */
  const W = makeClient("wallet-user");
  const link = await W("POST", "/api/me/link-wallet", { wallet: "0xecontest1111111111111111111111111111aaa1" });
  ok("кошелёк привязан → PASS", link.json.account?.isPass === true, `passTier=${link.json.account?.passTier}`);
  cleanup.accounts.push(link.json.account?.accountId);
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
  const depRow = db()
    .prepare("SELECT id, orderId, status, amountCents, accountId FROM DepositOrder WHERE paymentId = ?")
    .get(depUuid);
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
  const depPaid = db().prepare("SELECT status FROM DepositOrder WHERE id = ?").get(depRow.id);
  ok("DepositOrder paid", depPaid?.status === "paid");

  const dupDep = await webhook2328(
    { uuid: depUuid, order_id: depRow.orderId, payment_status: "paid", txid: "mock-tx-d1", amount: "5.00", currency: "USDT" },
    PAYMENT_KEY
  );
  ok("повторный webhook → 200", dupDep === 200);
  const ledgerDep = db()
    .prepare("SELECT COUNT(*) AS n FROM LedgerTxn WHERE refKey = ? AND kind = 'deposit'")
    .get(`deposit:${depUuid}`);
  ok("двойного зачисления нет (refKey unique)", (ledgerDep?.n ?? 0) === 1, `rows=${ledgerDep?.n}`);

  /* === E. ставка с баланса === */
  const roundOpen = await U("GET", `/api/round?clip=${CLIP}`);
  const round = roundOpen.json.round;
  ok("раунд открыт", roundOpen.status === 200 && Boolean(round?.id), round?.id?.slice(0, 8));
  cleanup.rounds.push(round?.id);

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
  await Poor("GET", "/api/me");
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

  /* === F. резолв → выплата на баланс === */
  console.log("  … ждём closesAt раунда (окно 45с в sandbox) …");
  await new Promise((r) => setTimeout(r, 50_000));
  const roundAfter = await U("GET", `/api/round/${round.id}`);
  const rv = roundAfter.json.round;
  ok("раунд resolved", rv?.status === "resolved", `as=${rv?.resolvedAs}`);
  const betRow = db().prepare("SELECT id, status, payoutCents, mode, accountId FROM Bet WHERE id = ?").get(bet1.json.bet_id);
  ok("ставка closed по вердикту", betRow?.status === "won" || betRow?.status === "lost", `truth-side=${rv?.resolvedAs}, bet=real`);
  const payTxn = db()
    .prepare("SELECT COUNT(*) AS n FROM LedgerTxn WHERE refKey = ? AND kind = 'bet_payout'")
    .get(`betpay:${bet1.json.bet_id}`);
  if (betRow?.status === "won") {
    ok("выплата пришла на баланс (LedgerTxn bet_payout)", (payTxn?.n ?? 0) === 1 && (betRow?.payoutCents ?? 0) > 0, `payout=${betRow?.payoutCents}`);
  } else {
    ok("проигрыш: выплаты нет — корректно", (payTxn?.n ?? 0) === 0);
  }
  const balFinal = await balOf();
  ok("баланс консистентен с ledger", balFinal === bet1.json.balance_cents + (betRow?.status === "won" ? (betRow?.payoutCents ?? 0) : 0), `final=${balFinal}`);

  /* === G. награда за UTM-переходы === */
  const d6 = db();
  d6
    .prepare("INSERT OR REPLACE INTO Account (id, passTier, balanceCents, createdAt, updatedAt) VALUES (?, 1, 0, ?, ?)")
    .run(`econ-owner-${Date.now()}`, new Date().toISOString(), new Date().toISOString());
  const ownerAccId = d6
    .prepare("SELECT id FROM Account WHERE id LIKE 'econ-owner-%' ORDER BY createdAt DESC LIMIT 1")
    .get()?.id;
  cleanup.accounts.push(ownerAccId);
  d6
    .prepare("INSERT OR REPLACE INTO ReferralProfile (wallet, code, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
    .run(OWNER_WALLET, OWNER_CODE, new Date().toISOString(), new Date().toISOString());
  d6.prepare("UPDATE Account SET wallet = ? WHERE id = ?").run(OWNER_WALLET, ownerAccId);
  cleanup.refProfiles.push(OWNER_CODE);

  const Visitor = makeClient("utm-visitor", "-visitor7");
  const r1 = await Visitor("GET", `/r/${CLIP}?ref=${OWNER_CODE}`);
  ok("UTM-редирект работает", r1.status === 302 || r1.status === 200, `status=${r1.status}`);
  const utmRow = d6
    .prepare("SELECT COUNT(*) AS n FROM UtmClick WHERE ownerCode = ? AND targetId = ?")
    .get(OWNER_CODE, CLIP);
  ok("UtmClick записан", (utmRow?.n ?? 0) >= 1, `rows=${utmRow?.n}`);
  cleanup.utmClicks.push(`${OWNER_CODE}:${CLIP}`);
  const utmReward = d6
    .prepare("SELECT COUNT(*) AS n FROM LedgerTxn WHERE kind = 'utm_reward' AND accountId = ?")
    .get(ownerAccId);
  ok("владельцу ссылки начислена utm_reward", (utmReward?.n ?? 0) === 1, `rows=${utmReward?.n}`);

  const Visitor2 = makeClient("utm-visitor", "-visitor7"); // тот же UA → тот же hash
  await Visitor2("GET", `/r/${CLIP}?ref=${OWNER_CODE}`);
  const utmReward2 = d6
    .prepare("SELECT COUNT(*) AS n FROM LedgerTxn WHERE kind = 'utm_reward' AND accountId = ?")
    .get(ownerAccId);
  ok("повторный тот же visitor → награды нет", (utmReward2?.n ?? 0) === 1, `rows=${utmReward2?.n}`);
  d6.close();

  /* === H. живость === */
  const health = await U("GET", "/api/health");
  ok("health ok, db up", health.status === 200 && health.json.ok === true && health.json.db === "up");

  /* ---------- итог ---------- */
  console.log(`\n[economy-selftest] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

/* ---------- cleanup ---------- */
function cleanupDb() {
  try {
    const d = db();
    if (cleanup.accounts.length) {
      const ids = cleanup.accounts.filter(Boolean);
      for (const id of ids) {
        d.prepare("DELETE FROM LedgerTxn WHERE accountId = ?").run(id);
        d.prepare("DELETE FROM DepositOrder WHERE accountId = ?").run(id);
        d.prepare("DELETE FROM Account WHERE id = ?").run(id);
      }
    }
    for (const id of cleanup.deposits.filter(Boolean)) {
      d.prepare("DELETE FROM DepositOrder WHERE id = ?").run(id);
    }
    for (const id of cleanup.bets.filter(Boolean)) {
      d.prepare("DELETE FROM Bet WHERE id = ?").run(id);
    }
    for (const id of cleanup.rounds.filter(Boolean)) {
      d.prepare("DELETE FROM Bet WHERE roundId = ?").run(id);
      d.prepare("DELETE FROM Round WHERE id = ?").run(id);
    }
    for (const key of cleanup.utmClicks) {
      const [owner, target] = key.split(":");
      d.prepare("DELETE FROM UtmClick WHERE ownerCode = ? AND targetId = ?").run(owner, target);
    }
    for (const code of cleanup.refProfiles) {
      d.prepare("DELETE FROM ReferralProfile WHERE code = ?").run(code);
    }
    d.prepare("DELETE FROM TrackEvent WHERE name IN ('welcome_granted','daily_claimed','pass_granted','reward_click','utm_reward','bet_placed','bet_won','bet_lost','ref_converted','topup_open','predict_modal_open')").run();
    d.close();
  } catch (e) {
    console.warn("[cleanup] skip:", e instanceof Error ? e.message : e);
  }
}

const isCleanupOnly = process.argv.includes("--cleanup-only");
if (isCleanupOnly) {
  cleanupDb();
  console.log("[economy-selftest] cleanup done");
} else {
  const mock = await ensureMock();
  try {
    await run();
  } finally {
    cleanupDb();
    if (mock) mock.kill();
  }
}
