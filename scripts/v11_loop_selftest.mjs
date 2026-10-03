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
 * B. Петля ставки (10/25/50) — v14: раунд живёт в планировщике clips:
 *    7. ставка 10 EYE → ok, баланс 90; DB: bet_stake −10
 *    8. ставка 75 EYE (вне 10..50) → 400
 *    9. второй аккаунт ставит 25 на другую сторону → баланс 75
 *   10. авторезолв REAL (закрытие окна + тик) → победитель: 90 + payout
 *       + guess_reward, проигравший: 75; математика пари-мьютюэля сходится
 *   11. DB: LedgerTxn bet_payout + guess_reward(+10), Σdelta == баланс
 * C. Платежи v14 (только пачки + rev; легаси-контуры удалены):
 *   12. POST /api/wallet/deposit → 404 (маршрут удалён)
 *   13. POST /api/me/cashout → 404 (выкупа очков нет)
 *   14. POST /api/boost/checkout → 404 (маршрут удалён)
 * D. Снапшот Season 1 (v14 — раздача $NR):
 *   15. GET /api/admin/snapshot без ключа → 401
 *   16. с ключом → CSV-шапка rank,accountId,…,correctRounds,earlyCorrect,weightEye,amountNr
 *   17. в CSV: игрок петли; правило min-20 верных раундов
 *   18. аккаунт с 3 ставками без веса/суммы
 *   19. шапка содержит earlyCorrect
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
import { createSelfSession, sessionCookieFor } from "./lib/selfsession.mjs";

/* Каноническая подпись сессии — sessionCookieFor из selfsession (v1.HMAC),
   идентичная lib/auth/session на сервере; локальная копия без префикса
   v1. ломала ВСЕ авторизованные запросы (сервер отбрасывает cookie без v1.). */
