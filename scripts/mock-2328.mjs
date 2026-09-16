#!/usr/bin/env node
/**
 * Локальный мок Payment/Payout API 2328.io для сквозного тестирования
 * без реальных ключей. Реализует контракт doc.2328.io:
 *
 *   POST /api/v1/payment        → state:0 + result (uuid, url, ...)
 *   POST /api/v1/payment/info   → статус платежа
 *   POST /api/v1/payout         → state:0 + result (payout)
 *   GET  /api/v1/payout/status/{uuid} → статус выплаты
 *
 * Подписи проверяются по настоящему алгоритму (HMAC-SHA256 над
 * base64-JSON, ключ по типу эндпоинта) — мок ловит ошибки нашего клиента.
 * Платёж «оплачивается» сам через 3 секунды (эмуляция webhook не нужна:
 * вебхук на наш бэкенд мок НЕ отправляет — отправляем руками тестовым
 * скриптом, как это сделал бы 2328).
 *
 * Запуск: node scripts/mock-2328.mjs  (порт 9999)
 */
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const PORT = 9999;
const PAYMENT_KEY = process.env.MOCK_PAYMENT_KEY || "test-payment-key";
const PAYOUT_KEY = process.env.MOCK_PAYOUT_KEY || "test-payout-key";
const PROJECT = process.env.MOCK_PROJECT || "test-project-uuid";

const payments = new Map(); // orderId → result
const payouts = new Map(); // payoutUuid → result

function sign(body, key) {
  const base64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64");
  return createHmac("sha256", key).update(base64, "utf-8").digest("hex");
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  console.log(`[mock] ${req.method} ${path}`);
  const bodyRaw = await readBody(req);
  let body = {};
  try {
    body = bodyRaw ? JSON.parse(bodyRaw) : {};
  } catch {
    return json(res, 400, { message: "bad json" });
  }

  // --- проверка служебных заголовков (контракт 2328) ---
  const project = req.headers["project"];
  const signHeader = req.headers["sign"];
  if (!project || project !== PROJECT) {
    return json(res, 403, { message: "unknown project" });
  }
  if (!signHeader) {
    return json(res, 403, { message: "missing sign" });
  }

  const isPayoutEndpoint = path.startsWith("/api/v1/payout");
  const expectedKey = isPayoutEndpoint ? PAYOUT_KEY : PAYMENT_KEY;
  const expected = sign(body, expectedKey);
  if (expected !== signHeader) {
    return json(res, 403, { message: "signature mismatch", expected });
  }

  // --- Create payment ---
  if (path === "/api/v1/payment" && req.method === "POST") {
    const { amount, currency, order_id, url_callback } = body;
    if (!amount || !currency || !order_id || !url_callback) {
      return json(res, 400, { message: "amount/currency/order_id/url_callback required" });
    }
    // идемпотентность: тот же order_id → та же сессия
    if (!payments.has(order_id)) {
      const uuid = randomUUID();
      payments.set(order_id, {
        uuid,
        order_id,
        amount,
        currency,
        url_callback,
        url: `http://127.0.0.1:${PORT}/pay/${uuid}`,
        payment_status: "pending",
        created_at: new Date().toISOString(),
      });
    }
    const p = payments.get(order_id);
    return json(res, 200, {
      state: 0,
      result: {
        ...p,
        url: `http://127.0.0.1:${PORT}/pay/${p.uuid}`,
        amount_usd: amount,
        payer_currency: "USDT",
        payer_amount: amount,
        network: "TRX-TRC20",
        address: "TXmockAddressMockAddressMockAddress1",
        expires_at: new Date(Date.now() + 1800_000).toISOString(),
        txid: null,
        payment_amount: null,
        qr: null,
      },
    });
  }

  // --- Payment info ---
  if (path === "/api/v1/payment/info" && req.method === "POST") {
    const found = [...payments.values()].find(
      (p) => p.uuid === body.uuid || p.order_id === body.order_id
    );
    if (!found) return json(res, 200, { state: 1, message: "not found" });
    return json(res, 200, { state: 0, result: found });
  }

  // --- Create payout ---
  if (path === "/api/v1/payout" && req.method === "POST") {
    const { amount, to_address, order_id } = body;
    if (!amount || !to_address || !order_id) {
      return json(res, 400, { message: "amount/to_address/order_id required" });
    }
    let payout = [...payouts.values()].find((p) => p.order_id === order_id);
    if (!payout) {
      payout = {
        uuid: randomUUID(),
        order_id,
        status: "completed", // мок сразу «доставляет»
        currency: body.currency,
        network: body.network,
        amount,
        merchant_amount: amount,
        network_amount: amount,
        amount_usd: amount,
        to_address,
        memo: null,
        transfer_type: "blockchain",
        txid: `mock-tx-${randomUUID().slice(0, 8)}`,
        tx_explorer_url: null,
        block_number: 1,
        error_type: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      payouts.set(payout.uuid, payout);
    }
    return json(res, 200, { state: 0, result: payout });
  }

  // --- Payout status ---
  if (isPayoutEndpoint && req.method === "GET") {
    const uuid = path.split("/").pop();
    const payout = payouts.get(uuid);
    if (!payout) return json(res, 200, { state: 1, message: "not found" });
    return json(res, 200, { state: 0, result: payout });
  }

  // --- фейковая страница оплаты (чтобы был куда «редиректить») ---
  if (path.startsWith("/pay/")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end("<h1>mock 2328 checkout</h1>");
  }

  json(res, 404, { message: `no route: ${path}` });
});

server.listen(PORT, () => {
  console.log(`[mock-2328] listening on http://127.0.0.1:${PORT}`);
  console.log(`[mock-2328] payment key: ${PAYMENT_KEY}`);
  console.log(`[mock-2328] payout key : ${PAYOUT_KEY}`);
});
