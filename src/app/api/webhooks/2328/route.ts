import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  parse2328Webhook,
  verifyPaymentWebhook,
  verifyPayoutWebhook,
  isPaidStatus,
} from "@/lib/2328/webhook";
import { confirmBetPayment, failBetPayment } from "@/lib/bet/core";
import { trackEvent } from "@/lib/bet/events";
import { confirmBoostPayment, failBoostPayment } from "@/lib/boost-order";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/2328 — единая точка приёма webhook'ов 2328.io.
 *
 * v14 КАССА: ровно два новых контура —
 *   eye-*  пачки EYE (100=1 / 300=2.5 / 1000=7 USDT): paid → EYE в игровой
 *          леджер ОДИН раз (refKey pack:<orderId>); инвойс НЕ минтит $NR
 *          и НЕ пишет сезонный вес. Пригласившему (если revshare включён)
 *          сразу капает 20% от суммы пачки в USDT; если не включён —
 *          сгорает (учёт burned, не пересчитывается задним числом).
 *   rev-*  разблокировка процента: ровно 3 USDT, один раз; paid →
 *          revshare=true. Самоприглашение невозможен по конструкции
 *          инвойса (rev-<свой accountId> создаётся только для себя).
 *
 * ЛЕГАси-контуры (rb- ставки, bs- бусты, dp- пополнения) продолжают
 * обрабатываться, чтобы инвойсы в полёте дошли; новые dp-инвойсы
 * сервер больше не создаёт.
 *
 * Безопасность (по инвариантам документации 2328):
 * 1. Верифицируем HMAC: payment-webhook — PAYMENT-ключом, payout-webhook —
 *    PAYOUT-ключом. Подпись не сошлась → 401 и никаких изменений в БД.
 * 2. Идемпотентность по order_id: перевод статуса делаем через updateMany
 *    с условием "из pending" — повторный webhook найдёт 0 строк → 200.
 * 3. Redirect'ы и клиентский поллинг деньгами не считаются: settle только
 *    здесь, по подписанному payload'у.
 * 4. Каждое событие логируется (Vercel logs) — аудит движений денег.
 */

function log(event: string, fields: Record<string, unknown>) {
  console.log(`[webhook2328] ${event}`, JSON.stringify(fields));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parse2328Webhook(body);

  // --- проверка подписи РОВНО тем ключом, который отвечает за тип события ---
  let verified = false;
  if (parsed.type === "payment") verified = verifyPaymentWebhook(body);
  else if (parsed.type === "payout") verified = verifyPayoutWebhook(body);

  if (!verified) {
    log("signature_rejected", { type: parsed.type });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parsed.type === "payment") {
    await handlePayment(parsed.data);
  } else if (parsed.type === "payout") {
    // v14: кэшаут-выплат нет («Выкупа очков нет») — payout-webhook только лог
    log("payout_ignored", { orderId: parsed.data.orderId, status: parsed.data.status });
  }

  // 2328 ждёт быстрый 200: всё, что упало внутри, залогировано
  return NextResponse.json({ ok: true });
}

/* ------------------------------------------------------------------ */
/*  Платёж: подтверждение оплаты / финализация отказа                  */
/* ------------------------------------------------------------------ */

