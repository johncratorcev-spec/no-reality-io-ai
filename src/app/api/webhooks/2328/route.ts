import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  parse2328Webhook,
  verifyPaymentWebhook,
  verifyPayoutWebhook,
  isPaidStatus,
} from "@/lib/2328/webhook";
import { is2328PayoutConfigured } from "@/lib/2328/payout";
import { runSinglePayout } from "@/lib/payouts";
import { confirmBetPayment, failBetPayment } from "@/lib/bet/core";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/2328 — единая точка приёма webhook'ов 2328.io.
 *
 * Безопасность (по инвариантам документации 2328):
 * 1. Верифицируем HMAC: payment-webhook — PAYMENT-ключом, payout-webhook —
 *    PAYOUT-ключом. Подпись не сошлась → 401 и никаких изменений в БД.
 * 2. Идемпотентность: перевод статуса делаем через updateMany с условием
 *    "из pending" — повторный (захардкоженный/перезатянутый) webhook
 *    найдёт 0 строк и просто получит 200.
 * 3. Redirect'ы и клиентский поллинг деньгами не считаются: settle только
 *    здесь, по подписанному payload'у.
 * 4. Каждое событие логируем (видно в Vercel logs) — аудит платежей/выплат.
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
    await handlePayout(parsed.data);
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
  /* ---- v2: ставки REAL/SYNTH (orderId rb-…) идут в свой контур ----
      Покупки промптов (pd-…) обрабатываются ниже; rb-* сюда не заходит,
      чтобы Bet не находил Purchase и наоборот. */
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

  const purchase = await db.purchase.findUnique({
    where: { paymentId: p.uuid },
  });

  if (!purchase) {
    // платёж создан не нами (или снапшот-БД перезаписалась) — фиксируем и выходим
    log("payment_unknown", { uuid: p.uuid, orderId: p.orderId, status: p.paymentStatus });
    return;
  }

  // фиксируем последний статус провайдера (без смены жизненного цикла)
  await db.purchase.update({
    where: { id: purchase.id },
    data: { paymentStatus: p.paymentStatus },
  });

  if (isPaidStatus(p.paymentStatus)) {
    // идемпотентный переход pending → paid: повторный webhook даст count 0
    const moved = await db.purchase.updateMany({
      where: { id: purchase.id, status: "pending" },
      data: { status: "paid", paidAt: new Date(), txid: p.txid },
    });
    if (moved.count === 0) {
      log("payment_paid_duplicate_ignored", { orderId: purchase.orderId });
      return;
    }
    log("payment_paid", {
      orderId: purchase.orderId,
      utm: purchase.utmCode,
      amount: purchase.amountUsdt,
      seller: purchase.sellerAmount,
      fee: purchase.platformFee,
    });

    // переводим в очередь выплат; авто-режим платит сразу
    await db.purchase.updateMany({
      where: { id: purchase.id, status: "paid" },
      data: { status: "ready_for_payout" },
    });

    if (process.env.PAYOUT_AUTO === "true" && is2328PayoutConfigured()) {
      try {
        await runSinglePayout(purchase.id);
      } catch (e) {
        // не теряем оплату: покупка остаётся ready_for_payout, выплату
        // можно повторить вручную через /api/admin/payouts
        console.error(
          "[webhook2328] auto-payout failed:",
          e instanceof Error ? e.message : e
        );
      }
    }
    return;
  }

  if (p.paymentStatus === "aml_lock") {
    await db.purchase.updateMany({
      where: { id: purchase.id, status: { in: ["pending", "paid"] } },
      data: { status: "aml_hold" },
    });
    log("payment_aml_lock", { orderId: purchase.orderId });
    return;
  }

  if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
    // cancel = инвойс истёк/отменён; underpaid = финальная недоплата.
    // Промпт НЕ выдаётся — разблокировка смотрит только на платные статусы.
    await db.purchase.updateMany({
      where: { id: purchase.id, status: "pending" },
      data: { status: "failed" },
    });
    log("payment_failed_final", { orderId: purchase.orderId, status: p.paymentStatus });
    return;
  }

  log("payment_intermediate", { orderId: purchase.orderId, status: p.paymentStatus });
}

/* ------------------------------------------------------------------ */
/*  Выплата: завершение / сбой                                         */
/* ------------------------------------------------------------------ */

async function handlePayout(p: {
  uuid: string;
  orderId: string;
  status: string;
  txid: string | null;
  errorType: string | null;
}) {
  const purchase = await db.purchase.findFirst({
    where: { payoutOrderId: p.orderId },
  });

  if (!purchase) {
    log("payout_unknown", { orderId: p.orderId, status: p.status });
    return;
  }

  if (p.status === "completed") {
    const moved = await db.purchase.updateMany({
      where: { id: purchase.id, status: { in: ["ready_for_payout", "payout_sent"] } },
      data: { status: "payout_sent", payoutAt: new Date(), payoutId: p.uuid, txid: p.txid },
    });
    log(moved.count ? "payout_completed" : "payout_completed_duplicate_ignored", {
      orderId: purchase.orderId,
      txid: p.txid,
    });
    return;
  }

  if (p.status === "failed" || p.status === "cancelled") {
    // возвращаем в очередь: следующий прогон создаст НОВУЮ выплату
    // (новый payoutOrderId с номером попытки)
    await db.purchase.updateMany({
      where: { id: purchase.id, status: "payout_sent" },
      data: { status: "ready_for_payout", payoutId: null, payoutOrderId: null },
    });
    log("payout_failed_requeued", { orderId: purchase.orderId, error: p.errorType });
    return;
  }

  log("payout_intermediate", { orderId: purchase.orderId, status: p.status });
}

/* ------------------------------------------------------------------ */
/*  Одна выплата живёт в src/lib/payouts.ts — используется и авто-      */
/*  режимом (PAYOUT_AUTO), и админ-роутом /api/admin/payouts            */
/* ------------------------------------------------------------------ */
