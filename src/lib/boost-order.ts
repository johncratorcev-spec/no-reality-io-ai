import { db } from "@/lib/db";

/**
 * Бусты клипов (v5 — Boosted / Featured Clip): инвойс 2328.io → webhook paid
 * → paidUntil = now + days×24h. Ранжирование (getRankedPosts) поднимает клип
 * в топ предикшен-ленты, пока paidUntil в будущем.
 *
 * Идемпотентность — как у ставок: перевод pending → paid через updateMany,
 * повторный webhook находит 0 строк и получает 200.
 * Каждая денежная операция логируется [money-op][boost].
 */

function moneyLog(event: string, fields: Record<string, unknown>) {
  console.log(`[money-op][boost] ${event}`, JSON.stringify(fields));
}

/** цена буста в USDT за день (env BOOST_PRICE_USDT, дефолт $3/день) */
export function boostPricePerDayUsdt(): string {
  const v = Number(process.env.BOOST_PRICE_USDT);
  return Number.isFinite(v) && v >= 0.5 && v <= 1000
    ? v.toFixed(2)
    : "3.00";
}

export const BOOST_DAYS = [1, 3, 7] as const;

export function normalizeBoostDays(raw: unknown): number {
  const n = Number(raw);
  return BOOST_DAYS.includes(n as 1 | 3 | 7) ? n : 1;
}

/** подтверждение оплаты буста из подписанного webhook'а 2328 */
export async function confirmBoostPayment(
  paymentUuid: string,
  orderId: string,
  txid: string | null
) {
  const order = await db.boostOrder.findUnique({ where: { orderId } });
  if (!order) return null;

  const paidUntil = new Date(Date.now() + order.days * 24 * 60 * 60 * 1000);
  const moved = await db.boostOrder.updateMany({
    where: { id: order.id, status: "pending" },
    data: { status: "paid", paidUntil, txid, paymentId: paymentUuid },
  });

  if (moved.count) {
    moneyLog("boost_paid", {
      orderId,
      clip: order.clipCode,
      amountUsdt: order.amountUsdt,
      days: order.days,
      paidUntil: paidUntil.toISOString(),
    });
  }
  return { ...order, paidUntil };
}

/** финальный провал инвойса буста (cancel/underpaid) */
export async function failBoostPayment(paymentUuid: string, orderId: string) {
  const order = await db.boostOrder.findFirst({
    where: { OR: [{ orderId }, { paymentId: paymentUuid }] },
  });
  if (!order) return;
  const moved = await db.boostOrder.updateMany({
    where: { id: order.id, status: "pending" },
    data: { status: "failed" },
  });
  if (moved.count) {
    moneyLog("boost_failed", { orderId, reason: "invoice_failed" });
  }
}

/** активные бусты (paidUntil в будущем) → set кодов клипов */
export async function activeBoostedCodes(): Promise<Set<string>> {
  try {
    const rows = await db.boostOrder.findMany({
      where: { status: "paid", paidUntil: { gt: new Date() } },
      select: { clipCode: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return new Set(rows.map((r) => r.clipCode));
  } catch {
    // БД недоступна — лента работает без буст-ранжирования
    return new Set();
  }
}
