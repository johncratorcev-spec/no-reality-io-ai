import { NextRequest, NextResponse } from "next/server";
import {
  parse2328Webhook,
  verifyPaymentWebhook,
  verifyPayoutWebhook,
  isPaidStatus,
} from "@/lib/2328/webhook";
import { confirmBetPayment, failBetPayment } from "@/lib/bet/core";
import { trackEvent } from "@/lib/bet/events";
import { confirmBoostPayment, failBoostPayment } from "@/lib/boost-order";
import { confirmDepositPayment, failDepositOrder } from "@/lib/account";
import { unclaimBetPayout } from "@/lib/bet/cashout";

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
  /* ---- v5: бусты клипов (orderId bs-…) идут в свой контур ---- */
  if (p.orderId.startsWith("bs-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const order = await confirmBoostPayment(p.uuid, p.orderId, p.txid);
      log(order ? "boost_payment_confirmed" : "boost_payment_unknown", {
        orderId: p.orderId,
        uuid: p.uuid,
      });
      if (order) {
        void trackEvent("boost_purchase", {
          clipCode: order.clipCode,
          meta: { orderId: p.orderId, amountUsdt: order.amountUsdt, days: order.days },
        });
      }
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failBoostPayment(p.uuid, p.orderId);
      log("boost_payment_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("boost_payment_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v6: пополнения внутреннего баланса (orderId dp-…) ----
      Источник истины баланса — только подписанный webhook: зачисление
      идемпотентно (refKey deposit:<uuid>), поллинг клиента деньгами
      не управляет. */
  if (p.orderId.startsWith("dp-")) {
    if (isPaidStatus(p.paymentStatus)) {
      const dep = await confirmDepositPayment(p.uuid, p.orderId, p.txid);
      log(dep ? "deposit_credited" : "deposit_unknown", {
        orderId: p.orderId,
        uuid: p.uuid,
        amountCents: dep?.amountCents ?? null,
      });
      if (dep) {
        void trackEvent("deposit_paid", {
          meta: { orderId: p.orderId, amountCents: dep.amountCents },
        });
      }
    } else if (p.paymentStatus === "cancel" || p.paymentStatus === "underpaid") {
      await failDepositOrder(p.uuid, p.orderId);
      log("deposit_failed_final", { orderId: p.orderId, status: p.paymentStatus });
    } else {
      log("deposit_intermediate", { orderId: p.orderId, status: p.paymentStatus });
    }
    return;
  }

  /* ---- v2: ставки REAL/SYNTH (orderId rb-…) идут в свой контур ---- */
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
/*  Выплата: завершение / сбой (кэшаут выигрыша bw-…)                  */
/* ------------------------------------------------------------------ */

async function handlePayout(p: {
  uuid: string;
  orderId: string;
  status: string;
  txid: string | null;
  errorType: string | null;
}) {
  /* ---- кэшаут выигрыша игрока (bw-…) — свой контур ---- */
  if (p.orderId.startsWith("bw-")) {
    if (p.status === "completed") {
      log("bet_cashout_completed", { orderId: p.orderId, txid: p.txid });
    } else if (p.status === "failed" || p.status === "cancelled") {
      const n = await unclaimBetPayout(p.orderId, p.errorType || p.status);
      log(n ? "bet_cashout_reverted" : "bet_cashout_revert_noop", {
        orderId: p.orderId,
        bets: n,
        error: p.errorType,
      });
    } else {
      log("bet_cashout_intermediate", { orderId: p.orderId, status: p.status });
    }
    return;
  }

  log("payout_unknown", { orderId: p.orderId, status: p.status });
}
