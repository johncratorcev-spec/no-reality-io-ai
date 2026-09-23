import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  parseStripeEvent,
  verifyStripeWebhook,
  eventSession,
} from "@/lib/stripe/webhook";
import { recordReferralEvent } from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/webhooks/stripe — единственная точка приёма webhook'ов
   Stripe (task 45). Аналог /api/webhooks/2328.

   Безопасность:
   1. Подпись Stripe-Signature проверяется HMAC-SHA256 по СЫРОМУ
      телу (req.text()) секретом STRIPE_WEBHOOK_SECRET этого
      endpoint'а. Не сошлась → 401 и никаких изменений в БД.
   2. Идемпотентность: перевод статуса — updateMany с условием
      «из pending» → повторный/перезатянутый webhook находит 0 строк
      и получает 200. ReferralEvent — upsert по orderId.
   3. Деньги засчитывает ТОЛЬКО этот endpoint (или реконсиляция
      через retrieve, которая живёт в /api/market/session-status);
      редиректы и клиентский поллинг деньгами не считаются.
   4. Каждое событие логируется — аудит платежей в Vercel logs.

   Суммы: ReferralEvent хранит decimal-строки; для Stripe-канала
   пишем USD ("12.00" → payout "2.40" при ставке 20%). Поле
   *_Usdt историческое — это просто «сумма в decimal-строке».
   ================================================================ */

function log(event: string, fields: Record<string, unknown>) {
  console.log(`[webhookStripe] ${event}`, JSON.stringify(fields));
}

/** фиксация оплаты: перевод pending→paid + реферальное начисление.
    Возвращает true, если транзит произошёл именно здесь (не replay). */
async function settlePaid(opts: {
  orderId: string | null;
  sessionId: string;
  paymentIntentId: string | null;
  amountCents: number | null;
  currency: string | null;
  refCodeFallback: string | null;
}): Promise<boolean> {
  const order = await db.stripeOrder.findUnique({
    where: { sessionId: opts.sessionId },
  });

  // сессия не наша (или заказ потерялся при пересборке) — фиксируем и выходим
  if (!order) {
    log("payment_unknown", {
      sessionId: opts.sessionId,
      orderId: opts.orderId,
    });
    return false;
  }

  // страховка расхождения: sessionId ≠ metadata.order_id — доверяем БД,
  // но логируем аномалию
  if (opts.orderId && opts.orderId !== order.id) {
    log("order_id_mismatch", { db: order.id, meta: opts.orderId });
  }

  const updated = await db.stripeOrder.updateMany({
    where: { id: order.id, status: "pending" },
    data: {
      status: "paid",
      paidAt: new Date(),
      paymentIntentId: opts.paymentIntentId,
    },
  });

  if (updated.count === 0) {
    log("payment_replay", { orderId: order.id }); // уже paid/expired — идемпотентно
    return false;
  }

  const amount = ((opts.amountCents ?? order.amountCents) / 100).toFixed(2);
  console.log(
    `[money-op] stripe payment paid: order=${order.id} product=${order.productCode} ` +
      `amount=${amount} ${(opts.currency || order.currency).toUpperCase()} ` +
      `pi=${opts.paymentIntentId ?? "-"} ref=${order.refCode ?? "-"} ` +
      `wallet=${order.buyerWallet ?? "-"} buyer=${order.buyerHash}`
  );

  // реферальный %: тот же реестр, что и для 2328-канала →
  // /api/profile и /api/admin/referrals видят оба канала одинаково
  const refCode = order.refCode || opts.refCodeFallback;
  if (refCode) {
    await recordReferralEvent({
      orderId: `st-${order.id}`,
      refCode,
      kind: "paid",
      amountUsdt: amount,
    });
  }
  return true;
}

export async function POST(req: NextRequest) {
  // СЫРОЕ тело: подпись считается по байтам — req.json() здесь запрещён
  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";

  const check = verifyStripeWebhook(payload, sigHeader, secret);
  if (!check.ok) {
    log("signature_rejected", { reason: check.reason ?? "unknown" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ev = parseStripeEvent(payload);
  if (!ev) {
    log("invalid_event", {});
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    switch (ev.type) {
      case "checkout.session.completed": {
        const s = eventSession(ev);
        if (s && s.payment_status === "paid") {
          await settlePaid({
            orderId: s.metadata?.order_id ?? null,
            sessionId: s.id ?? "",
            paymentIntentId: s.payment_intent ?? null,
            amountCents: typeof s.amount_total === "number" ? s.amount_total : null,
            currency: null,
            refCodeFallback: s.metadata?.ref_code ?? null,
          });
        } else {
          log("completed_unpaid", { id: ev.id });
        }
        break;
      }
      case "checkout.session.expired": {
        const s = eventSession(ev);
        if (s?.id) {
          const upd = await db.stripeOrder.updateMany({
            where: { sessionId: s.id, status: "pending" },
            data: { status: "expired" },
          });
          log("session_expired", { sessionId: s.id, updated: upd.count });
        }
        break;
      }
      default:
        // прочие типы событий принимаем и игнорируем — Stripe это ждёт 200
        log("event_ignored", { type: ev.type, id: ev.id });
    }
  } catch (e) {
    // БД могла моргнуть — Stripe сделает retry с экспоненциальной задержкой
    log("handler_error", {
      type: ev.type,
      id: ev.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Temporary failure — retry expected" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
