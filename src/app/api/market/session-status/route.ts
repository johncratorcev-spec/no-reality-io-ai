import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { readBuyer, jsonResponse } from "@/lib/buyer";
import { findMarketItem } from "@/lib/market/catalog";
import { getPromptFull } from "@/lib/prompts/paid";
import {
  isStripeConfigured,
  retrieveCheckoutSession,
  StripeApiError,
} from "@/lib/stripe/api";
import { recordReferralEvent } from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/market/session-status?id=cs_test_…
   Статус заказа + (после оплаты) полный текст промпта.

   ЕДИНСТВЕННОЕ место (вместе с webhook'ом), где prompt_full уходит
   клиенту: только оплаченный заказ СВОЕГО покупателя — cookie
   nr_buyer должна совпадать с buyerHash заказа (чужая сессия → 404).

   Реконсиляция: если заказ ещё pending — спрашиваем актуальный
   статус у Stripe (retrieve). Это спасает поток покупателя, когда
   webhook запаздывает/потерялся: payment уже прошёл, а страница
   thanks уже открыта. Webhook остаётся источником истины для денег.
   ================================================================ */

const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

export async function GET(req: NextRequest) {
  const buyer = readBuyer(req);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // страница thanks поллит каждые 2–3с — 30 req/мин с запасом
  const rl = rateLimit(`market-status:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return jsonResponse(buyer, { error: "Too many requests" }, 429);
  }

  const sessionId = req.nextUrl.searchParams.get("id") || "";
  if (!SESSION_RE.test(sessionId)) {
    return jsonResponse(buyer, { error: "Bad session id" }, 400);
  }

  const order = await db.stripeOrder
    .findUnique({ where: { sessionId } })
    .catch(() => null);

  if (!order || order.buyerHash !== buyer.id) {
    // чужой/несуществующий заказ — не раскрываем даже факт существования
    return jsonResponse(buyer, { error: "Not found" }, 404);
  }

  const item = findMarketItem(order.productCode);
  if (!item) {
    return jsonResponse(buyer, { error: "Unknown product" }, 404);
  }

  let status = order.status;

  /* --- реконсиляция pending-заказа у Stripe ------------------------- */
  if (status === "pending" && isStripeConfigured()) {
    try {
      const session = await retrieveCheckoutSession(sessionId);
      if (session.payment_status === "paid") {
        const upd = await db.stripeOrder.updateMany({
          where: { id: order.id, status: "pending" },
          data: {
            status: "paid",
            paidAt: new Date(),
            paymentIntentId: session.payment_intent,
          },
        });
        if (upd.count > 0) {
          const amount = ((session.amount_total ?? order.amountCents) / 100).toFixed(2);
          console.log(
            `[money-op] stripe payment paid (reconciled): order=${order.id} ` +
              `product=${order.productCode} amount=${amount} ` +
              `${(session.currency || order.currency).toUpperCase()} ` +
              `ref=${order.refCode ?? "-"}`
          );
          if (order.refCode) {
            await recordReferralEvent({
              orderId: `st-${order.id}`,
              refCode: order.refCode,
              kind: "paid",
              amountUsdt: amount,
            });
          }
        }
        status = "paid";
      } else if (session.status === "expired") {
        await db.stripeOrder.updateMany({
          where: { id: order.id, status: "pending" },
          data: { status: "expired" },
        });
        status = "expired";
      }
    } catch (e) {
      // Stripe недоступен — не роняем поллинг: webhook догонит
      console.error(
        "[market-stripe] reconcile failed:",
        e instanceof StripeApiError ? `${e.status} ${e.message}` : e
      );
    }
  }

  const paid = status === "paid";

  return jsonResponse(buyer, {
    ok: true,
    status,
    paid,
    item: {
      code: item.code,
      title: item.title,
      category: item.category,
      priceCents: item.priceCents,
      currency: item.currency,
    },
    // полный текст уходит ТОЛЬКО после подтверждённой оплаты
    prompt: paid ? getPromptFull(order.productCode) : null,
  });
}
