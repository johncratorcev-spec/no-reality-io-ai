#!/usr/bin/env node
/**
 * Selftest ПОЛНОГО ДЕНЕЖНОГО ЦИКЛА на 2328.io — против работающего
 * dev-сервера :3000, поднятого с env:
 *
 *   TWOTHOUSAND328_API_BASE=http://127.0.0.1:9999/api
 *   TWOTHOUSAND328_PAYMENT_API_KEY=test-payment-key
 *   TWOTHOUSAND328_PAYOUT_API_KEY=test-payout-key
 *   TWOTHOUSAND328_PROJECT_UUID=test-project-uuid
 *   FEATURE_BET_DEMO=0            (только crypto-ставки)
 *   BET_WINDOW_SEC=10
 *
 * Проверяет:
 *  1. crypto-ставка: инвойс 2328 (мок), статус pending, payUrl
 *  2. webhook с битой подписью → 401, ставка остаётся pending
 *  3. webhook payment paid (верная HMAC) → ставка active, пул вырос
 *  4. резолв после окна: bet won, payout по пари-мьютюэль (одинокий
 *     победитель получает prize = total − rake)
 *  5. рефералка: ReferralEvent rr-<round>-<ref> (20% рейка × долю) даже
 *     для проигравшей ставки — атрибуция по refCode
 *  6. GET /api/me/cashout: claimable, payoutsEnabled
 *  7. POST /api/me/cashout: битый кошелёк → 400; T-кошелёк → ok
 *  8. БД: bet.claimed=1, payoutOrderId bw-*; повторный кэшаут → 409
 *  9. payout-webhook failed → claimed снят, деньги снова claimable
 * 10. payout-webhook completed → остаётся claimed (идемпотентно)
 * 11. /api/me/bets отдаёт claimed/claimable-сводку (позиции)
 *
 * Запуск: node scripts/cashout_selftest.mjs
 * Мок 2328: scripts/mock-2328.mjs (:9999) — поднимается автоматически.
 */

import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const DB_PATH = path.resolve(process.cwd(), "db/custom.db");
const PAYMENT_KEY = "test-payment-key";
const PAYOUT_KEY = "test-payout-key";

let passed = 0;
let failed = 0;
const created = { rounds: [], bets: [], referrals: [], clip: "71vsIPUu" };

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

