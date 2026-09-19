import { sign2328Body } from "./crypto";

/**
 * Payout API 2328.io — выплаты авторам (USDT на кошелёк автора).
 *
 * Использует ТОЛЬКО TWOTHOUSAND328_PAYOUT_API_KEY. Это отдельный ключ,
 * потому что он даёт право выводить деньги с мерчант-баланса: утечка
 * payment-ключа не должна позволить слить баланс.
 *
 * fee_option: "add" — комиссии сверху, автор получает РОВНО seller_amount
 * (мерчант платит seller_amount + fee). Для выплат авторам это честный
 * вариант: «2.25 USDT — значит 2.25 на кошелёк».
 */

const BASE =
  process.env.TWOTHOUSAND328_API_BASE || "https://api.2328.io/api";

export class Payout2328ConfigError extends Error {}
export class Payout2328ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown
  ) {
    super(message);
  }
}

function conf(): { key: string; project: string } {
  const key = process.env.TWOTHOUSAND328_PAYOUT_API_KEY || "";
  const project = process.env.TWOTHOUSAND328_PROJECT_UUID || "";
  if (!key || !project) {
    throw new Payout2328ConfigError(
      "2328.io payout credentials are not configured (TWOTHOUSAND328_PAYOUT_API_KEY / TWOTHOUSAND328_PROJECT_UUID)"
    );
  }
  return { key, project };
}

export function is2328PayoutConfigured(): boolean {
  return Boolean(
    process.env.TWOTHOUSAND328_PAYOUT_API_KEY &&
      process.env.TWOTHOUSAND328_PROJECT_UUID
  );
}

export interface Create2328PayoutInput {
  /** сумма автору в USDT — decimal-строка ("2.250000") */
  amountUsdt: string;
  /** USDT-кошелёк автора (TRC20/ERC20/…) */
  toAddress: string;
  /** сеть выплат; по умолчанию TRX-TRC20 (самая дешёвая для USDT) */
  network?: string;
  /** идемпотентный ключ ВЫПЛАТЫ; включаем номер попытки для ретраев */
  orderId: string;
  /** webhook о статусе выплаты (проверяется payout-ключом) */
  urlCallback?: string;
}

export interface Created2328Payout {
  uuid: string;
  orderId: string;
  status: string;
}

export async function create2328Payout(
  input: Create2328PayoutInput
): Promise<Created2328Payout> {
  const { key, project } = conf();

  const body: Record<string, unknown> = {
    currency: "USDT",
    network: input.network || "TRX-TRC20",
    amount: input.amountUsdt,
    to_address: input.toAddress,
    order_id: input.orderId,
    fee_option: "add",
  };
  if (input.urlCallback) body.url_callback = input.urlCallback;

  let res: Response;
  try {
    res = await fetch(`${BASE}/v1/payout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "no-reality/1.0 (+https://no-reality.fun)",
        project,
        sign: sign2328Body(body, key),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new Payout2328ApiError(
      "2328.io payout api unreachable",
      0,
      e instanceof Error ? e.message : String(e)
    );
  }

  const raw = (await res.json().catch(() => ({}))) as {
    state?: number;
    result?: Record<string, unknown>;
    message?: string;
    error?: string;
  };
  if (!res.ok || raw.state !== 0) {
    throw new Payout2328ApiError(
      raw.message || raw.error || `2328.io payout error (${res.status})`,
      res.status,
      raw
    );
  }
  const result = raw.result ?? {};
  return {
    uuid: String(result.uuid ?? ""),
    orderId: String(result.order_id ?? input.orderId),
    status: String(result.status ?? "pending"),
  };
}

/** GET /v1/payout/status/{uuid}: подпись пустого тела payout-ключом. */
export async function get2328PayoutStatus(
  payoutUuid: string
): Promise<Record<string, unknown> | null> {
  const { key, project } = conf();

  const res = await fetch(`${BASE}/v1/payout/status/${encodeURIComponent(payoutUuid)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "no-reality/1.0 (+https://no-reality.fun)",
      project,
      sign: sign2328Body(undefined, key),
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const raw = (await res.json().catch(() => ({}))) as {
    state?: number;
    result?: Record<string, unknown>;
  };
  if (!res.ok || raw.state !== 0) return null;
  return raw.result ?? null;
}
