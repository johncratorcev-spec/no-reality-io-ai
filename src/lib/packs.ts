import "server-only";

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { create2328Payment, is2328PaymentConfigured } from "@/lib/2328/payment";

/**
 * v14 — КАССА (ТЗ §Касса): ровно ДВА платежа, инвойс создаёт только сервер.
 *
 * ПАЧКИ (kind="pack", order_id = "eye-" + accountId + "-" + sku + "-" + nonce):
 *   100 EYE = 1 USDT · 300 EYE = 2.5 USDT · 1000 EYE = 7 USDT.
 *   Сумму и число очков выбирает сервер по sku. paid → EYE в игровой
 *   леджер один раз (вебхук). Инвойс НЕ минтит $NR и НЕ пишет вес.
 *
 * РЕФКА (kind="rev", order_id = "rev-" + accountId): ровно 3 USDT, один
 * раз; paid → revshare=true. Создаётся только для СВОЕГО аккаунта
 * (сессия) — самоприглашение не пишется по конструкции.
 *
 * url_callback = https://no-reality.fun/api/webhooks/2328 (PUBLIC_BASE_URL).
 * Редирект ничего не начисляет и статус не включает.
 */

export const PACKS = {
  100: { eye: 100, amountMicros: 1_000_000 },
  300: { eye: 300, amountMicros: 2_500_000 },
  1000: { eye: 1000, amountMicros: 7_000_000 },
} as const;

export type PackSku = keyof typeof PACKS;

export function isPackSku(v: unknown): v is PackSku {
  return v === 100 || v === 300 || v === 1000 || v === "100" || v === "300" || v === "1000";
}

export function base(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://no-reality.fun"
  );
}

export class CashierError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

/** инвойс пачки: сервер выбирает сумму и очки по sku, nonce мешает повторы */
export async function createPackInvoice(accountId: string, sku: PackSku) {
  if (!is2328PaymentConfigured()) {
    throw new CashierError("payments not configured", 503, "payments_disabled");
  }
  const pack = PACKS[sku];
  const nonce = randomBytes(4).toString("hex");
  const orderId = `eye-${accountId}-${sku}-${nonce}`;

  const inv = await create2328Payment({
    amountUsdt: (pack.amountMicros / 1_000_000).toFixed(2),
    orderId,
    urlCallback: `${base()}/api/webhooks/2328`,
    urlReturn: `${base()}/bet`,
    description: `no reality. pack ${sku} EYE`,
    ttlSeconds: 1800,
  });

  await db.payOrder.create({
    data: {
      accountId,
      orderId,
      kind: "pack",
      sku,
      eyeAmount: pack.eye,
      amountMicros: pack.amountMicros,
      paymentId: inv.uuid || null,
    },
  });

  return { orderId, payUrl: inv.payUrl, eye: pack.eye, amountMicros: pack.amountMicros };
}

/** инвойс разблокировки процента: ровно 3 USDT, один раз на аккаунт */
export async function createRevInvoice(accountId: string) {
  if (!is2328PaymentConfigured()) {
    throw new CashierError("payments not configured", 503, "payments_disabled");
  }
  const acc = await db.account.findUnique({
    where: { id: accountId },
    select: { revshare: true, refCode: true },
  });
  if (!acc) throw new CashierError("account not found", 404, "no_account");
  if (acc.revshare) {
    throw new CashierError("revshare already active", 409, "already_active");
  }

  /* гард от повторных незакрытых rev-инвойсов: ТЗ фиксирует формат
     order_id = "rev-" + accountId (без nonce) — ровно один раз */
  const orderId = `rev-${accountId}`;
  const inv = await create2328Payment({
    amountUsdt: "3.00",
    orderId,
    urlCallback: `${base()}/api/webhooks/2328`,
    urlReturn: `${base()}/ref`,
    description: "no reality. revshare unlock",
    ttlSeconds: 3600,
  });

  await db.payOrder.upsert({
    where: { orderId: inv.orderId || orderId },
    create: {
      accountId,
      orderId: inv.orderId || orderId,
      kind: "rev",
      amountMicros: 3_000_000,
      paymentId: inv.uuid || null,
    },
    /* повторная попытка после истёкшего инвойса: сбрасываем в pending
       под новым paymentId (вебхук идемпотентен по статусу) */
    update: { status: "pending", paymentId: inv.uuid || null },
  });

  return { payUrl: inv.payUrl, orderId: inv.orderId };
}
