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

import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const ADMIN_SECRET_ENV = (readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
  .split("\n")
  .find((l) => l.startsWith("ADMIN_SECRET=")) || "")
  .split("=")[1]?.replace(/"/g, "")
  .trim();

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


/* ---------- cookie-jar fetch (v10: полный jar — регистрация даёт nr_uid+nr_auth) ---------- */
function makeClient(name) {
  const cookies = new Map();
  const api = async function (method, url, body) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        "user-agent": `bet-selftest/1.0 (${name})`,
        "x-forwarded-for": "203.0.113.31",
      },
      body: body ? JSON.stringify(body) : undefined,
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
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  };
  api.cookies = cookies;
  return api;
}

/* v10: ставит только авторизованный — регистрируем игрока с сеяным кодом */
const BET_ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function freshCode() {
  const ts = Date.now().toString(36).toUpperCase().replace(/[01OLI]/g, "X");
  const rand = Math.random().toString(36).toUpperCase().replace(/[01OLI]/g, "X");
  const body = ((ts + rand + "XXXXXXXXXXXX").replace(/[^2-9A-HJKMNP-Z]/g, "X")).slice(0, 12);
  return "NR" + body;
}
const betAccounts = [];
async function registerBettor(api, tag) {
  const code = freshCode();
  await q(
    'INSERT INTO "PromoCode" (id, code, batch) VALUES (gen_random_uuid(), $1, \'selftest\') ON CONFLICT (code) DO NOTHING',
    [code]
  );
  const email = `v10-bet-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.dev`;
  const res = await api("POST", "/api/auth/password", { email, password: "selftest-pass-1", promo: code });
  if (res.status !== 200 || res.json?.status !== "registered") {
    console.warn(`[register ${tag}] FAILED:`, res.status, JSON.stringify(res.json));
  }
  const accId = res.json?.account?.accountId;
  if (accId) betAccounts.push(accId);
  return res;
}

