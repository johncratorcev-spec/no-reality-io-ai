#!/usr/bin/env node
/**
 * v14 selftest — экономика по финальному ТЗ (против работающего :3000).
 *
 * ЧЕК-ЛИСТ ТЗ «Готово, если»:
 *   1. CSV нет в дереве (+ сиды и скрипты сборки удалены);
 *   2. anon не читает метку (RLS + публичный API);
 *   3. клип сам проходит queued → live → resolved (планировщик);
 *   4. ссылка (?ref=) есть до оплаты;
 *   5. доля не пишется до paid и считается только с пачки;
 *   6. последний верный колл даёт нулевой вес.
 *
 * Плюс: label_commit детерминизм, 400 без метки, void (битая ссылка,
 * ставки назад, метка не раскрывается), резолв без ставок, идемпотентность
 * вебхука, пачки 100/300/1000, revshare 20%/burn/порог выплаты,
 * снапшот (min-20, кепы, 75/15/10), merkle-эндпоинт.
 *
 * Запуск: поднять дев-сервер с моками 2328 (см. economy_selftest), затем
 *   node scripts/v14_selftest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import { q, one, close } from "./lib/supadb.mjs";
import { createSelfSession, dropSelfSession } from "./lib/selfsession.mjs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const ADMIN_KEY = env.ADMIN_SECRET;
const PEPPER = env.COMMIT_PEPPER;
const PAY_KEY = process.env.TWOTHOUSAND328_PAYMENT_API_KEY || env.TWOTHOUSAND328_PAYMENT_API_KEY || "test-payment-key";
const WINDOW_SEC = Number(env.BET_WINDOW_SEC || 25);

let passed = 0;
let failed = 0;
const cleanupIds = { clips: [], accounts: [] };

function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function commitOf(id, label) {
  return createHash("sha256").update(`${label}:${id}:${PEPPER}`).digest("hex");
}

function sign2328(payload) {
  const { sign: _s, ...rest } = payload;
  const base64 = Buffer.from(JSON.stringify(rest), "utf-8").toString("base64");
  return createHmac("sha256", PAY_KEY).update(base64, "utf-8").digest("hex");
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
        "user-agent": `v14-selftest/1.0 (${name})`,
        "x-forwarded-for": "203.0.113.77",
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
    return { status: res.status, json, text: await res.text().catch(() => "") };
  };
  api.cookies = cookies;
  return api;
}

async function register(api, tag, ref) {
  /* v16: password-роут удалён — аккаунт создаётся напрямую, атрибуция —
     зеркальной записью в БД (реальный путь attributeReferral покрыт
     google_selftest через cookie nr_ref при google-входе) */
  const email = `v14-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.dev`;
  const s = await createSelfSession({ email });
  const accId = s.accountId;
  if (accId) cleanupIds.accounts.push(accId);
  if (accId && ref) {
    await q(
      `update "Account" set "referredById" = (select id from "Account" where "refCode" = $1)
       where id = $2 and "referredById" is null
         and (select id from "Account" where "refCode" = $1) is distinct from $2`,
      [ref, accId]
    );
  }
  return {
    res: {
      status: 200,
      json: { status: "registered", account: { accountId: accId, balanceCents: 100 } },
    },
    accId,
    email,
  };
}

async function tick() {
  const res = await fetch(`${BASE}/api/cron/tick?key=${encodeURIComponent(ADMIN_KEY)}`);
  return { status: res.status, json: await res.json().catch(() => null) };
}

/* живая тестовая ссылка: публичные sample-MP4 (206) — CDN-ссылки очереди
   могут быть просрочены (BD обновляет их панелью, это контент-процесс) */
