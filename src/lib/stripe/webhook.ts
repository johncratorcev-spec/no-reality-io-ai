import { createHmac, timingSafeEqual } from "crypto";

/* ================================================================
   Верификация подписи Stripe webhook (task 45) — официальная схема
   https://docs.stripe.com/webhooks#verify-manually:

     заголовок Stripe-Signature: t=<unix-сек>,v1=<hex>,v1=<hex>…
     подписанное тело:           `${t}.${rawBody}`
     ожидаемая подпись:          HMAC-SHA256(body, whsec_…).hex

   Правила безопасности:
   • сравнение — timingSafeEqual (не утечёт timing-каналом);
   • tolerance 300с по умолчанию — старые payload'ы (replay) отбрасываются;
   • любой v1 из списка подходит (Stripe присылает 1–2 при ротации);
   • секрет — STRIPE_WEBHOOK_SECRET (whsec_…) именно ЭТОГО endpoint'а.

   Модуль не делает сетевых вызовов — чистая криптография,
   полностью покрывается selftest'ом (scripts/stripe_selftest.mjs).
   ================================================================ */

export const DEFAULT_TOLERANCE_SEC = 300;

/** распарсить Stripe-Signature: t и массив v1 (или null, если битый) */
function parseSigHeader(header: string): { t: string; v1: string[] } | null {
  let t: string | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") v1.push(v);
  }
  if (!t || v1.length === 0) return null;
  return { t, v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export interface VerifyResult {
  ok: boolean;
  /** машиночитаемая причина отказа — для логов и selftest'а */
  reason?: "bad_header" | "bad_timestamp" | "signature_mismatch";
}

/**
 * Проверить подпись webhook'а Stripe.
 * payload — СЫРОЕ тело запроса (не JSON.parse!): подпись считается
 * по байтам, любой ре-рендеринг строки ломает v1.
 */
export function verifyStripeWebhook(
  payload: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec: number = DEFAULT_TOLERANCE_SEC
): VerifyResult {
  if (!sigHeader || !secret) return { ok: false, reason: "bad_header" };

  const parsed = parseSigHeader(sigHeader);
  if (!parsed) return { ok: false, reason: "bad_header" };

  const ts = Number(parsed.t);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, reason: "bad_timestamp" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) {
    return { ok: false, reason: "bad_timestamp" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.t}.${payload}`, "utf-8")
    .digest("hex");

  for (const candidate of parsed.v1) {
    if (safeEqualHex(candidate.toLowerCase(), expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}

/* ---------------- события ---------------- */

export interface StripeEvent<T = Record<string, unknown>> {
  id: string; // evt_…
  type: string; // checkout.session.completed | checkout.session.expired | …
  created: number;
  data: { object: T };
}

export function parseStripeEvent<T = Record<string, unknown>>(
  payload: string
): StripeEvent<T> | null {
  try {
    const raw = JSON.parse(payload) as StripeEvent<T>;
    if (typeof raw?.id !== "string" || typeof raw?.type !== "string") {
      return null;
    }
    if (!raw.data || typeof raw.data !== "object") return null;
    return raw;
  } catch {
    return null;
  }
}

/** вытащить checkout.session из события (или null, если это не он) */
export interface SessionObject {
  id?: string;
  payment_status?: string;
  payment_intent?: string;
  amount_total?: number;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
}

export function eventSession(ev: StripeEvent): SessionObject | null {
  const obj = ev.data?.object as Record<string, unknown> | undefined;
  if (!obj || obj.object !== "checkout.session") return null;
  return obj as SessionObject;
}
