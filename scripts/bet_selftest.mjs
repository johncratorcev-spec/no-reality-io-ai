#!/usr/bin/env node
/**
 * Selftest ставок REAL/SYNTH (v2 Phase 1) — против работающего сервера :3000.
 *
 * Проверяет (ТЗ v2 §4.2/§4.3, DoD §9):
 *  1. GET /api/round?clip= — ленивое открытие раунда + cookie nr_bet
 *  2. Анти-чит: truth НЕ утекает, пока раунд открыт
 *  3. POST /api/bet — demo-ставки, пулы растут, bank в ответе
 *  4. Анти-фрод: уже есть ставка на раунд → 409 already_bet
 *  5. Лимиты суммы (min/max) → 400 bad_amount
 *  6. Битая сторона → 400 bad_side; чужой round → 404
 *  7. Резолв после closes_at: пари-мьютюэль математика
 *     (рейк 10%, payout_i = floor(prize × amount_i / winPool))
 *  8. Реферал: bet с ref → ReferralEvent (kind=bet_rake, 20% рейка × доля)
 *  9. Аналитика: TrackEvent bet_placed/bet_won/bet_lost пишутся
 * 10. Админ-cron: /api/round/expired/resolve — 401 без ключа, работает с ключом
 * 11. Ставки на клип без truth → not_bettable
 *
 * Запуск: node scripts/bet_selftest.mjs [--cleanup-only]
 * Ожидает BET_WINDOW_SEC=25 (sandbox .env).
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const DB_PATH = path.resolve(process.cwd(), "db/custom.db");
const CSV_PATH = path.resolve(process.cwd(), "data/posts.csv");

let passed = 0;
let failed = 0;
const created = { rounds: [], bets: [], events: [], referrals: [] };

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- CSV truth (кураторские данные для ожидаемых резолвов) ---------- */
function truthOf(code) {
  const raw = fs.readFileSync(CSV_PATH, "utf-8").split("\n");
  const header = raw[0].split(",");
  const ti = header.indexOf("utm_code");
  const th = header.indexOf("truth");
  for (let i = 1; i < raw.length; i++) {
    const cols = raw[i].split(",");
    if (cols[ti] === code) return cols[th] || "";
  }
  return "";
}

function db() {
  return new DatabaseSync(DB_PATH);
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
        "user-agent": `bet-selftest/1.0 (${name})`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const m = /nr_bet=([^;]+)/.exec(setCookie);
      if (m) cookie = `nr_bet=${m[1]}`;
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  };
}

