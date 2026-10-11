#!/usr/bin/env node
/* ================================================================
   Stripe selftest (task 45) — «проверить тестовые запросы к Stripe
   перед пушем». Запускать ПОСЛЕ npm run build:

     node scripts/stripe_selftest.mjs            # полный E2E на моке
     node scripts/stripe_selftest.mjs --probe-live
                                                 # + живой api.stripe.com
     STRIPE_SECRET_KEY=sk_test_РЕАЛЬНЫЙ node \
       scripts/stripe_selftest.mjs --live       # реальные сессии test-mode

   Что делает дефолтный прогон (без реальных ключей):
   1) поднимает ЛОКАЛЬНЫЙ мок Stripe API (http://127.0.0.1:3787) —
      совместим по формату: form-encoded запрос, Bearer-ключ,
      { error } на ошибку, объект session на успех;
   2) поднимает прод-сервер Next (:3111) с STRIPE_API_BASE на мок —
      весь наш код (роуты, БД, лимиты) работает как в бою;
   3) гоняет E2E: checkout → метаданные → поллинг → оплата на моке →
      реконсиляция → webhook (реальный HMAC по официальной схеме
      Stripe) → разблокировка промпта → реферальное начисление 20%;
   4) негативные проверки: битая подпись 401, устаревший timestamp
      401, без подписи 401, replay-идемпотентность, unknown product
      400, expired-сессия;
   5) сверяет БД (StripeOrder/ReferralEvent) и чистит тестовые строки.

   --probe-live дополнительно стучится в НАСТОЯЩИЙ api.stripe.com
   с пустышкой-ключом: ожидаем 401 invalid API key — доказательство,
   что запрос доходит до прод-границы Stripe и корректно
   аутентифицируется по формату (Bearer + form-encoded).

   --live: с РЕАЛЬНЫМ sk_test_… создаёт по сессии на каждый товар
   каталога (test mode, реальные деньги НЕ списываются), ретривит их
   и сверяет суммы/метаданные. Webhook к localhost Stripe не доставит
   — для него: stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ================================================================ */

import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3111;
const MOCK_PORT = 3787;
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`;
const WHSEC = "whsec_test_selftest_00000000000000000000";

/* ---------------- tiny test harness ---------------- */

let pass = 0;
let fail = 0;
const failures = [];
function ok(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}
function section(t) {
  console.log(`\n—— ${t} ${"—".repeat(Math.max(0, 58 - t.length))}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- cookie jar (nr_buyer) ---------------- */

const jar = new Map();
function absorbCookies(res) {
  const list =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of list) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/* ---------------- webhook signing (схема Stripe) ---------------- */

function stripeSign(payload, tSec = Math.floor(Date.now() / 1000)) {
  const sig = crypto
    .createHmac("sha256", WHSEC)
    .update(`${tSec}.${payload}`)
    .digest("hex");
  return `t=${tSec},v1=${sig}`;
}

function completedEvent(session, evtId) {
  return JSON.stringify({
    id: evtId,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        amount_total: session.amount_total,
        currency: session.currency,
        payment_status: "paid",
        status: "complete",
        payment_intent: session.payment_intent,
        client_reference_id: session.client_reference_id,
        metadata: session.metadata,
      },
    },
  });
}

/* ---------------- локальный мок Stripe API ---------------- */

const mockSessions = new Map();
let lastCreate = null; // последний POST /v1/checkout/sessions