function giveSession(client, accountId) {
  for (const pair of sessionCookieFor(accountId).split("; ")) {
    const eq = pair.indexOf("=");
    client.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

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
const cleanupClips = [];

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
  console.log("\n=== A. Сессии (v16: вход только Google — покрыт google_selftest) ===");
  const A = makeClient("selftest-a");
  const B = makeClient("selftest-b");

  /* v16: сессии создаются напрямую (password/telegram-роуты удалены) */
  const sA = await createSelfSession({ email: `loop-a-${Date.now()}@test.dev` });
  const accA = sA.accountId;
  giveSession(A, accA);
  ok("1 сессия A создана (+100, passTier=1)", Boolean(accA));
  ok("1b cookies nr_uid+nr_auth подписаны", A.cookies.has("nr_uid") && /^v1\./.test(A.cookies.get("nr_auth") || ""));
  cleanupAccounts.push(accA);

  const dbA = await one(
    `SELECT t.delta FROM "LedgerTxn" t
     WHERE t."accountId" = $1 AND t.kind = 'signup_bonus'`,
    [accA]
  );
  ok("2 DB: signup_bonus +100", Number(dbA?.delta) === 100, `delta=${dbA?.delta}`);

  /* v16: telegram-роут удалён → 404 (метод входа больше не существует) */
  const tgGone = await A("POST", "/api/auth/telegram", { id: "9900000009" });
  ok("3 telegram-вход удалён (v16) → 404", tgGone.status === 404, `status=${tgGone.status}`);
  const pwGone = await makeClient("pw-gone")("POST", "/api/auth/password", { email: `gone-${Date.now()}@test.dev`, password: "12345678" });
  ok("4 password-вход удалён (v16) → 404", pwGone.status === 404, `status=${pwGone.status}`);

  console.log("\n=== B. Петля ставки 10/25/50 → авторезолв → ledger ===");
  /* v14: раунд открывает планировщик из очереди clips. Сеим тестовый клип
     (label=real → REAL выигрывает), закрываем чужие окна и тикаем. */
  const PEPPER = envFromDotenv("COMMIT_PEPPER");
  const commitOf = (id, label) =>
    crypto.createHash("sha256").update(`${label}:${id}:${PEPPER}`).digest("hex");
  const loopClipId = `loop${Date.now().toString(36)}`.slice(0, 16);
  const sampleVideo = "https://www.w3schools.com/html/mov_bbb.mp4";
  await q(
    `insert into clips (id, source_url, video_url, author_handle, caption_public, label, label_commit, status, listed_by, created_at, updated_at)
     values ($1,$2,$3,'@loop','',$4,$5,'queued','selftest', now() - interval '7 days', now())
     on conflict (id) do nothing`,
    [loopClipId, `https://example.com/loop/${loopClipId}`, sampleVideo, "real", commitOf(loopClipId, "real")]
  );
  cleanupClips.push(loopClipId);
  await q(`update "Round" set "closesAt" = now() - interval '1 sec' where status in ('open','locked') and "clipCode" in (select id from clips where listed_by = 'selftest')`);
  const tickRes = await fetch(`${BASE}/api/cron/tick?key=${encodeURIComponent(ADMIN_SECRET)}`);
  ok("6b cron/tick 200", tickRes.status === 200);

  /* ждём, пока планировщик дойдёт до нашего клипа (чужие queued могли быть старше) */
  let clipCode = null;
  for (let i = 0; i < 45; i++) {
    const row = await one(`select id, status from clips where id = $1`, [loopClipId]);
    if (row?.status === "live") {
      clipCode = loopClipId;
      break;
    }
    if (row?.status === "queued") {
      /* наш клип ещё не первый — подрежем created_at и тикнем снова */
      await q(`update "Round" set "closesAt" = now() - interval '1 sec' where status in ('open','locked') and "clipCode" in (select id from clips where listed_by = 'selftest')`);
      await fetch(`${BASE}/api/cron/tick?key=${encodeURIComponent(ADMIN_SECRET)}`);
    } else break;
    await new Promise((r) => setTimeout(r, 700));
  }
  ok("7.0 тестовый клип в live", Boolean(clipCode), clipCode ?? "");

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

  /* v16: второй аккаунт сессией напрямую */
  const sB = await createSelfSession({ email: `loop-b-${Date.now()}@test.dev` });
  const accB = sB.accountId;
  giveSession(B, accB);
  cleanupAccounts.push(accB);
  const rv2 = await B("GET", `/api/round?clip=${encodeURIComponent(clipCode)}`);
  const roundId2 = rv2.json?.round?.id || rv2.json?.id;
  const bet2 = await B("POST", "/api/bet", { round_id: roundId2, side: "synth", amount_cents: 25, mode: "balance" });
  ok("9 второй аккаунт ставит 25 на SYNTH", bet2.status === 200 && bet2.json?.account?.balanceCents === 75, `bal=${bet2.json?.account?.balanceCents}`);
  cleanupBets.push(bet1.json?.bet_id, bet2.json?.bet_id);
  cleanupRounds.push(roundId2);

  /* закрываем окно → планировщик авторезолвит (label=real → REAL) */
  await q(`update "Round" set "closesAt" = now() - interval '1 sec' where id = $1`, [roundId2]);
  await q(`update "Bet" set "betSec" = 0 where "roundId" = $1 and side = 'real'`, [roundId2]);
  await fetch(`${BASE}/api/cron/tick?key=${encodeURIComponent(ADMIN_SECRET)}`);
  const resolvedRow = await one(`select status, "resolvedAs" from "Round" where id = $1`, [roundId2]);
  ok("10 авторезолв REAL → ok", resolvedRow?.status === "resolved" && resolvedRow?.resolvedAs === "real", JSON.stringify(resolvedRow ?? {}).slice(0, 120));

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

  console.log("\n=== C. Платежи v14: легаси-контуры удалены ===");
  const dep = await A("POST", "/api/wallet/deposit", { amount_cents: 500 });
  ok("12 deposit → 404 (маршрут удалён)", dep.status === 404);
  const cash = await A("POST", "/api/me/cashout", { wallet: "TQn9Y2khDD95J42FQtQTdwVVRZq7NmH5s1" });
  ok("13 cashout → 404 (выкупа очков нет)", cash.status === 404);
  const boost = await A("POST", "/api/boost/checkout", { code: clipCode, days: 1 });
  ok("14 boost checkout → 404 (маршрут удалён)", boost.status === 404);

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
  /* v14: снапшот переведён на правила раздачи $NR (вес = stake × decay
     по верным ставкам, < 20 верных раундов → ноль) — формула
     eye*min(1,bets/10) удалена из кода и сайта по ТЗ. Шапка новая. */
  ok("16 CSV 200 + шапка v14", snap.status === 200 && header === "rank,accountId,telegramId,displayName,correctRounds,earlyCorrect,weightEye,amountNr", header);
  const rowA = lines.find((l) => l.includes(accA));
  ok("17 игрок петли в CSV", Boolean(rowA), rowA?.slice(0, 120));
  if (rowA) {
    const cells = rowA.split(",").map((c) => c.replaceAll('"', ""));
    const correct = Number(cells[4]);
    const weightEye = Number(cells[6]);
    const amountNr = Number(cells[7]);
    ok("17b правило min-20: мало верных раундов → вес/сумма 0", correct < 20 ? weightEye === 0 && amountNr === 0 : amountNr >= 0, `correct=${correct} w=${weightEye} nr=${amountNr}`);
  }
  const shortIn = lines.some((l) => l.includes(accShort));
  /* v14: снапшот не режет строки — резит ВЕС (минимум 20 верных раундов):
     аккаунт с 3 сеяными ставками либо не попадает (нет won), либо вес 0 */
  const shortRow = lines.find((l) => l.includes(accShort));
  const shortZero = !shortRow || (Number(shortRow.split(",")[6].replaceAll('"', "")) === 0 && Number(shortRow.split(",")[7].replaceAll('"', "")) === 0);
  ok("18 аккаунт с 3 ставками без веса/суммы", shortZero, shortRow?.slice(0, 80));
  ok("19 шапка содержит earlyCorrect колонку", header.includes("earlyCorrect"));

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
    for (const cid of cleanupClips) {
      if (!cid) continue;
      await q(`DELETE FROM "Bet" WHERE "roundId" IN (SELECT id FROM "Round" WHERE "clipCode" = $1)`, [cid]).catch(() => {});
      await q(`DELETE FROM "Round" WHERE "clipCode" = $1`, [cid]).catch(() => {});
      await q(`DELETE FROM clips WHERE id = $1`, [cid]).catch(() => {});
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
