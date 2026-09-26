import { verify2328Sign } from "./crypto";

/**
 * Webhook'и 2328.io — единая точка проверки подписей.
 *
 * КРИТИЧНО: у 2328 ДВА ключа подписи webhook'ов:
 * - payment/static-wallet webhook'и → обычный API key;
 * - payout webhook'и               → отдельный Payout API key.
 * Подпись, проверенная не тем ключом, просто не сойдётся — поэтому перед
 * проверкой нужно определить тип payload'а по форме полей.
 *
 * Формат тела: платёжный webhook повторяет /v1/payment/info + sign,
 * payout webhook повторяет GET /v1/payout/status + sign.
 */

export interface PaymentWebhook2328 {
  kind: "payment";
  uuid: string;
  orderId: string;
  paymentStatus: string; // pending|check|paid|underpaid_check|underpaid|overpaid|cancel|aml_lock
  txid: string | null;
  amount: string | null;
  currency: string | null;
  payerAmount: string | null;
  payerCurrency: string | null;
  merchantAmount: string | null;
}

export interface PayoutWebhook2328 {
  kind: "payout";
  uuid: string;
  orderId: string;
  status: string; // pending|completed|failed|cancelled
  txid: string | null;
  errorType: string | null;
}

export type Parsed2328Webhook =
  | { type: "payment"; data: PaymentWebhook2328 }
  | { type: "payout"; data: PayoutWebhook2328 }
  | { type: "unknown" };

/** Финальные «деньги получены»-статусы платежа. */
export function isPaidStatus(s: string): boolean {
  return s === "paid" || s === "overpaid";
}

export function parse2328Webhook(
  body: Record<string, unknown>
): Parsed2328Webhook {
  const sign = typeof body.sign === "string" ? body.sign : "";

  // payout: есть status + to_address, нет payment_status
  if (typeof body.status === "string" && "to_address" in body) {
    return {
      type: "payout",
      data: {
        kind: "payout",
        uuid: String(body.uuid ?? ""),
        orderId: String(body.order_id ?? ""),
        status: body.status,
        txid: (body.txid as string) ?? null,
        errorType: (body.error_type as string) ?? null,
      },
    };
  }

  // payment: есть payment_status
  if (typeof body.payment_status === "string") {
    return {
      type: "payment",
      data: {
        kind: "payment",
        uuid: String(body.uuid ?? ""),
        orderId: String(body.order_id ?? ""),
        paymentStatus: body.payment_status,
        txid: (body.txid as string) ?? null,
        amount: (body.amount as string) ?? null,
        currency: (body.currency as string) ?? null,
        payerAmount: (body.payer_amount as string) ?? null,
        payerCurrency: (body.payer_currency as string) ?? null,
        merchantAmount: (body.merchant_amount as string) ?? null,
      },
    };
  }

  void sign;
  return { type: "unknown" };
}

/** Проверка подписи payment-webhook обычным API-ключом. */
export function verifyPaymentWebhook(
  body: Record<string, unknown>
): boolean {
  const sign = typeof body.sign === "string" ? body.sign : "";
  const key = process.env.TWOTHOUSAND328_PAYMENT_API_KEY || "";
  if (!key) return false;
  return verify2328Sign(body, sign, key);
}

/** Проверка подписи payout-webhook payout-ключом. */
export function verifyPayoutWebhook(
  body: Record<string, unknown>
): boolean {
  const sign = typeof body.sign === "string" ? body.sign : "";
  const key = process.env.TWOTHOUSAND328_PAYOUT_API_KEY || "";
  if (!key) return false;
  return verify2328Sign(body, sign, key);
}

/** payout-webhook'и смогут верифицироваться (ключ задан). */
export function is2328WebhookConfigured(): boolean {
  return Boolean(process.env.TWOTHOUSAND328_PAYOUT_API_KEY);
}