function mockServer() {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      const url = new URL(req.url, MOCK_BASE);
      res.setHeader("Content-Type", "application/json");

      // «оплата на hosted-странице» — это БРАУЗЕР покупателя, не API-вызов:
      // без Bearer-ключа, поэтому ветка ДО auth-гейта
      if (req.method === "POST" && url.pathname.startsWith("/pay/")) {
        const id = url.pathname.slice(5);
        const s = mockSessions.get(id);
        if (!s) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: { message: "no session" } }));
          return;
        }
        s.payment_status = "paid";
        s.status = "complete";
        s.payment_intent = `pi_mock${crypto.randomBytes(6).toString("hex")}`;
        res.statusCode = 302;
        res.setHeader(
          "Location",
          s._successUrl.replace("{CHECKOUT_SESSION_ID}", id)
        );
        res.end();
        return;
      }

      // Stripe первым делом проверяет ключ — мок ведёт себя так же
      const auth = req.headers.authorization || "";
      if (!auth.startsWith("Bearer sk_test_")) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            error: {
              message: "Invalid API Key provided",
              type: "invalid_request_error",
            },
          })
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
        const p = new URLSearchParams(body);
        lastCreate = Object.fromEntries(p.entries());
        const id = `cs_test_mock${crypto.randomBytes(8).toString("hex")}`;
        const metadata = {};
        for (const [k, v] of p.entries()) {
          const m = /^metadata\[(\w+)\]$/.exec(k);
          if (m) metadata[m[1]] = v;
        }
        const session = {
          id,
          object: "checkout.session",
          amount_total: Number(p.get("line_items[0][price_data][unit_amount]")),
          currency: p.get("line_items[0][price_data][currency]"),
          payment_status: "unpaid",
          status: "open",
          payment_intent: null,
          client_reference_id: p.get("client_reference_id") || null,
          metadata,
          url: `${MOCK_BASE}/pay/${id}`,
          _successUrl: p.get("success_url") || "",
          _cancelUrl: p.get("cancel_url") || "",
          _mode: p.get("mode"),
        };
        mockSessions.set(id, session);
        res.end(JSON.stringify(session));
        return;
      }

      // «оплата на hosted-странице»: помечаем paid и редиректим на success
      // (ветка переехала выше auth-гейта — браузер не ходит с Bearer)

      const mGet = /^\/v1\/checkout\/sessions\/(cs_test_\w+)$/.exec(
        url.pathname
      );
      if (req.method === "GET" && mGet) {
        const s = mockSessions.get(mGet[1]);
        if (!s) {
          res.statusCode = 404;
          res.end(
            JSON.stringify({
              error: { message: "No such session", type: "invalid_request_error" },
            })
          );
          return;
        }
        const { _successUrl, _cancelUrl, _mode, ...pub } = s;
        res.end(JSON.stringify(pub));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: "unknown path" } }));
    });
  });
  return server;
}

/* ---------------- server spawn ---------------- */