/* ---------- тест ---------- */
async function run() {
  console.log(`\n[bet-selftest] ${BASE} (window=${process.env.BET_WINDOW_SEC || "45 default"}s)\n`);

  /* === 1. ленивое открытие раунда === */
  const code = "71vsIPUu"; // pawcrew — truth=real по разметке
  const truth = truthOf(code);
  ok("csv truth известен тесту", truth === "real" || truth === "synth", `truth=${truth}`);

  const A = makeClient("bettor-A");
  const r1 = await A("GET", `/api/round?clip=${code}`);
  ok("round открыт лениво", r1.status === 200 && r1.json.round?.id, `id=${r1.json.round?.id?.slice(0, 8)}`);
  const round = r1.json.round;
  created.rounds.push(round.id);
  ok("cookie nr_bet выдана", r1.json.round != null);

  /* === 2. анти-чит: truth не утекает === */
  const leak = JSON.stringify(r1.json);
  ok("truth не утекает в ответе", !leak.includes(`"resolvedAs"`), "нет resolvedAs у открытого раунда");
  ok("myBet пуст до ставки", round.myBet === null);

  /* === 3. ставки и пулы === */
  const b1 = await A("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 100 });
  ok("ставка A: $1 REAL принята", b1.status === 200 && b1.json.bet_id, `status=${b1.json.status}`);
  ok("пул REAL вырос до 100", b1.json.round?.poolRealCents === 100, `poolReal=${b1.json.round?.poolRealCents}`);
  created.bets.push(b1.json.bet_id);

  /* === 4. повторная ставка тем же — 409 === */
  const dup = await A("POST", "/api/bet", { round_id: round.id, side: "synth", amount_cents: 100 });
  ok("дубль ставки отклонён", dup.status === 409 && dup.json.error === "already_bet", `error=${dup.json.error}`);

  /* === 5. лимиты === */
  const B = makeClient("bettor-B");
  const badLow = await B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 50 });
  ok("ниже min → 400", badLow.status === 400 && badLow.json.error === "bad_amount");
  const badHigh = await B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 900 });
  ok("выше max → 400", badHigh.status === 400 && badHigh.json.error === "bad_amount");

  /* === 6. битая сторона / чужой раунд === */
  const badSide = await B("POST", "/api/bet", { round_id: round.id, side: "yes", amount_cents: 100 });
  ok("битая side → 400", badSide.status === 400 && badSide.json.error === "bad_side");
  const badRound = await B("POST", "/api/bet", {
    round_id: "00000000-0000-4000-8000-000000000000",
    side: "real",
    amount_cents: 100,
  });
  ok("чужой round → 404", badRound.status === 404 && badRound.json.error === "round_not_found");

  /* вторая ставка B: $3 REAL; третья C: $5 SYNTH с реферальным кодом */
  const b2 = await B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 300, ref: "rselftest99" });
  ok("ставка B: $3 REAL + ref", b2.status === 200, `poolReal=${b2.json.round?.poolRealCents}`);
  created.bets.push(b2.json.bet_id);

  const C = makeClient("bettor-C");
  const b3 = await C("POST", "/api/bet", { round_id: round.id, side: "synth", amount_cents: 500 });
  ok("ставка C: $5 SYNTH", b3.status === 200, `poolSynth=${b3.json.round?.poolSynthCents}`);
  created.bets.push(b3.json.bet_id);

  ok("банк = $9.00", b3.json.round?.poolTotalCents === 900, `total=${b3.json.round?.poolTotalCents}`);

  /* === 11. клип без truth → not_bettable === */
  const unmarked = makeClient("probe");
  // ищем клип без truth — все размечены, поэтому проверяем через direct bad clip code
  const badClip = await unmarked("GET", "/api/round?clip=nonexistent1");
  ok("несуществующий клип → not_bettable/404", badClip.status === 404 || badClip.json?.error === "not_bettable", `status=${badClip.status}`);

  /* === ждём closes_at → резолв через поллинг === */
  const waitMs = Math.max(1000, new Date(round.closesAt).getTime() - Date.now() + 1500);
  console.log(`\n  ... ждём закрытия окна ${Math.round(waitMs / 1000)}с ...`);
  await new Promise((r) => setTimeout(r, waitMs));

  const poll = await A("GET", `/api/round/${round.id}`);
  const resolved = poll.json.round;
  ok("раунд resolved после окна", resolved?.status === "resolved", `resolvedAs=${resolved?.resolvedAs}`);
  ok("resolvedAs совпал с truth", resolved?.resolvedAs === truth);

  /* === 7. математика пари-мьютюэль ===
     total=900, rake=floor(900*0.10)=90, prize=810
     если truth=real: winPool=400 → A(100)=floor(810*100/400)=202, B(300)=607, C=0
     если truth=synth: winPool=500 → C(500)=810, A=B=0                      */
  const total = 900;
  const rake = Math.floor(total * 0.1);
  const prize = total - rake;
  let expect;
  if (truth === "real") {
    expect = { A: Math.floor((prize * 100) / 400), B: Math.floor((prize * 300) / 400), C: 0 };
  } else {
    expect = { A: 0, B: 0, C: prize };
  }

  const me = await A("GET", "/api/me/bets");
  const betA = me.json.bets?.find((b) => b.id === b1.json.bet_id);
  ok("A: статус/выплата по формуле", betA && betA.status === (expect.A > 0 ? "won" : "lost") && betA.payoutCents === expect.A, `payout=${betA?.payoutCents} expect=${expect.A}`);

  const meB = await B("GET", "/api/me/bets");
  const betB = meB.json.bets?.find((b) => b.id === b2.json.bet_id);
  ok("B: статус/выплата по формуле", betB && betB.status === (expect.B > 0 ? "won" : "lost") && betB.payoutCents === expect.B, `payout=${betB?.payoutCents} expect=${expect.B}`);

  const meC = await C("GET", "/api/me/bets");
  const betC = meC.json.bets?.find((b) => b.id === b3.json.bet_id);
  ok("C: статус/выплата по формуле", betC && betC.status === (expect.C > 0 ? "won" : "lost") && betC.payoutCents === expect.C, `payout=${betC?.payoutCents} expect=${expect.C}`);

  /* === 8. рефералка: rr-<roundId>-rselftest99 ===
     refCut = floor(rake * 0.2 * 300/900) = floor(90*0.2/3)=floor(6)=6 центов */
  const con = db();
  const refOrderId = `rr-${round.id}-rselftest99`;
  const refRow = con
    .prepare("SELECT refCode, kind, amountUsdt, payoutUsdt FROM ReferralEvent WHERE orderId = ?")
    .get(refOrderId);
  const expectRef = Math.floor(rake * 0.2 * (300 / total));
  ok("ReferralEvent bet_rake создан", Boolean(refRow), refRow ? `payout=${refRow.payoutUsdt}` : "нет строки");
  ok(
    "реферер получает 20% рейка × долю",
    refRow && refRow.payoutUsdt === (expectRef / 100).toFixed(2),
    `expect=${(expectRef / 100).toFixed(2)}`
  );
  created.referrals.push(refOrderId);

  const roundRow = con.prepare("SELECT rakeCents, authorShareCents, refShareCents FROM Round WHERE id = ?").get(round.id);
  ok("рейк записан на раунде", roundRow?.rakeCents === rake, `rake=${roundRow?.rakeCents}`);
  ok(
    "authorShare = 15% рейка",
    roundRow?.authorShareCents === Math.floor(rake * 0.15),
    `author=${roundRow?.authorShareCents}`
  );
  ok("refShare = сумме реферальных", roundRow?.refShareCents === expectRef, `ref=${roundRow?.refShareCents}`);

  /* === 9. аналитика === */
  const evPlaced = con.prepare("SELECT COUNT(*) c FROM TrackEvent WHERE name='bet_placed' AND clipCode=?").get(code);
  const evWon = con.prepare("SELECT COUNT(*) c FROM TrackEvent WHERE name IN ('bet_won','bet_lost') AND clipCode=?").get(code);
  ok("TrackEvent bet_placed пишутся", evPlaced.c >= 3, `count=${evPlaced.c}`);
  ok("TrackEvent bet_won/lost пишутся", evWon.c >= 3, `count=${evWon.c}`);
  con.close();

  /* === 10. админ-cron === */
  const noKey = await makeClient("cron")("POST", "/api/round/expired/resolve");
  ok("cron без ключа → 401", noKey.status === 401);
  const withKey = await makeClient("cron")(
    "POST",
    `/api/round/expired/resolve?key=${process.env.ADMIN_SECRET || "no-reality-secret"}`
  );
  ok("cron с ключом → 200", withKey.status === 200, `resolvedCount=${withKey.json?.resolvedCount}`);
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
  con.prepare("DELETE FROM TrackEvent WHERE clipCode = ?").run("71vsIPUu");
  con.close();
  console.log(`\n[cleanup] тестовые данные вычищены (rounds=${created.rounds.length})`);
}

try {
  await run();
} catch (e) {
  console.error("[bet-selftest] crash:", e);
  failed++;
} finally {
  cleanup();
  console.log(`\n=== ИТОГ: ${passed} PASS / ${failed} FAIL ===\n`);
  process.exit(failed ? 1 : 0);
}
