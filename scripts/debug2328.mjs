#!/usr/bin/env node
/**
 * Диагностика 2328.io: прямой вызов create payment с ПОЛНЫМ ответом API.
 * Использует .env.local (TWOTHOUSAND328_*). Никаких зависимостей — node:crypto + fetch.
 * Запуск: node scripts/debug2328.mjs
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const KEY = env.TWOTHOUSAND328_PAYMENT_API_KEY;
const PROJECT = env.TWOTHOUSAND328_PROJECT_UUID;
const BASE = "https://api.2328.io/api";

console.log(`project: ${PROJECT}`);
console.log(`key: ${KEY.slice(0, 8)}…${KEY.slice(-4)} (len ${KEY.length})`);

function sign(body, apiKey) {
  const b64 = Buffer.from(JSON.stringify(body), "utf-8").toString("base64");
  return createHmac("sha256", apiKey).update(b64, "utf-8").digest("hex");
}

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "no-reality/1.0 (+https://no-reality.fun)",
      project: PROJECT,
      sign: sign(body, KEY),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  console.log(`\n=== POST ${path} → ${res.status} ${res.statusText}`);
  console.log("headers:", Object.fromEntries([...res.headers].filter(([k]) => ["content-type","www-authenticate","x-request-id","cf-ray","server"].includes(k))));
  console.log("body:", text.slice(0, 800));
  return { status: res.status, text };
}

/* 1. пробуем создать платёж как в lib */
await call("/v1/payment", {
  amount: "3.00",
  currency: "USDT",
  order_id: `don-diag${Math.random().toString(36).slice(2, 8)}`,
  url_callback: "https://no-reality.fun/api/webhooks/2328",
  url_return: "https://no-reality.fun/v/71vsIPUu",
  description: "no reality. donation — test",
  ttl_seconds: 1800,
});