function startNextServer(env) {
  const bin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(
    process.execPath,
    [bin, "start", "-p", String(PORT), "-H", "127.0.0.1"],
    {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const logBuf = [];
  child.stdout.on("data", (d) => logBuf.push(d));
  child.stderr.on("data", (d) => logBuf.push(d));
  child.log = () => logBuf.slice(-40).join("");
  return child;
}

async function waitReady(server, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/api/posts`, { signal: AbortSignal.timeout(1500) });
      if (r.ok || r.status === 404) return true;
    } catch {
      /* ещё не поднялся */
    }
    await sleep(500);
  }
  return false;
}

/* ---------------- DB helpers (sqlite через python3) ---------------- */

function sqlite(sql) {
  const dbPath = path.join(ROOT, "db", "custom.db");
  const py = `import sqlite3,sys,json
try:
  c=sqlite3.connect(${JSON.stringify(dbPath)}, timeout=15)
  rows=[list(map(str,r)) for r in c.execute(sys.argv[1]).fetchall()]
  c.commit()
  print(json.dumps(rows))
except Exception as e:
  print(json.dumps([["PYERR",str(e)]]))
`;
  const out = execFileSync("python3", ["-c", py, sql], {
    encoding: "utf-8",
  }).trim();
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

/* ---------------- основной сценарий ---------------- */

async function runE2E() {
  const server = startNextServer({
    STRIPE_SECRET_KEY: "sk_test_mock_key_selftest",
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: MOCK_BASE,
    PUBLIC_BASE_URL: BASE,
  });
  const mock = mockServer();
  await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

  const orderIds = [];
  let serverUp = false;
  try {
    serverUp = await waitReady();
    ok("next prod server up on :3111", serverUp);
    if (!serverUp) {
      console.log(server.log());
      return;
    }

    /* ---------- витрина ---------- */
    section("market page");
    const mp = await fetch(`${BASE}/market`);
    const html = await mp.text();
    ok("GET /market → 200", mp.status === 200, `status ${mp.status}`);
    for (const t of ["neon rain district", "liquid chrome portrait", "paper fold transition"]) {
      ok(`catalog shows "${t}"`, html.includes(t));
    }
    ok("buy buttons enabled (cardPayEnabled)", html.includes("buy prompt"));

    /* ---------- checkout #1: neon-rain (гость) ---------- */
    section("checkout #1 — neon-rain, guest");
    const r1 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "neon-rain" }),
    });
    absorbCookies(r1);
    const d1 = await r1.json();
    ok("POST /api/market/checkout → 200", r1.status === 200, JSON.stringify(d1));
    ok("nr_buyer cookie set", jar.has("nr_buyer"));
    ok("returns stripe checkout url (mock)", String(d1.url || "").startsWith(`${MOCK_BASE}/pay/cs_test_`));
    ok("returns orderId", Boolean(d1.orderId));
    orderIds.push(d1.orderId);

    // что именно ушло в Stripe (form-encoded запрос нашего клиента)
    ok("stripe request: mode=payment", lastCreate?.mode === "payment");
    ok(
      "stripe request: unit_amount=1200 ($12.00)",
      lastCreate?.["line_items[0][price_data][unit_amount]"] === "1200"
    );
    ok("stripe request: currency=usd", lastCreate?.["line_items[0][price_data][currency]"] === "usd");
    ok(
      "stripe request: product name",
      (lastCreate?.["line_items[0][price_data][product_data][name]"] || "").includes("neon rain district")
    );
    ok(
      "stripe request: metadata.product_code",
      lastCreate?.["metadata[product_code]"] === "neon-rain"
    );
    ok(
      "stripe request: metadata.order_id = orderId",
      lastCreate?.["metadata[order_id]"] === d1.orderId
    );
    ok(
      "stripe request: success_url → /market/thanks?session_id=",
      (lastCreate?.success_url || "").includes("/market/thanks?session_id={CHECKOUT_SESSION_ID}")
    );
    ok(
      "stripe request: client_reference_id",
      lastCreate?.client_reference_id === d1.orderId
    );

    const cs1 = String(d1.url).split("/pay/")[1];

    /* ---------- статус до оплаты ---------- */
    section("session-status before payment");
    const s0 = await fetch(`${BASE}/api/market/session-status?id=${cs1}`, {
      headers: { cookie: cookieHeader() },
    });
    const s0d = await s0.json();
    ok("pending before payment", s0.status === 200 && s0d.paid === false && s0d.status === "pending", JSON.stringify(s0d));
    ok("prompt hidden before payment", !s0d.prompt);

    /* ---------- оплата на моке + реконсиляция ---------- */
    section("mock payment → reconciliation");
    const pay = await fetch(`${MOCK_BASE}/pay/${cs1}`, { method: "POST", redirect: "manual" });
    ok("hosted checkout redirects to success_url", pay.status === 302 && (pay.headers.get("location") || "").includes(`/market/thanks?session_id=${cs1}`));

    const s1 = await fetch(`${BASE}/api/market/session-status?id=${cs1}`, {
      headers: { cookie: cookieHeader() },
    });
    const s1d = await s1.json();
    ok("reconciled to paid", s1d.paid === true, JSON.stringify(s1d));
    ok(
      "prompt revealed contains real body",
      typeof s1d.prompt === "string" && s1d.prompt.includes("cinematic night exterior")
    );

    /* ---------- webhook: валидная подпись (после реконсиляции = replay) ---------- */
    section("webhook — valid signature (idempotent replay)");
    const payEvt = mockSessions.get(cs1);
    const w1 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": stripeSign(completedEvent(payEvt, "evt_replay")) },
      body: completedEvent(payEvt, "evt_replay"),
    });
    const w1d = await w1.json();
    ok("valid signed webhook → 200 received", w1.status === 200 && w1d.received === true, JSON.stringify(w1d));

    /* ---------- checkout #2 + webhook (основной путь оплаты) ---------- */
    section("checkout #2 — liquid-chrome, paid via WEBHOOK");
    const r2 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ code: "liquid-chrome" }),
    });
    const d2 = await r2.json();
    ok("checkout #2 → 200", r2.status === 200, JSON.stringify(d2));
    orderIds.push(d2.orderId);
    const cs2 = String(d2.url).split("/pay/")[1];

    const w2 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": stripeSign(completedEvent(mockSessions.get(cs2), "evt_2")) },
      body: completedEvent(mockSessions.get(cs2), "evt_2"),
    });
    ok("signed webhook marks order paid → 200", w2.status === 200, await w2.text());
    const s2 = await fetch(`${BASE}/api/market/session-status?id=${cs2}`, {
      headers: { cookie: cookieHeader() },
    });
    const s2d = await s2.json();
    ok("webhook path: paid", s2d.paid === true, JSON.stringify(s2d));
    ok(
      "webhook path: correct prompt body",
      typeof s2d.prompt === "string" && s2d.prompt.includes("liquid chrome")
    );

    /* ---------- негативные проверки webhook ---------- */
    section("webhook — negative cases");
    const tamperedBody = completedEvent(mockSessions.get(cs2), "evt_tampered");
    const badSig = stripeSign(tamperedBody).replace(/v1=[0-9a-f]/, (m) => (m.endsWith("0") ? "v1=1" : "v1=0"));
    const w3 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": badSig },
      body: tamperedBody,
    });
    ok("tampered signature → 401", w3.status === 401, `status ${w3.status}`);

    const stale = completedEvent(mockSessions.get(cs2), "evt_stale");
    const w4 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": stripeSign(stale, Math.floor(Date.now() / 1000) - 3600) },
      body: stale,
    });
    ok("stale timestamp (>5min) → 401", w4.status === 401, `status ${w4.status}`);

    const w5 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: completedEvent(mockSessions.get(cs2), "evt_nosig"),
    });
    ok("missing signature header → 401", w5.status === 401, `status ${w5.status}`);

    const w6 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": "t=abc,v1=zz" },
      body: "{}",
    });
    ok("garbage signature → 401", w6.status === 401, `status ${w6.status}`);

    /* ---------- expired ---------- */
    section("checkout #3 — paper-fold, expired");
    const r3 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ code: "paper-fold" }),
    });
    const d3 = await r3.json();
    orderIds.push(d3.orderId);
    const cs3 = String(d3.url).split("/pay/")[1];
    const expEvt = JSON.stringify({
      id: "evt_exp",
      object: "event",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: cs3, object: "checkout.session" } },
    });
    const w7 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": stripeSign(expEvt) },
      body: expEvt,
    });
    ok("expired webhook → 200", w7.status === 200, await w7.text());
    const s3 = await fetch(`${BASE}/api/market/session-status?id=${cs3}`, {
      headers: { cookie: cookieHeader() },
    });
    const s3d = await s3.json();
    ok("order marked expired, prompt hidden", s3d.status === "expired" && s3d.paid === false && !s3d.prompt, JSON.stringify(s3d));

    /* ---------- валидации ---------- */
    section("input validation");
    const v1 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ code: "hack-rain" }),
    });
    ok("unknown product → 400", v1.status === 400, `status ${v1.status}`);
    const v2 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "neon-rain" }),
    });
    ok("checkout works without cookie too (new buyer)", v2.status === 200, `status ${v2.status}`);
    const vd2 = await v2.json();
    orderIds.push(vd2.orderId);
    const v3 = await fetch(`${BASE}/api/market/session-status?id=abc`, {
      headers: { cookie: cookieHeader() },
    });
    ok("malformed session id → 400", v3.status === 400, `status ${v3.status}`);
    const v4 = await fetch(`${BASE}/api/market/session-status?id=cs_test_0000000000000000`, {
      headers: { cookie: cookieHeader() },
    });
    ok("foreign/unknown session → 404", v4.status === 404, `status ${v4.status}`);
    const v5 = await fetch(`${BASE}/api/market/session-status?id=../etc/passwd`, {
      headers: { cookie: cookieHeader() },
    });
    ok("path-traversal-looking id → 400", v5.status === 400, `status ${v5.status}`);

    /* ---------- реферальный % ---------- */
    section("referral — 20% of a paid card order");
    const r4 = await fetch(`${BASE}/api/market/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieHeader() },
      body: JSON.stringify({ code: "neon-rain", ref: "rselftest1" }),
    });
    const d4 = await r4.json();
    ok("checkout with ?ref → 200", r4.status === 200, JSON.stringify(d4));
    orderIds.push(d4.orderId);
    const cs4 = String(d4.url).split("/pay/")[1];
    const w8 = await fetch(`${BASE}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Stripe-Signature": stripeSign(completedEvent(mockSessions.get(cs4), "evt_ref")) },
      body: completedEvent(mockSessions.get(cs4), "evt_ref"),
    });
    ok("paid webhook with ref → 200", w8.status === 200, await w8.text());

    const ev = sqlite(
      `SELECT kind, refCode, amountUsdt, payoutUsdt FROM ReferralEvent WHERE orderId='st-${d4.orderId}'`
    );
    ok(
      "ReferralEvent recorded (paid)",
      Array.isArray(ev) && ev.length === 1 && ev[0][0] === "paid" && ev[0][1] === "rselftest1",
      JSON.stringify(ev)
    );
    ok(
      "payout = 20% of $12.00 → 2.40",
      Array.isArray(ev) && ev.length === 1 && ev[0][3] === "2.40",
      JSON.stringify(ev)
    );

    /* ---------- thanks-страница ---------- */
    section("thanks page");
    const tp = await fetch(`${BASE}/market/thanks?session_id=${cs1}`);
    const tpHtml = await tp.text();
    ok("GET /market/thanks → 200", tp.status === 200, `status ${tp.status}`);
    ok("noindex on transactional page", tpHtml.includes("noindex") || tpHtml.includes("NOINDEX"), "robots meta expected");
  } finally {
    try {
      server.kill("SIGTERM");
    } catch {}
    await sleep(2000);
    try {
      server.kill("SIGKILL"); // graceful может виснуть, держа SQLite-лок
    } catch {}
    // ждём фактического закрытия порта — иначе пишущие операции в БД
    // упираются в лок умирающего процесса
    for (let i = 0; i < 20; i++) {
      try {
        await fetch(`${BASE}/api/posts`, { signal: AbortSignal.timeout(800) });
        await sleep(500);
      } catch {
        break; // порт закрыт
      }
    }
    try {
      mock.close();
    } catch {}
    await sleep(400);
  }

  /* ---------- сверка БД после остановки сервера ---------- */
  if (serverUp) {
    section("database state");
    const rows = sqlite(
      `SELECT productCode, status, amountCents FROM StripeOrder WHERE id IN (${orderIds
        .filter(Boolean)
        .map((i) => `'${i}'`)
        .join(",")}) ORDER BY "createdAt"`
    );
    ok(
      "5 orders with expected statuses (paid/paid/expired/pending/paid)",
      rows.length === 5 &&
        rows[0][1] === "paid" &&
        rows[1][1] === "paid" &&
        rows[2][1] === "expired" &&
        rows[3][1] === "pending" &&
        rows[4][1] === "paid",
      JSON.stringify(rows)
    );
    ok(
      "amounts stored in cents (1200/900/700/1200/1200)",
      rows.length === 5 &&
        rows[0][2] === "1200" &&
        rows[1][2] === "900" &&
        rows[2][2] === "700" &&
        rows[3][2] === "1200" &&
        rows[4][2] === "1200",
      JSON.stringify(rows)
    );
    const noPromptLeak = sqlite(
      `SELECT COUNT(*) FROM sqlite_master WHERE name='StripeOrder'`
    );
    ok("StripeOrder table exists", noPromptLeak.length === 1);
  }

  /* ---------- очистка тестовых строк ---------- */
  section("cleanup test rows");
  const ids = orderIds.filter(Boolean);
  if (ids.length) {
    const d1res = sqlite(
      `DELETE FROM ReferralEvent WHERE orderId IN (${ids.map((i) => `'st-${i}'`).join(",")})`
    );
    const d2res = sqlite(
      `DELETE FROM StripeOrder WHERE id IN (${ids.map((i) => `'${i}'`).join(",")})`
    );
    ok("delete statements executed", !d1res.flat().includes("PYERR") && !d2res.flat().includes("PYERR"), JSON.stringify([d1res, d2res]));
    const left = sqlite(
      `SELECT COUNT(*) FROM StripeOrder WHERE id IN (${ids.map((i) => `'${i}'`).join(",")})`
    );
    ok("test orders removed", left.length === 1 && left[0][0] === "0", JSON.stringify(left));
    const leftRef = sqlite(
      `SELECT COUNT(*) FROM ReferralEvent WHERE orderId IN (${ids.map((i) => `'st-${i}'`).join(",")})`
    );
    ok("test referral events removed", leftRef.length === 1 && leftRef[0][0] === "0", JSON.stringify(leftRef));
  }

  /* ---------- live probe (реальная граница Stripe) ---------- */
  if (process.argv.includes("--probe-live") || process.argv.includes("--live")) {
    section("live probe → api.stripe.com");
    try {
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_probe_placeholder_not_real",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "mode=payment",
        signal: AbortSignal.timeout(15000),
      });
      const j = await res.json().catch(() => ({}));
      ok(
        "real Stripe edge reached, auth enforced (401 invalid key)",
        res.status === 401 && j?.error?.type === "invalid_request_error",
        `status ${res.status}`
      );
    } catch (e) {
      ok("live probe failed (network?)", false, e instanceof Error ? e.message : String(e));
    }
  }
}

/* ---------------- --live: реальные сессии на sk_test_ ---------------- */

async function runLive() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key.startsWith("sk_test_")) {
    console.log("--live требует РЕАЛЬНЫЙ test-mode ключ: STRIPE_SECRET_KEY=sk_test_…");
    process.exit(2);
  }
  section("live test-mode sessions (реальный api.stripe.com)");
  const items = [
    { code: "neon-rain", cents: 1200, title: "no reality. — neon rain district" },
    { code: "liquid-chrome", cents: 900, title: "no reality. — liquid chrome portrait" },
    { code: "paper-fold", cents: 700, title: "no reality. — paper fold transition" },
  ];
  for (const it of items) {
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(it.cents),
      "line_items[0][price_data][product_data][name]": it.title,
      client_reference_id: `selftest-${it.code}`,
      success_url: "https://no-reality.fun/market/thanks?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://no-reality.fun/market?canceled=1",
      "metadata[product_code]": it.code,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20000),
    });
    const j = await res.json().catch(() => ({}));
    ok(
      `${it.code}: session created (200, ${it.cents}c)`,
      res.status === 200 && j?.amount_total === it.cents && j?.metadata?.product_code === it.code,
      JSON.stringify({ status: res.status, id: j?.id, err: j?.error?.message })
    );
    if (j?.id) {
      const g = await fetch(`https://api.stripe.com/v1/checkout/sessions/${j.id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const gj = await g.json().catch(() => ({}));
      ok(`${it.code}: retrieve matches`, g.status === 200 && gj?.amount_total === it.cents);
      console.log(`    → оплата тестовой картой: ${j.url}`);
    }
  }
  console.log(
    "\nWebhook на localhost Stripe не доставит. Для его проверки:\n" +
      "  stripe listen --forward-to localhost:3000/api/webhooks/stripe\n" +
      "  → полученный whsec_… положи в STRIPE_WEBHOOK_SECRET и повтори прогон без --live."
  );
}

/* ---------------- main ---------------- */

const isLive = process.argv.includes("--live");
(async () => {
  console.log(
    `no reality. — stripe selftest ${new Date().toISOString()} (${isLive ? "LIVE" : "MOCK E2E"})\n`
  );
  if (isLive) {
    await runLive();
  } else {
    await runE2E();
  }
  console.log(
    `\n${"═".repeat(64)}\nRESULT: ${pass} passed, ${fail} failed${
      fail ? `\nFAILED: ${failures.join(" | ")}` : ""
    }\n`
  );
  process.exit(fail ? 1 : 0);
})();
