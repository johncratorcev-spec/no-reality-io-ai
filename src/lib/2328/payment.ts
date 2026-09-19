import { sign2328Body } from "./crypto";

/**
 * Payment API 2328.io — приём платежей от покупателей.
 *
 * Использует ТОЛЬКО TWOTHOUSAND328_PAYMENT_API_KEY (+ PROJECT_UUID).
 * Payout-ключ сюда попадать не должен: 2328 отклонит подпись, а смешение
 * ключей делает аудит движений денег невозможным.
 *
 * Hosted Checkout: создаём платёж БЕЗ to_currency/network — покупатель сам
 * выбирает монету/сеть на странице 2328 (result.url). Это рекомендованный
 * документацией паттерн «let the customer choose how to pay».
 */

const BASE =
  process.env.TWOTHOUSAND328_API_BASE || "https://api.2328.io/api";

export class Pay2328ConfigError extends Error {}
export class Pay2328ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown
  ) {
    super(message);
  }
}

function conf(): { key: string; project: string } {
  const key = process.env.TWOTHOUSAND328_PAYMENT_API_KEY || "";
  const project = process.env.TWOTHOUSAND328_PROJECT_UUID || "";
  if (!key || !project) {
    throw new Pay2328ConfigError(
      "2328.io payment credentials are not configured (TWOTHOUSAND328_PAYMENT_API_KEY / TWOTHOUSAND328_PROJECT_UUID)"
    );
  }
  return { key, project };
}

export function is2328PaymentConfigured(): boolean {
  return Boolean(
    process.env.TWOTHOUSAND328_PAYMENT_API_KEY &&
      process.env.TWOTHOUSAND328_PROJECT_UUID
  );
}

async function callApi(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { key, project } = conf();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // User-Agent обязателен: запросы без него 2328 может блокировать
        "User-Agent": "no-reality/1.0 (+https://no-reality.fun)",
        project,
        sign: sign2328Body(body, key),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new Pay2328ApiError(
      "2328.io api unreachable",
      0,
      e instanceof Error ? e.message : String(e)
    );
  }

  const raw = (await res.json().catch(() => ({}))) as {
    state?: number;
    result?: unknown;
    message?: string;
    error?: string;
  };

  // контракт 2328: state === 0 — успех; остальное — ошибка уровня API
  if (!res.ok || raw.state !== 0) {
    throw new Pay2328ApiError(
      raw.message || raw.error || `2328.io api error (${res.status})`,
      res.status,
      raw
    );
  }
  return (raw.result ?? {}) as Record<string, unknown>;
}

export interface Create2328PaymentInput {
  /** цена промпта в USDT — decimal-строка ("3.00"), не float */
  amountUsdt: string;
  /** наш идемпотентный ключ создания платежа ("nr-<purchaseId>") */
  orderId: string;
  /** публичный https-URL нашего webhook'а (обязателен по контракту) */
  urlCallback: string;
  /** куда вернуть покупателя после оплаты (страница поста /v/<code>) */
  urlReturn?: string;
  description?: string;
  /** время жизни инвойса, сек: 300..86400 (по умолчанию 1800) */
  ttlSeconds?: number;
}

export interface Created2328Payment {
  uuid: string;
  orderId: string;
  payUrl: string;
  expiresAt: string | null;
  paymentStatus: string;
}

export async function create2328Payment(
  input: Create2328PaymentInput
): Promise<Created2328Payment> {
  const body: Record<string, unknown> = {
    amount: input.amountUsdt,
    currency: "USDT",
    order_id: input.orderId,
    url_callback: input.urlCallback,
    ttl_seconds: input.ttlSeconds ?? 1800,
  };
  if (input.urlReturn) body.url_return = input.urlReturn;
  if (input.description) body.description = input.description.slice(0, 200);

  const result = await callApi("/v1/payment", body);

  return {
    uuid: String(result.uuid ?? ""),
    orderId: String(result.order_id ?? input.orderId),
    payUrl: String(result.url ?? ""),
    expiresAt: (result.expires_at as string) ?? null,
    paymentStatus: String(result.payment_status ?? "pending"),
  };
}

/** Статус платежа по uuid или order_id (реконсиляция при потерянном webhook). */
export async function get2328PaymentInfo(
  ref: { uuid?: string; orderId?: string }
): Promise<Record<string, unknown> | null> {
  const body: Record<string, unknown> = {};
  if (ref.uuid) body.uuid = ref.uuid;
  if (ref.orderId) body.order_id = ref.orderId;
  if (!body.uuid && !body.order_id) return null;
  return callApi("/v1/payment/info", body);
}