/* ---------- cookie-jar fetch ---------- */
function makeClient(name) {
  let cookie = "";
  return async function api(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        "user-agent": `cashout-selftest/1.0 (${name})`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.getSetCookie?.() || [res.headers.get("set-cookie") || ""];
    for (const c of sc) {
      const m = /nr_bet=([^;]+)/.exec(c || "");
      if (m) cookie = `nr_bet=${m[1]}`;
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
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
  console.log(`\n[cashout-selftest] ${BASE} — полный цикл 2328.io\n`);

  const A = makeClient("bettor-A");
  const D = makeClient("bettor-D");

  /* === 1. crypto-ставка === */
  const r1 = await A("GET", `/api/round?clip=${created.clip}`);
  ok("round открыт", r1.status === 200 && r1.json.round?.id, `id=${r1.json.round?.id?.slice(0, 8)}`);
  const round = r1.json.round;
  created.rounds.push(round.id);

  const b1 = await A("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 100 });
  ok("crypto-ставка принята", b1.status === 200 && b1.json.bet_id, `mode=${b1.json.mode}`);
  ok("ставка pending до оплаты", b1.json.status === "pending");
  ok("pay_url от мока 2328", typeof b1.json.pay_url === "string" && b1.json.pay_url.includes("/pay/"), b1.json.pay_url);
  const paymentUuid = (b1.json.pay_url || "").split("/pay/")[1] || "";
  created.bets.push(b1.json.bet_id);
  const orderRow0 = db().prepare("SELECT orderId FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("orderId rb-* записан", String(orderRow0?.orderId || "").startsWith("rb-"), orderRow0?.orderId);

  const betRow0 = db().prepare("SELECT status FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("в пуле до оплаты ставки нет", betRow0?.status === "pending");

  /* === 2. битая подпись → 401 === */
  const badSign = await webhook2328(
    {
      uuid: paymentUuid,
      order_id: `rb-${b1.json.bet_id}`,
      payment_status: "paid",
      txid: "mock-tx-1",
      amount: "1.00",
      currency: "USDT",
    },
    "wrong-key-XXXX"
  );
  ok("webhook с битой подписью → 401", badSign === 401);
  const stillPending = db().prepare("SELECT status FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("после 401 ставка осталась pending", stillPending?.status === "pending");

  /* === 3. верная подпись → active + пул === */
  const good = await webhook2328(
    {
      uuid: paymentUuid,
      order_id: `rb-${b1.json.bet_id}`,
      payment_status: "paid",
      txid: "mock-tx-1",
      amount: "1.00",
      currency: "USDT",
    },
    PAYMENT_KEY
  );
  ok("payment webhook принят", good === 200);
  const activeRow = db().prepare("SELECT status FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("ставка active после оплаты", activeRow?.status === "active");

  /* вторая ставка: D, $5 SYNTH, с реферальным кодом (проиграет) */
  const b2 = await D("POST", "/api/bet", {
    round_id: round.id,
    side: "synth",
    amount_cents: 500,
    ref: "rselftest99",
  });
  ok("crypto-ставка D с рефом принята", b2.status === 200 && b2.json.bet_id, `mode=${b2.json.mode}`);
  created.bets.push(b2.json.bet_id);
  const uuidD = (b2.json.pay_url || "").split("/pay/")[1] || "";
  await webhook2328(
    {
      uuid: uuidD,
      order_id: `rb-${b2.json.bet_id}`,
      payment_status: "paid",
      txid: "mock-tx-2",
      amount: "5.00",
      currency: "USDT",
    },
    PAYMENT_KEY
  );
  const poolRow = db().prepare("SELECT poolRealCents, poolSynthCents FROM Round WHERE id = ?").get(round.id);
  ok("пулы после оплаты: 100/500", poolRow?.poolRealCents === 100 && poolRow?.poolSynthCents === 500, `real=${poolRow?.poolRealCents} synth=${poolRow?.poolSynthCents}`);

  /* === 4. резолв === */
  const waitMs = Math.max(1000, new Date(round.closesAt).getTime() - Date.now() + 1500);
  console.log(`\n  ... ждём закрытия окна ${Math.round(waitMs / 1000)}с ...`);
  await new Promise((r) => setTimeout(r, waitMs));

  const poll = await A("GET", `/api/round/${round.id}`);
  const resolved = poll.json.round;
  ok("раунд resolved", resolved?.status === "resolved", `as=${resolved?.resolvedAs}`);

  /* A один в REAL: payout = prize = 600 − 60 = 540 */
  const meA = await A("GET", "/api/me/bets");
  const betA = meA.json.bets?.find((b) => b.id === b1.json.bet_id);
  const expectA = Math.floor((600 - 60) * 100 / 100);
  ok("A: won с payout prize", betA?.status === "won" && betA.payoutCents === expectA, `payout=${betA?.payoutCents} expect=${expectA}`);

  const meD = await D("GET", "/api/me/bets");
  const betD = meD.json.bets?.find((b) => b.id === b2.json.bet_id);
  ok("D: lost, payout=0", betD?.status === "lost" && betD.payoutCents === 0, `status=${betD?.status} payout=${betD?.payoutCents}`);

  /* === 5. рефералка === */
  const refRow = db()
    .prepare("SELECT payoutUsdt, amountUsdt FROM ReferralEvent WHERE orderId = ?")
    .get(`rr-${round.id}-rselftest99`);
  const expectRef = Math.floor(60 * 0.2 * (500 / 600));
  ok(
    "ReferralEvent bet_rake (реф проигравшего тоже атрибутируется)",
    Boolean(refRow) && refRow.payoutUsdt === (expectRef / 100).toFixed(2),
    `payout=${refRow?.payoutUsdt} expect=${(expectRef / 100).toFixed(2)}`
  );
  created.referrals.push(`rr-${round.id}-rselftest99`);

  /* === 6. cashout-сводка === */
  const sum1 = await A("GET", "/api/me/cashout");
  ok("claimable = 540", sum1.json.claimableCents === expectA, `claimable=${sum1.json.claimableCents}`);
  ok("payoutsEnabled (ключи мока)", sum1.json.payoutsEnabled === true);

  /* === 7. кэшаут === */
  const badWallet = await A("POST", "/api/me/cashout", { wallet: "wallet123" });
  ok("битый кошелёк → 400 bad_wallet", badWallet.status === 400 && badWallet.json.code === "bad_wallet");

  const W = "TQn9Y2khDD95J42FQtQTdwVVRZq5NmVLRy";
  const co = await A("POST", "/api/me/cashout", { wallet: W });
  ok("кэшаут ok", co.status === 200 && co.json.ok === true, `amount=${co.json.amountCents}`);
  ok("сеть определена TRC20", co.json.network === "TRX-TRC20", co.json.network);
  ok("сумма кэшаута = claimable", co.json.amountCents === expectA);

  /* === 8. БД: claimed + повторный кэшаут === */
  const claimedRow = db()
    .prepare("SELECT claimed, payoutOrderId FROM Bet WHERE id = ?")
    .get(b1.json.bet_id);
  ok("bet.claimed=1", claimedRow?.claimed === 1, `payoutOrderId=${claimedRow?.payoutOrderId}`);
  ok("payoutOrderId bw-*", String(claimedRow?.payoutOrderId || "").startsWith("bw-"));

  const again = await A("POST", "/api/me/cashout", { wallet: W });
  ok("повторный кэшаут → 409", again.status === 409);

  const sum2 = await A("GET", "/api/me/cashout");
  ok("после кэшаута claimable=0", sum2.json.claimableCents === 0, `claimable=${sum2.json.claimableCents}`);
  ok("claimedTotal учтён", sum2.json.claimedTotalCents === expectA, `total=${sum2.json.claimedTotalCents}`);

  /* === 9. payout-webhook failed → unclaim === */
  const bwId = String(claimedRow?.payoutOrderId);
  const failedSt = await webhook2328(
    {
      uuid: "mock-payout-uuid-1",
      order_id: bwId,
      status: "failed",
      txid: null,
      error_type: "insufficient_balance",
      to_address: W,
      amount: (expectA / 100).toFixed(2),
      currency: "USDT",
    },
    PAYOUT_KEY
  );
  ok("payout failed webhook принят", failedSt === 200);
  const unclaimedRow = db().prepare("SELECT claimed, payoutOrderId FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("claimed снят после failed", unclaimedRow?.claimed === 0);

  const sum3 = await A("GET", "/api/me/cashout");
  ok("claimable вернулся к 540", sum3.json.claimableCents === expectA, `claimable=${sum3.json.claimableCents}`);

  /* повторный кэшаут после отката */
  const co2 = await A("POST", "/api/me/cashout", { wallet: W });
  ok("повторный кэшаут после отката ok", co2.status === 200 && co2.json.amountCents === expectA, `new bw-${co2.json.cashoutId}`);
  const reClaimed = db().prepare("SELECT payoutOrderId, claimed FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("новый payoutOrderId", reClaimed?.claimed === 1 && reClaimed.payoutOrderId !== bwId);

  /* === 10. completed → остаётся claimed === */
  const doneSt = await webhook2328(
    {
      uuid: "mock-payout-uuid-2",
      order_id: reClaimed?.payoutOrderId,
      status: "completed",
      txid: "mock-tx-final",
      error_type: null,
      to_address: W,
      amount: (expectA / 100).toFixed(2),
      currency: "USDT",
    },
    PAYOUT_KEY
  );
  ok("payout completed webhook принят", doneSt === 200);
  const finalRow = db().prepare("SELECT claimed FROM Bet WHERE id = ?").get(b1.json.bet_id);
  ok("после completed claimed=1", finalRow?.claimed === 1);

  /* === 11. позиции в /api/me/bets === */
  const pos = await A("GET", "/api/me/bets");
  ok("позиции: claimed-флаг в списке", typeof pos.json.bets?.[0]?.claimed === "boolean");
  ok("позиции: payoutsEnabled в сводке", pos.json.payoutsEnabled === true);
  ok("позиции: claimable обнулился", pos.json.claimableCents === 0);

  /* cleanup audit: money-op логи уже в stdout */
}

/* ---------- очистка ---------- */
function cleanup() {
  const con = db();
  const del = (table, col, ids) => {
    if (!ids.length) return;
    const q = con.prepare(`DELETE FROM ${table} WHERE ${col} = ?`);
    for (const id of ids) q.run(id);
  };
  del("ReferralEvent", "orderId", created.referrals);
  del("Bet", "roundId", created.rounds);
  del("Round", "id", created.rounds);
  con.prepare("DELETE FROM TrackEvent WHERE clipCode = ?").run(created.clip);
  con.close();
  console.log(`\n[cleanup] тестовые данные вычищены (rounds=${created.rounds.length})`);
}

let mockChild = null;
try {
  mockChild = await ensureMock();
  await run();
} catch (e) {
  console.error("[cashout-selftest] crash:", e);
  failed++;
} finally {
  if (mockChild) mockChild.kill();
  cleanup();
  console.log(`\n=== ИТОГ: ${passed} PASS / ${failed} FAIL ===\n`);
  process.exit(failed ? 1 : 0);
}