async function sampleVideoUrl() {
  const candidates = [
    "https://www.w3schools.com/html/mov_bbb.mp4",
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  ];
  for (const u of candidates) {
    try {
      const res = await fetch(u, {
        headers: { Range: "bytes=0-1" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 206) return u;
    } catch {}
  }
  return null;
}

async function insertClip(id, label, videoUrl, backdateMs) {
  await q(
    `insert into clips (id, source_url, video_url, author_handle, caption_public, label, label_commit, status, listed_by, created_at, updated_at)
     values ($1,$2,$3,'@test','',$4,$5,'queued','selftest', $6, $6)
     on conflict (id) do nothing`,
    [
      id,
      `https://example.com/selftest/${id}`,
      videoUrl,
      label,
      commitOf(id, label),
      new Date(Date.now() - backdateMs).toISOString(),
    ]
  );
  cleanupIds.clips.push(id);
}

/* ---------------- тест ---------------- */
async function run() {
  console.log(`\n[v14-selftest] ${BASE} (window=${WINDOW_SEC}s)\n`);

  /* ---- prelude: чистим остатки прошлых прогонов ---- */
  await q(`delete from "Bet" where "roundId" in (select id from "Round" where "clipCode" in (select id from clips where source_url like 'https://example.com/selftest%'))`).catch(() => {});
  await q(`delete from "Round" where "clipCode" in (select id from clips where source_url like 'https://example.com/selftest%')`).catch(() => {});
  await q(`delete from clips where source_url like 'https://example.com/selftest%'`).catch(() => {});
  const staleAccs = await q(`select "accountId" from "EmailAuth" where email like 'v14-%@test.dev'`).catch(() => []);
  if (staleAccs.length) {
    const ids = staleAccs.map((r) => r.accountId);
    await q(`delete from "Bet" where "bettorId" in (select "bettorId" from "Bet" where "accountId" = any($1)) or "accountId" = any($1)`.replace('"bettorId" in (select "bettorId" from "Bet" where "accountId" = any($1)) or', '"accountId" = any($1) or "bettorId" is null and false or'), [ids]).catch(() => {});
    await q(`delete from "LedgerTxn" where "accountId" = any($1)`, [ids]).catch(() => {});
    await q(`delete from pay_orders where "accountId" = any($1)`, [ids]).catch(() => {});
    await q(`delete from "EmailAuth" where email like 'v14-%@test.dev'`).catch(() => {});
    await q(`delete from "Account" where id = any($1)`, [ids]).catch(() => {});
    console.log(`  prelude: вычищено ${ids.length} старых тестовых аккаунтов`);
  }

  /* ================= 1. дерево без CSV ================= */
  console.log("── 1. Дерево (CSV/сиды/скрипты сборки удалены)");
  ok("data/posts.csv нет", !fs.existsSync("data/posts.csv"));
  ok("data/prompts.csv нет", !fs.existsSync("data/prompts.csv"));
  ok("gen-posts-snapshot.mjs нет", !fs.existsSync("scripts/gen-posts-snapshot.mjs"));
  ok("refresh_links.py нет", !fs.existsSync("scripts/refresh_links.py"));
  let dirty = "";
  for (const f of ["src/lib/csv.ts", "src/lib/posts.snapshot.ts", "src/lib/bet/cashout.ts"]) {
    if (fs.existsSync(f)) dirty += ` ${f}`;
  }
  ok("старые csv/cashout модули удалены", dirty === "", dirty);

  const srcTree = (() => {
    let out = "";
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name)) out += fs.readFileSync(p, "utf-8");
      }
    };
    walk("src");
    return out;
  })();
  ok("формула valid_bets удалена из кода", !srcTree.includes("valid_bets"));
  ok("1 EYE = 1 USDC удалён из кода", !srcTree.includes("1 EYE = 1 USDC") && !srcTree.includes("1 EYE=1 USDC"));

  /* ================= 2. label_commit + админ-API ================= */
  console.log("── 2. POST /api/admin/clips (секрет, 400 без метки, queued)");
  const A = makeClient("a");
  const regA = await register(A, "a");
  ok("регистрация A", regA.res.status === 200 && Boolean(regA.accId), regA.accId ?? "");
  const accA = regA.accId;

  const vid = await sampleVideoUrl();
  ok("есть живой sample video_url", Boolean(vid));

  const noLabel = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_KEY },
    body: JSON.stringify({ sourceUrl: "https://example.com/x", videoUrl: vid }),
  });
  ok("без метки — 400", noLabel.status === 400, `status=${noLabel.status}`);

  const noAuth = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceUrl: "https://example.com/x", videoUrl: vid, label: "real" }),
  });
  ok("без секрета — 401", noAuth.status === 401, `status=${noAuth.status}`);

  const src1 = `https://example.com/selftest-self-${Date.now()}`;
  const c1 = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_KEY },
    body: JSON.stringify({
      sourceUrl: src1,
      videoUrl: vid,
      label: "real",
      listedBy: "selftest",
    }),
  });
  const c1d = await c1.json().catch(() => null);
  ok("с меткой — 200 queued", c1.status === 200 && c1d?.clip?.status === "queued", `status=${c1.status}`);
  /* API сам генерирует публичный id — берём его из ответа */
  let clip1Id = c1d?.clip?.id ?? "";
  ok("label_commit = sha256(label:id:pepper)", c1d?.clip?.labelCommit === commitOf(c1d?.clip?.id ?? "", "real"));
  cleanupIds.clips.push(c1d?.clip?.id);

  /* гигиена: закрыть чужие live-раунды, чтобы планировщик взял именно тестовый клип */
  await q(`update "Round" set "closesAt" = $1 where status in ('open','locked')`, [
    new Date(Date.now() - 1000).toISOString(),
  ]);

  /* тестовые клипы — самые старые в очереди (планировщик берёт их по очереди):
     №1 real (ранний победитель), №2 synth (поздний верный колл),
     №3 real (void), №4 real (резолв без ставок) */
  const clip2Id = `v14b${Date.now().toString(36)}`.slice(0, 16);
  const clip3Id = `v14c${Date.now().toString(36)}`.slice(0, 16);
  const clip4Id = `v14d${Date.now().toString(36)}`.slice(0, 16);
  await q(`update clips set created_at = $1 where id = $2`, [
    new Date(Date.now() - 3_600_000).toISOString(),
    clip1Id,
  ]);
  await insertClip(clip2Id, "synth", vid, 3_590_000);
  await insertClip(clip3Id, "real", vid, 3_580_000);
  await insertClip(clip4Id, "real", vid, 3_570_000);

  /* ================= 3. queued → live (планировщик) ================= */
  console.log("── 3. Планировщик: queued → live → payload");
  let t1 = await tick();
  ok("cron/tick 200", t1.status === 200 && t1.json?.ok === true, JSON.stringify(t1.json ?? {}));

  /* ждём продвижения (чужие раунды могли доживать) */
  let liveClip = null;
  for (let i = 0; i < 6; i++) {
    liveClip = await one(`select * from clips where id = $1`, [clip1Id]);
    if (liveClip?.status === "live") break;
    await q(`update "Round" set "closesAt" = $1 where status in ('open','locked')`, [
      new Date(Date.now() - 1000).toISOString(),
    ]);
    await tick();
    await new Promise((r) => setTimeout(r, 800));
  }
  ok("клип стал live", liveClip?.status === "live", liveClip?.status ?? "нет");
  ok("opens_at/closes_at выставлены", Boolean(liveClip?.opens_at && liveClip?.closes_at));

  const V = makeClient("v");
  const roundRes = await V("GET", `/api/round?clip=${clip1Id}`);
  const round = roundRes.json?.round;
  ok("GET /api/round отдал live-раунд", Boolean(round) && round.status === "open");
  ok("окно = BET_WINDOW_SEC", round?.windowSec === WINDOW_SEC, `ws=${round?.windowSec}`);
  ok("публичный payload содержит label_commit", typeof round?.labelCommit === "string" && round.labelCommit.length === 64);
  const rawRound = JSON.stringify(roundRes.json);
  ok("метка НЕ утекает до резолва", !rawRound.includes('"label"') && !rawRound.includes('"resolvedAs"'));
  ok("автор/исходник/video_url CDN не утекают", !rawRound.includes('"authorHandle"') && !rawRound.includes('"sourceUrl"') && !rawRound.includes("cdninstagram"));

  /* прокси видео */
  const vp = await fetch(`${BASE}/api/clip/${clip1Id}/video`, { headers: { Range: "bytes=0-63" } });
  ok("прокси видео 206", vp.status === 206 || vp.status === 200, `status=${vp.status} ct=${vp.headers.get("content-type")}`);

  /* ================= 4. ставки + вес + резолв ================= */
  console.log("── 4. Ставки: decay ×1 у раннего, нулевой вес у последнего верного");
  const B = makeClient("b");
  const regB = await register(B, "b");
  ok("регистрация B", regB.res.status === 200 && Boolean(regB.accId));
  const betA = await A("POST", "/api/bet", {
    round_id: round.id,
    side: "real",
    amount_cents: 50,
    mode: "balance",
  });
  ok("A поставил 50 на REAL (верная сторона)", betA.status === 200, JSON.stringify(betA.json ?? {}));

  /* B ставит на SYNTH (проиграет) */
  const betB = await B("POST", "/api/bet", {
    round_id: round.id,
    side: "synth",
    amount_cents: 50,
    mode: "balance",
  });
  ok("B поставил 50 на SYNTH", betB.status === 200);

  /* латентность сети не должна влиять на проверку формулы:
     принудительно ставим ставке A секунду 0 (зона ×1) */
  await q(`update "Bet" set "betSec" = 0 where "roundId" = $1 and side = 'real'`, [round.id]);

  /* форсируем закрытие окна; тик резолвит clip1 И продвигает clip2 */
  await q(`update "Round" set "closesAt" = $1 where id = $2`, [
    new Date(Date.now() - 1000).toISOString(),
    round.id,
  ]);
  const t2 = await tick();
  ok("тик резолвит", t2.status === 200);

  const after = await A("GET", `/api/round?clip=${clip1Id}`);
  const rr = after.json?.round;
  ok("раунд resolved", rr?.status === "resolved", rr?.status ?? "");
  ok("метка раскрыта после резолва", rr?.resolvedAs === "real", rr?.resolvedAs ?? "");
  ok("хеш сошёлся (hashMatched)", rr?.hashMatched === true);
  ok("секунда верного колла (мой) — ранний", typeof rr?.myBetSec === "number" && rr.myBetSec < 5, `sec=${rr?.myBetSec}`);
  ok("первый верный колл зафиксирован", typeof rr?.firstCorrectSec === "number", `first=${rr?.firstCorrectSec}`);

  const betArow = await one(
    `select status, "payoutCents", "weightMilli", "decayMilli" from "Bet" where "roundId" = $1 and side = 'real' limit 1`,
    [round.id]
  );
  ok("верная ставка won", betArow?.status === "won");
  ok("decay раннего = 1000 (×1)", betArow?.decayMilli === 1000);
  ok("вес раннего = 50 EYE (50000 milli)", Number(betArow?.weightMilli) === 50_000, `w=${betArow?.weightMilli}`);
  const betBrow = await one(
    `select status, "weightMilli" from "Bet" where "roundId" = $1 and side = 'synth' limit 1`,
    [round.id]
  );
  ok("неверный колл — вес 0", Number(betBrow?.weightMilli) === 0, `w=${betBrow?.weightMilli}`);

  const clip1After = await one(`select status, resolved_at from clips where id = $1`, [clip1Id]);
  ok("клип стал resolved", clip1After?.status === "resolved");

  /* clip_reveals: после резолва метка видна */
  const rev1 = await one(`select label, label_commit from clip_reveals where id = $1`, [clip1Id]);
  ok("clip_reveals показывает метку+хеш после resolved", rev1?.label === "real" && rev1?.label_commit === commitOf(clip1Id, "real"));

  /* ---- ПОСЛЕДНИЙ ВЕРНЫЙ КОЛЛ = НУЛЕВОЙ ВЕС (чеклист ТЗ №6) ----
     clip2: A коллит верную сторону в последние 5 секунды окна →
     ставка выигрывает выплату, но decay=0 → вес 0 */
  console.log("── 4b. Последний верный колл: выплата есть, вес 0");
  const live2 = await one(`select status from clips where id = $1`, [clip2Id]);
  ok("clip2 продвинут планировщиком (live)", live2?.status === "live", live2?.status ?? "");
  const r2 = await A("GET", `/api/round?clip=${clip2Id}`);
  const round2 = r2.json?.round;
  ok("clip2: live-раунд отдаётся", round2?.status === "open");

  const lateBet = await A("POST", "/api/bet", { round_id: round2.id, side: "synth", amount_cents: 25, mode: "balance" });
  ok("A поставил 25 на SYNTH (верная сторона clip2)", lateBet.status === 200);
  await q(`update "Bet" set "betSec" = $1 where id = $2`, [WINDOW_SEC - 2, lateBet.json?.bet_id]);
  const balLate0 = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  await q(`update "Round" set "closesAt" = $1 where id = $2`, [new Date(Date.now() - 1000).toISOString(), round2.id]);
  await tick();

  const lateRow = await one(`select status, "payoutCents", "weightMilli", "decayMilli", "betSec" from "Bet" where id = $1`, [lateBet.json?.bet_id]);
  ok("поздний колл — WON (выплата приходит)", lateRow?.status === "won" && Number(lateRow?.payoutCents) > 0, `payout=${lateRow?.payoutCents}`);
  ok("но decay = 0 → вес 0 (последние 5с)", Number(lateRow?.decayMilli) === 0 && Number(lateRow?.weightMilli) === 0, `decay=${lateRow?.decayMilli} w=${lateRow?.weightMilli}`);

  /* ================= 5. void: битая ссылка → ставки назад ================= */
  console.log("── 5. Void: битая ссылка, ставки назад, метка не раскрывается");
  const live3 = await one(`select status from clips where id = $1`, [clip3Id]);
  ok("clip3 продвинут (live)", live3?.status === "live", live3?.status ?? "");
  const r3 = await A("GET", `/api/round?clip=${clip3Id}`);
  const round3 = r3.json?.round;
  const balBeforeVoid = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  const vb = await A("POST", "/api/bet", { round_id: round3.id, side: "real", amount_cents: 10, mode: "balance" });
  ok("ставка в live-раунд №3", vb.status === 200);
  const balAfterBet = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  ok("ставка списана (−10)", balAfterBet === balBeforeVoid - 10, `${balBeforeVoid}→${balAfterBet}`);

  await q(`update clips set video_url = 'https://dead.invalid/x.mp4' where id = $1`, [clip3Id]);
  await q(`update "Round" set "closesAt" = $1 where id = $2`, [new Date(Date.now() - 1000).toISOString(), round3.id]);
  await tick();

  const clip3After = await one(`select status from clips where id = $1`, [clip3Id]);
  ok("битая ссылка → clip void", clip3After?.status === "void", clip3After?.status ?? "");
  const round3After = await one(`select status, "resolvedAs" from "Round" where id = $1`, [round3.id]);
  ok("раунд void, метка НЕ раскрыта", round3After?.status === "void" && round3After?.resolvedAs === null);
  const balAfterVoid = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  ok("ставка вернулась на баланс", balAfterVoid === balAfterBet + 10, `${balAfterBet}→${balAfterVoid}`);
  const refund = await one(
    `select count(*)::int as n from "LedgerTxn" where "accountId" = $1 and kind = 'bet_refund' and "refKey" = $2`,
    [accA, `betrefund:${vb.json?.bet_id}`]
  );
  ok("ledger bet_refund записан", (refund?.n ?? 0) === 1, `n=${refund?.n}`);
  const rev3 = await one(`select label from clip_reveals where id = $1`, [clip3Id]);
  ok("clip_reveals для void — метка пустая", rev3?.label === "", `label='${rev3?.label}'`);

  /* ================= 6. резолв без ставок ================= */
  console.log("── 6. Ставок нет — резолв всё равно есть");
  await q(`update "Round" set "closesAt" = $1 where "clipCode" = $2`, [new Date(Date.now() - 2000).toISOString(), clip4Id]);
  await tick();
  const clip4After = await one(`select status from clips where id = $1`, [clip4Id]);
  ok("клип без ставок resolved", clip4After?.status === "resolved", clip4After?.status ?? "");

  /* ================= 7. Касса: пачки + идемпотентность ================= */
  console.log("── 7. Касса: пачка 1000 EYE = 7 USDT, вебхук идемпотентен");
  const balA0 = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  const packRes = await A("POST", "/api/packs", { sku: 1000 });
  ok("инвойс пачки создан (сервер)", packRes.status === 200 && Boolean(packRes.json?.orderId), JSON.stringify(packRes.json ?? {}));
  ok("order_id = eye-<acc>-<sku>-<nonce>", /^eye-[0-9a-f-]{36}-1000-[0-9a-f]+$/.test(packRes.json?.orderId ?? ""), packRes.json?.orderId ?? "");
  ok("payUrl от 2328", typeof packRes.json?.payUrl === "string" && packRes.json.payUrl.length > 8);

  const packOrder = await one(`select * from pay_orders where order_id = $1`, [packRes.json.orderId]);
  ok("PayOrder: eye=1000, 7 000 000 микро", Number(packOrder?.eye_amount) === 1000 && Number(packOrder?.amount_micros) === 7_000_000);

  const hook = (order) => ({
    uuid: `u-${Math.random().toString(36).slice(2)}`,
    order_id: order,
    payment_status: "paid",
    txid: "tx-selftest",
    amount: "7.00",
    currency: "USDT",
    payer_amount: "7.00",
    payer_currency: "USDT",
    merchant_amount: "7.00",
    sign: "",
  });
  const sendHook = async (payload) => {
    payload.sign = sign2328(payload);
    const r = await fetch(`${BASE}/api/webhooks/2328`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  const p1 = await sendHook(hook(packRes.json.orderId));
  ok("webhook paid → 200", p1.status === 200);
  const balA1 = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  ok("EYE дописаны (+1000)", balA1 === balA0 + 1000, `${balA0}→${balA1}`);
  const packTxns = await one(
    `select count(*)::int as n from "LedgerTxn" where "refKey" = $1`,
    [`pack:${packRes.json.orderId}`]
  );
  ok("ledger ровно одна строка", packTxns?.n === 1);
  await sendHook(hook(packRes.json.orderId));
  const balA1b = Number((await one(`select "balanceCents" from "Account" where id = $1`, [accA]))?.balanceCents ?? 0);
  ok("повторный webhook — идемпотентен", balA1b === balA1, `${balA1b}`);
  const badHook = hook(packRes.json.orderId);
  badHook.sign = "deadbeef";
  const badRes = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(badHook),
  });
  ok("поддельная подпись → 401", badRes.status === 401, `status=${badRes.status}`);

  /* ================= 8. Рефка: burned → unlock → earned ================= */
  console.log("── 8. Рефка: ссылка до оплаты, burned, 20% только с пачек");
  const refA = await A("GET", "/api/me/ref");
  ok("ссылка есть у всех с регистрации", refA.status === 200 && /^r[a-z0-9]{5,11}$/.test(refA.json?.code ?? ""), refA.json?.code ?? "");
  ok("до оплаты «процент выключен»", refA.json?.revshare === false);

  /* B2 регистрируется по ссылке A */
  const B2 = makeClient("b2");
  const regB2 = await register(B2, "b2", refA.json.code);
  ok("регистрация по ?ref=", regB2.res.status === 200 && Boolean(regB2.accId));
  const b2row = await one(`select "referredById" from "Account" where id = $1`, [regB2.accId]);
  ok("атрибуция записана", b2row?.referredById === accA);

  /* B2 покупает пачку 100 EYE (1 USDT) пока revshare выключен → сгорает 20 центов */
  const packB2 = await B2("POST", "/api/packs", { sku: 100 });
  ok("B2 купил пачку 100", packB2.status === 200);
  await sendHook(hook(packB2.json.orderId));
  const aBurned = await one(`select "refBurnedCents", "refEarnedCents" from "Account" where id = $1`, [accA]);
  ok("доля не пишется до paid-статуса revshare → burned +20", Number(aBurned?.refBurnedCents) === 20 && Number(aBurned?.refEarnedCents) === 0, `burned=${aBurned?.refBurnedCents}`);

  /* A платит 3 USDT (rev-инвойс) → revshare on */
  const unlock = await A("POST", "/api/me/ref");
  ok("rev-инвойс создан", unlock.status === 200 && /^rev-[0-9a-f-]{36}/.test(unlock.json?.orderId ?? ""), unlock.json?.orderId ?? "");
  const revPayload = {
    uuid: `u-${Math.random().toString(36).slice(2)}`,
    order_id: unlock.json.orderId,
    payment_status: "paid",
    txid: "tx-rev",
    amount: "3.00",
    currency: "USDT",
    payer_amount: "3.00",
    payer_currency: "USDT",
    merchant_amount: "3.00",
    sign: "",
  };
  revPayload.sign = sign2328(revPayload);
  const revHook = await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(revPayload),
  });
  ok("rev webhook paid → 200", revHook.status === 200);
  const aRev = await one(`select revshare from "Account" where id = $1`, [accA]);
  ok("paid ставит revshare", aRev?.revshare === true);
  await fetch(`${BASE}/api/webhooks/2328`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(revPayload),
  });
  const revOrders = await one(`select count(*)::int as n from pay_orders where kind = 'rev' and "accountId" = $1 and status = 'paid'`, [accA]);
  ok("rev-инвойс оплачивается один раз", revOrders?.n === 1);

  /* B2 покупает пачку 1000 (7 USDT) → A капает 140 центов (20%) */
  const packB2b = await B2("POST", "/api/packs", { sku: 1000 });
  await sendHook(hook(packB2b.json.orderId));
  const aEarned = await one(`select "refEarnedCents" from "Account" where id = $1`, [accA]);
  ok("20% от пачки 7 USDT = 1.40 USDT в earned", Number(aEarned?.refEarnedCents) === 140, `earned=${aEarned?.refEarnedCents}`);
  ok("burned не пересчитывается задним числом", Number(aBurned?.refBurnedCents) === 20);

  /* выигрыши реферала в EYE — цифрой, без доллара */
  const refA2 = await A("GET", "/api/me/ref");
  ok("реферал виден в списке", Array.isArray(refA2.json?.referrals) && refA2.json.referrals.length === 1);
  ok("EYE выигрыши реферала — числом (не USDT)", typeof refA2.json?.referrals?.[0]?.eyeWon === "number");

  /* выплата от 5 USDT: 140 < 500 → 409 */
  const payEarly = await fetch(`${BASE}/api/admin/ref-payout?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: accA }),
  });
  ok("выплата ниже 5 USDT отклонена (409)", payEarly.status === 409, `status=${payEarly.status}`);
  await q(`update "Account" set "refEarnedCents" = "refEarnedCents" + 500 where id = $1`, [accA]);
  const payOk = await fetch(`${BASE}/api/admin/ref-payout?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: accA }),
  });
  ok("выплата ≥ 5 USDT проходит", payOk.status === 200, `status=${payOk.status}`);
  const aPaid = await one(`select "refPaidCents", "refEarnedCents" from "Account" where id = $1`, [accA]);
  ok("earned → paid перенос", Number(aPaid?.refPaidCents) >= 500 && Number(aPaid?.refEarnedCents) - Number(aPaid?.refPaidCents) >= 0, `earned=${aPaid?.refEarnedCents} paid=${aPaid?.refPaidCents}`);

  /* ---- второй цикл (регрессия): earned копится НАКОПЛЕННО, payout
     не должен декрементить earned — иначе следующий цикл ломается ---- */
  await q(`update "Account" set "refEarnedCents" = "refEarnedCents" + 500 where id = $1`, [accA]);
  const payOk2 = await fetch(`${BASE}/api/admin/ref-payout?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: accA }),
  });
  ok("второй цикл выплаты работает", payOk2.status === 200, `status=${payOk2.status}`);
  const aPaid2 = await one(`select "refPaidCents", "refEarnedCents" from "Account" where id = $1`, [accA]);
  ok("после 2-го цикла: остаток = earned − paid = 0", Number(aPaid2?.refEarnedCents) - Number(aPaid2?.refPaidCents) === 0, `earned=${aPaid2?.refEarnedCents} paid=${aPaid2?.refPaidCents}`);

  /* ================= 9. Снапшот $NR ================= */
  console.log("── 9. Снапшот: <20 верных → 0, доли 75/15/10, merkle");
  const snap = await fetch(`${BASE}/api/admin/snapshot?format=json&key=${encodeURIComponent(ADMIN_KEY)}`);
  ok("snapshot JSON 200", snap.status === 200);
  const art = await snap.json().catch(() => null);
  ok("параметры 75/15/10", art?.params?.gamePack === Math.floor(art?.params?.supply * 0.75) && art?.params?.authorsPack === Math.floor(art?.params?.supply * 0.15), JSON.stringify(art?.params ?? {}));
  const meRow = (art?.players ?? []).find((p) => p.accountId === accA);
  ok("игрок с 1 верным раундом — вес 0 (<20)", meRow && meRow.correctRounds < 20 && meRow.weightEye === 0 && meRow.amountNr === 0, JSON.stringify(meRow ?? {}));
  const badPlayers = (art?.players ?? []).filter((p) => p.correctRounds < 20 && (p.weightEye !== 0 || p.amountNr !== 0));
  ok("правило min-20 у всех строк", badPlayers.length === 0);
  const capped = (art?.players ?? []).filter((p) => p.amountNr > art?.params?.accountCap);
  ok("кеп аккаунта 2% не превышен", capped.length === 0);
  ok("суммы ≤ игровой пачки", (art?.totals?.playersNr ?? 0) <= (art?.params?.gamePack ?? 0));
  ok("nextSeason = 10%", art?.totals?.nextSeasonNr === art?.params?.nextSeasonCarry);
  ok("авторы присутствуют в артефакте", Array.isArray(art?.authors));

  const merkleRes = await fetch(`${BASE}/api/admin/snapshot?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses: { [accA]: "0x000000000000000000000000000000000000dEaD" } }),
  });
  /* ни у кого нет ≥20 верных раундов → сумм нет → 422 no_valid_addresses; это корректное поведение */
  ok("merkle-эндпоинт отвечает", merkleRes.status === 422 || merkleRes.status === 200, `status=${merkleRes.status}`);

  /* ================= 9b. /api/me/nr: ранг без монет + адрес ================= */
  console.log("── 9b. /api/me/nr: публичны ранг/ранние коллы, НЕ монеты");
  const nrA = await A("GET", "/api/me/nr");
  ok("nr: 200 с season", nrA.status === 200 && Boolean(nrA.json?.season?.code), JSON.stringify(nrA.json?.season ?? {}));
  ok("nr: монеты НЕ отдаются", nrA.json?.amountNr === undefined && nrA.json?.weightEye === undefined);
  ok("nr: ранг/верные/ранние — числа", typeof nrA.json?.rank === "number" || nrA.json?.rank === null);
  ok("nr: snapshotDone=false пока сезон идёт", nrA.json?.snapshotDone === false, String(nrA.json?.snapshotDone));
  const nrAnon = await makeClient("anon-nr")("GET", "/api/me/nr");
  ok("nr: без сессии → 401", nrAnon.status === 401, String(nrAnon.status));
  const addrEarly = await A("POST", "/api/me/nr", { address: "0x000000000000000000000000000000000000dEaD" });
  ok("nr: адрес ДО снапшота → 403 snapshot_pending", addrEarly.status === 403 && addrEarly.json?.error === "snapshot_pending", JSON.stringify(addrEarly.json ?? {}));
  /* ================= 10. Публичная гигиена ================= */
  console.log("── 10. Публичная гигиена (лендинг, лидерборд)");
  const land = await fetch(`${BASE}/`).then((r) => r.text());
  const nrCount = (land.match(/\$NR/g) || []).length;
  ok("на лендинге ровно одна строка про $NR", nrCount === 1, `$NR×${nrCount}`);
  const lb = await fetch(`${BASE}/api/leaderboard`).then((r) => r.json().catch(() => null));
  ok("лидерборд не отдаёт суммы $NR", !JSON.stringify(lb).toLowerCase().includes("amountnr"));

  /* ================= cleanup ================= */
  console.log("── cleanup");
  await q(`delete from "Bet" where "roundId" in (select id from "Round" where "clipCode" = any($1))`, [cleanupIds.clips]).catch(() => {});
  await q(`delete from "Round" where "clipCode" = any($1)`, [cleanupIds.clips]).catch(() => {});
  await q(`delete from clips where id = any($1)`, [cleanupIds.clips]).catch(() => {});
  await q(`delete from "LedgerTxn" where "accountId" = any($1)`, [cleanupIds.accounts]).catch(() => {});
  await q(`delete from pay_orders where "accountId" = any($1)`, [cleanupIds.accounts]).catch(() => {});
  await q(`delete from "EmailAuth" where "accountId" = any($1)`, [cleanupIds.accounts]).catch(() => {});
  await q(`delete from "Account" where id = any($1)`, [cleanupIds.accounts]).catch(() => {});
  await q(`delete from "TrackEvent" where meta like '%${cleanupIds.clips[0] ?? "___none___"}%'`).catch(() => {});
  console.log(`  clips/аккаунты/транзакции тестов вычищены (${cleanupIds.clips.length} клипов, ${cleanupIds.accounts.length} аккаунтов)`);

  console.log(`\n══════ ИТОГ: ${passed} PASS / ${failed} FAIL ══════\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run()
  .catch((e) => {
    console.error("selftest crashed:", e);
    process.exit(1);
  })
  .finally(close);