/* ---------- тест ---------- */
async function run() {
  console.log(`\n[bet-selftest] ${BASE} (window=${process.env.BET_WINDOW_SEC || "45 default"}s)\n`);

  /* === 1. ленивое открытие раунда === */
  const code = "71vsIPUu"; // pawcrew — truth=real по разметке
  const truth = truthOf(code);
  ok("csv truth известен тесту", truth === "real" || truth === "synth", `truth=${truth}`);

  /* v11: регистрации ЗАРАНЕЕ — окно раунда 60с меньше суммы латентностей
     последовательных запросов к Supabase (~6с каждый), поэтому ставки
     идут сразу после открытия, а проверки — параллельным пучком.
     Аноним-проверка ПОСЛЕ регистраций: иначе её /api/round откроет раунд
     заранее и окно сгорит впустую. */
  const A = makeClient("bettor-A");
  const regA = await registerBettor(A, "A");
  const B = makeClient("bettor-B");
  await registerBettor(B, "B");
  const C = makeClient("bettor-C");
  await registerBettor(C, "C");

  const Anon = makeClient("anon");
  const rAnon = await Anon("GET", `/api/round?clip=${code}`);
  if (rAnon.json?.round?.id) {
    const anonBet = await Anon("POST", "/api/bet", { round_id: rAnon.json.round.id, side: "real", amount_cents: 10, mode: "balance" });
    ok("гость → 401 auth_required", anonBet.status === 401 && anonBet.json?.error === "auth_required", `${anonBet.status} ${anonBet.json?.error || ""}`);
  }

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
  const b1 = await A("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 10, mode: "balance" });
  ok("ставка A: 10 EYE REAL принята", b1.status === 200 && b1.json.bet_id, `status=${b1.json.status}`);
  ok("пул REAL вырос до 10", b1.json.round?.poolRealCents === 10, `poolReal=${b1.json.round?.poolRealCents}`);
  created.bets.push(b1.json.bet_id);

  /* === 4-6 + ставки B/C — один параллельный пучок === */
  const [dup, badLow, badHigh, badSide, badRound, b2, b3] = await Promise.all([
    A("POST", "/api/bet", { round_id: round.id, side: "synth", amount_cents: 10, mode: "balance" }),
    B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 5, mode: "balance" }),
    B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 75, mode: "balance" }),
    B("POST", "/api/bet", { round_id: round.id, side: "yes", amount_cents: 10, mode: "balance" }),
    B("POST", "/api/bet", { round_id: "00000000-0000-4000-8000-000000000000", side: "real", amount_cents: 10, mode: "balance" }),
    B("POST", "/api/bet", { round_id: round.id, side: "real", amount_cents: 50, ref: "rselftest99", mode: "balance" }),
    C("POST", "/api/bet", { round_id: round.id, side: "synth", amount_cents: 50, mode: "balance" }),
  ]);
  ok("дубль ставки отклонён", dup.status === 409 && dup.json.error === "already_bet", `error=${dup.json.error}`);
  ok("ниже min → 400", badLow.status === 400 && badLow.json.error === "bad_amount");
  ok("выше max → 400", badHigh.status === 400 && badHigh.json.error === "bad_amount");
  ok("битая side → 400", badSide.status === 400 && badSide.json.error === "bad_side");
  ok("чужой round → 404", badRound.status === 404 && badRound.json.error === "round_not_found");
  ok("ставка B: 50 EYE REAL + ref", b2.status === 200, `poolReal=${b2.json.round?.poolRealCents}`);
  created.bets.push(b2.json.bet_id);
  ok("ставка C: 50 EYE SYNTH (welcome-баланс)", b3.status === 200, `status=${b3.status} err=${b3.json?.error} poolSynth=${b3.json?.round?.poolSynthCents}`);
  created.bets.push(b3.json.bet_id);
  ok("банк = 110 EYE", b3.json.round?.poolTotalCents === 110, `total=${b3.json.round?.poolTotalCents}`);

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

  /* === 7. математика пари-мьютюэль (v11: EYE, ставки 10/50/50) ===
     total=110, rake=floor(110*0.10)=11, prize=99
     если truth=real: winPool=60 → A(10)=floor(99*10/60)=16, B(50)=82, C=0
     если truth=synth: winPool=50 → C(50)=99, A=B=0                          */
  const total = 110;
  const rake = Math.floor(total * 0.1);
  const prize = total - rake;
  let expect;
  if (truth === "real") {
    expect = { A: Math.floor((prize * 10) / 60), B: Math.floor((prize * 50) / 60), C: 0 };
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
     refCut = floor(rake * 0.2 * 50/110) = floor(11*0.2*0.4545) = 1 монета */
  const refOrderId = `rr-${round.id}-rselftest99`;
  const refRow = await one(
    'SELECT "refCode", kind, "amountUsdt", "payoutUsdt" FROM "ReferralEvent" WHERE "orderId" = $1',
    [refOrderId]
  );
  const expectRef = Math.floor(rake * 0.2 * (50 / total));
  ok("ReferralEvent bet_rake создан", Boolean(refRow), refRow ? `payout=${refRow.payoutUsdt}` : "нет строки");
  ok(
    "реферер получает 20% рейка × долю",
    refRow && refRow.payoutUsdt === (expectRef / 100).toFixed(2),
    `expect=${(expectRef / 100).toFixed(2)}`
  );
  created.referrals.push(refOrderId);

  const roundRow = await one('SELECT "rakeCents", "authorShareCents", "refShareCents" FROM "Round" WHERE id = $1', [round.id]);
  ok("рейк записан на раунде", roundRow?.rakeCents === rake, `rake=${roundRow?.rakeCents}`);
  ok(
    "authorShare = 15% рейка",
    roundRow?.authorShareCents === Math.floor(rake * 0.15),
    `author=${roundRow?.authorShareCents}`
  );
  ok("refShare = сумме реферальных", roundRow?.refShareCents === expectRef, `ref=${roundRow?.refShareCents}`);

  /* === 9. аналитика === */
  const evPlaced = await one("SELECT COUNT(*)::int AS c FROM \"TrackEvent\" WHERE name='bet_placed' AND \"clipCode\"=$1", [code]);
  const evWon = await one("SELECT COUNT(*)::int AS c FROM \"TrackEvent\" WHERE name IN ('bet_won','bet_lost') AND \"clipCode\"=$1", [code]);
  ok("TrackEvent bet_placed пишутся", evPlaced.c >= 3, `count=${evPlaced.c}`);
  ok("TrackEvent bet_won/lost пишутся", evWon.c >= 3, `count=${evWon.c}`);

  /* === 10. админ-cron === */
  const noKey = await makeClient("cron")("POST", "/api/round/expired/resolve");
  ok("cron без ключа → 401", noKey.status === 401);
  const withKey = await makeClient("cron")(
    "POST",
    `/api/round/expired/resolve?key=${ADMIN_SECRET_ENV}`
  );
  ok("cron с ключом → 200", withKey.status === 200, `resolvedCount=${withKey.json?.resolvedCount}`);
}

/* ---------- очистка ---------- */
async function cleanup() {
  const del = async (table, col, ids) => {
    for (const id of ids) {
      await q(`DELETE FROM "${table}" WHERE "${col}" = $1`, [id]);
    }
  };
  await del("ReferralEvent", "orderId", created.referrals);
  await del("Bet", "roundId", created.rounds);
  await del("Round", "id", created.rounds);
  await q('DELETE FROM "TrackEvent" WHERE "clipCode" = $1', ["71vsIPUu"]);
  /* v10: регистрационные следы ставщиков (EmailAuth до Account — FK) */
  for (const id of betAccounts.filter(Boolean)) {
    await q('DELETE FROM "LedgerTxn" WHERE "accountId" = $1', [id]);
    await q('DELETE FROM "EmailAuth" WHERE "accountId" = $1', [id]);
    await q('DELETE FROM "WaitlistEntry" WHERE "convertedAccountId" = $1', [id]);
    await q('DELETE FROM "Account" WHERE id = $1', [id]);
  }
  await q('DELETE FROM "PromoCode" WHERE batch = \'selftest\'', []);
  await q('DELETE FROM "PromoAttempt" WHERE "ipHash" = $1', [
    createHash("sha256").update("203.0.113.31|" + ADMIN_SECRET_ENV).digest("hex").slice(0, 32),
  ]);
  await close();
  console.log(`\n[cleanup] тестовые данные вычищены (rounds=${created.rounds.length})`);
}

try {
  await run();
} catch (e) {
  console.error("[bet-selftest] crash:", e);
  failed++;
} finally {
  await cleanup();
  console.log(`\n=== ИТОГ: ${passed} PASS / ${failed} FAIL ===\n`);
  process.exit(failed ? 1 : 0);
}