async function handlePayment(p: {
  uuid: string;
  orderId: string;
  paymentStatus: string;
  txid: string | null;
  payerAmount: string | null;
}) {
  /* ---- v14: пачки EYE (order_id = eye-<accountId>-<sku>-<nonce>) ---- */
  if (p.orderId.startsWith("eye-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const r = await confirmPackPaid(p.orderId, p.uuid, p.txid);
      log(r ? "pack_credited" : "pack_unknown", { orderId: p.orderId, uuid: p.uuid });
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failPackOrder(p.orderId);
      log("pack_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("pack_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v14: разблокировка процента (order_id = rev-<accountId>) ---- */
  if (p.orderId.startsWith("rev-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const r = await confirmRevPaid(p.orderId, p.uuid, p.txid);
      log(r ? "revshare_enabled" : "rev_unknown", { orderId: p.orderId, uuid: p.uuid });
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failRevOrder(p.orderId);
      log("rev_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("rev_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v6: пополнения dp-… — легаси (новые не создаются, доезжают) ---- */
  if (p.orderId.startsWith("dp-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const { confirmDepositPayment } = await import("@/lib/account");
      const dep = await confirmDepositPayment(p.uuid, p.orderId, p.txid);
      log(dep ? "deposit_credited_legacy" : "deposit_unknown", {
        orderId: p.orderId,
        uuid: p.uuid,
      });
    } else {
      log("deposit_legacy_skip", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v5: бусты клипов (orderId bs-…) — легаси, доезжают ---- */
  if (p.orderId.startsWith("bs-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const order = await confirmBoostPayment(p.uuid, p.orderId, p.txid);
      log(order ? "boost_payment_confirmed" : "boost_payment_unknown", {
        orderId: p.orderId,
        uuid: p.uuid,
      });
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failBoostPayment(p.uuid, p.orderId);
      log("boost_payment_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("boost_payment_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v2: крипто-ставки rb-… — легаси-контур (новые не создаются) ---- */
  if (p.orderId.startsWith("rb-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const bet = await confirmBetPayment(p.uuid, p.orderId);
      log(bet ? "bet_payment_confirmed" : "bet_payment_unknown", {
        orderId: p.orderId,
        uuid: p.uuid,
      });
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failBetPayment(p.uuid, p.orderId);
      log("bet_payment_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("bet_payment_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  log("payment_unknown_scope", { uuid: p.uuid, orderId: p.orderId, status: p.paymentStatus });
}

/* ------------------------------------------------------------------ */
/*  v14 — касса: пачки + revshare                                      */
/* ------------------------------------------------------------------ */

/**
 * paid по пачке: EYE в игровой леджер ОДИН раз (refKey pack:<orderId>),
 * затем 20% от суммы пачки — пригласившему в USDT-центах:
 *   - revshare включён → refEarnedCents += 20%;
 *   - не включён       → refBurnedCents += 20% (сгорело; задним числом
 *     покупки НЕ пересчитываются).
 * Деньги только что пришли — из очков их не менять, под EYE не печатать.
 * Инвойс НЕ минтит $NR и НЕ пишет сезонный вес.
 */
async function confirmPackPaid(orderId: string, paymentUuid: string, txid: string | null): Promise<boolean> {
  const order = await db.payOrder.findUnique({ where: { orderId } });
  if (!order || order.kind !== "pack") return false;

  const moved = await db.$transaction(async (tx) => {
    const m = await tx.payOrder.updateMany({
      where: { id: order.id, status: "pending" },
      data: { status: "paid", paidAt: new Date(), paymentId: paymentUuid, txid },
    });
    return m.count;
  });
  if (!moved) return false; // повторный webhook — уже начислено

  const { applyLedger } = await import("@/lib/account");
  const credited = await applyLedger(
    order.accountId,
    order.eyeAmount ?? 0,
    "pack_purchase",
    `pack:${order.orderId}`,
    { orderId: order.orderId, sku: order.sku, amountMicros: order.amountMicros }
  );
  log(credited ? "pack_ledger_ok" : "pack_ledger_dup", {
    orderId: order.orderId,
    accountId: order.accountId,
    eyeAmount: order.eyeAmount,
  });

  /* 20% в USDT-центах от суммы пачки */
  const cutCents = Math.floor(order.amountMicros / 10_000 * 0.2); // микро → центы × 20%

  const payer = await db.account.findUnique({
    where: { id: order.accountId },
    select: { referredById: true },
  });
  const inviterId = payer?.referredById ?? null;
  if (inviterId && cutCents > 0) {
    const inviter = await db.account.findUnique({
      where: { id: inviterId },
      select: { revshare: true },
    });
    const field = inviter?.revshare ? "refEarnedCents" : "refBurnedCents";
    await db.account.update({
      where: { id: inviterId },
      data: { [field]: { increment: cutCents } },
    });
    log(inviter?.revshare ? "ref_cut_credited" : "ref_cut_burned", {
      orderId: order.orderId,
      inviterId,
      cutCents,
    });
  }

  void trackEvent("pack_paid", {
    meta: { orderId: order.orderId, sku: order.sku, eyeAmount: order.eyeAmount, inviterId },
  });
  return true;
}

async function failPackOrder(orderId: string): Promise<void> {
  await db.payOrder.updateMany({
    where: { orderId, status: "pending" },
    data: { status: "failed" },
  });
}

/**
 * paid по rev-*: один раз ставит revshare=true (процент включён).
 * Покупки, случившиеся ДО этого, не пересчитываются (burned остаётся).
 */
async function confirmRevPaid(orderId: string, paymentUuid: string, txid: string | null): Promise<boolean> {
  const order = await db.payOrder.findUnique({ where: { orderId } });
  if (!order || order.kind !== "rev") return false;

  const moved = await db.$transaction(async (tx) => {
    const m = await tx.payOrder.updateMany({
      where: { id: order.id, status: "pending" },
      data: { status: "paid", paidAt: new Date(), paymentId: paymentUuid, txid },
    });
    if (!m.count) return false;
    await tx.account.update({
      where: { id: order.accountId },
      data: { revshare: true },
    });
    return true;
  });
  if (moved) {
    void trackEvent("revshare_on", { meta: { orderId: order.orderId } });
  }
  return moved;
}

async function failRevOrder(orderId: string): Promise<void> {
  await db.payOrder.updateMany({
    where: { orderId, status: "pending" },
    data: { status: "failed" },
  });
}
