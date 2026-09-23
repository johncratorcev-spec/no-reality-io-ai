import "server-only";

/* ================================================================
   Минимальный клиент Stripe REST API (task 45) — без официального
   SDK, по образцу src/lib/2328/payment.ts.

   Почему без SDK: проект держит платёжные клиенты тонкими и
   прозрачными (запрос → ответ → понятная ошибка), а Checkout
   Sessions использует ровно два вызова — create + retrieve.
   Формат запроса — form-encoded (единственный формат, который
   принимает Stripe), ответ — JSON.

   Test-only override: STRIPE_API_BASE позволяет поднять локальный
   мок Stripe API для E2E (scripts/stripe_selftest.mjs). В проде
   переменная пуста → https://api.stripe.com.

   Ключи: STRIPE_SECRET_KEY (sk_test_… / sk_live_…). Publishable
   ключ для hosted Checkout не нужен — редирект на session.url.
   ================================================================ */

const BASE = (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(
  /\/$/,
  ""
);

export class StripeConfigError extends Error {}

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** error.type из ответа Stripe ("card_error", "invalid_request_error", …) */
    readonly code?: string,
    readonly detail?: unknown
  ) {
    super(message);
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/* ---------------- form-encoding ---------------- */

type Params = Record<string, string | number | undefined | null>;

/** form-urlencoded с encoded-скобками — так шлёт и официальный SDK */
function encodeForm(params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

/* ---------------- низкоуровневый вызов ---------------- */

async function callApi<T>(
  method: "GET" | "POST",
  path: string,
  params?: Params
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) {
    throw new StripeConfigError("STRIPE_SECRET_KEY is not configured");
  }

  const url =
    method === "GET" && params
      ? `${BASE}${path}?${encodeForm(params)}`
      : `${BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        // Bearer-аутентификация; form-encoded — родной формат Stripe API
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "no-reality/1.0 (+https://no-reality.fun)",
      },
      body: method === "POST" && params ? encodeForm(params) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new StripeApiError(
      "Stripe API unreachable",
      0,
      undefined,
      e instanceof Error ? e.message : String(e)
    );
  }

  const raw = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; type?: string };
  } & Record<string, unknown>;

  // контракт Stripe: 2xx — объект; иначе { error: { message, type } }
  if (!res.ok || raw.error) {
    throw new StripeApiError(
      raw.error?.message || `Stripe API error (${res.status})`,
      res.status,
      raw.error?.type,
      raw
    );
  }
  return raw as T;
}

/* ---------------- Checkout Sessions ---------------- */

/** Минимально необходимое подмножество объекта Checkout Session. */
export interface StripeSession {
  id: string; // cs_test_… / cs_live_…
  object: "checkout.session";
  amount_total: number | null;
  currency: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired" | null;
  payment_intent: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  /** hosted-страница оплаты (есть сразу после создания) */
  url: string | null;
}

export interface CreateCheckoutInput {
  /** цена в центах (1200 = $12.00) */
  amountCents: number;
  currency: string; // "usd"
  /** название товара на странице оплаты Stripe */
  productName: string;
  /** описание товара (line item description) */
  productDescription: string;
  /** наш id заказа (StripeOrder.id) — идемпотентность и поиск */
  clientReferenceId: string;
  successUrl: string;
  cancelUrl: string;
  /** произвольные метаданные (order_id, product_code, ref_code, …) */
  metadata: Record<string, string>;
  /** время жизни сессии, сек: минимум 1800, максимум 86400 */
  ttlSeconds?: number;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<StripeSession> {
  const ttl = Math.min(Math.max(input.ttlSeconds ?? 3600, 1800), 86400);
  const params: Params = {
    mode: "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": input.currency,
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][price_data][product_data][name]": input.productName,
    "line_items[0][price_data][product_data][description]":
      input.productDescription,
    client_reference_id: input.clientReferenceId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + ttl,
    // metadata доступны и в webhook'е, и в retrieve — дублируем ключевые
    ...Object.fromEntries(
      Object.entries(input.metadata).map(([k, v]) => [`metadata[${k}]`, v])
    ),
    // те же метаданные на PaymentIntent — видны в дашборде Stripe
    ...Object.fromEntries(
      Object.entries(input.metadata).map(([k, v]) => [
        `payment_intent_data[metadata][${k}]`,
        v,
      ])
    ),
  };
  return callApi<StripeSession>("POST", "/v1/checkout/sessions", params);
}

/** Реконсиляция: забрать актуальный статус сессии (потерянный webhook). */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<StripeSession> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    throw new StripeApiError("Malformed session id", 400);
  }
  return callApi<StripeSession>("GET", `/v1/checkout/sessions/${sessionId}`);
}
