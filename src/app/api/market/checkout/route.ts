import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { readBuyer, jsonResponse } from "@/lib/buyer";
import { findMarketItem } from "@/lib/market/catalog";
import { getPromptFull } from "@/lib/prompts/paid";
import {
  createCheckoutSession,
  isStripeConfigured,
  StripeApiError,
  StripeConfigError,
} from "@/lib/stripe/api";
import { deriveRefCode, normalizeRefCode, recordReferralEvent } from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/market/checkout — старт оплаты промпта КАРТОЙ (task 45).
   Тело: { code: "neon-rain", ref?: "rXXXXXXXXX" } (ref — из
   localStorage, код пригласившего, тот же механизм, что у 2328).

   Пайплайн: валидация товара → StripeOrder (pending) → referral
   событие «checkout» (best-effort) → Stripe Checkout Session
   (hosted, test/live по ключу) → { url } для редиректа.

   Промпт не продаётся, пока его текст не лежит в data/prompts.csv:
   чек ДО создания сессии — никто не платит за то, что мы не сможем
   показать (тот же инвариант, что у prompt-drop: чек PROMPT_LOKI_FLASH).
   ================================================================ */

function publicBase(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

/** сессия кошелька (если покупатель авторизован) — 0x… в нижнем регистре */
function walletFromCookie(req: NextRequest): string | null {
  const w = req.cookies.get("nr_wallet")?.value?.toLowerCase();
  return w && /^0x[0-9a-f]{40}$/.test(w) ? w : null;
}

export async function POST(req: NextRequest) {
  const buyer = readBuyer(req);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // покупка картой — эксклюзивный жест: 6 стартов/мин с одного IP
  const rl = rateLimit(`market-checkout:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return jsonResponse(buyer, { error: "Too many requests" }, 429);
  }

  let body: { code?: unknown; ref?: unknown } | null = null;
  try {
    body = (await req.json()) as { code?: unknown; ref?: unknown };
  } catch {
    body = null;
  }

  const item = findMarketItem(body?.code);
  if (!item) {
    return jsonResponse(buyer, { error: "Unknown product" }, 400);
  }
  if (!isStripeConfigured()) {
    return jsonResponse(
      buyer,
      { error: "Card payments are not configured yet — try again later" },
      503
    );
  }
  // чек «сможем доставить товар»: полный текст промпта обязан существовать
  if (!getPromptFull(item.code)) {
    console.error(
      `[market-stripe] prompt text missing for "${item.code}" — refusing to sell`
    );
    return jsonResponse(
      buyer,
      { error: "This drop is not ready yet — try again later" },
      503
    );
  }

  /* --- реферальная атрибуция: как в prompt-drop — код из localStorage,
     само-приглашение не считается -------------------------------------- */
  let refCode = normalizeRefCode(body?.ref);
  const wallet = walletFromCookie(req);
  if (refCode && wallet && deriveRefCode(wallet) === refCode) {
    refCode = null; // сам-себе-пригласил
  }

  /* --- заказ в БД: sessionId допишем сразу после создания сессии --- */
  let order;
  try {
    order = await db.stripeOrder.create({
      data: {
        productCode: item.code,
        buyerHash: buyer.id,
        buyerWallet: wallet,
        refCode,
        amountCents: item.priceCents,
        currency: item.currency,
        status: "pending",
      },
    });
  } catch (e) {
    console.error(
      "[market-stripe] order create failed:",
      e instanceof Error ? e.message : e
    );
    return jsonResponse(
      buyer,
      { error: "Could not start checkout — try again" },
      503
    );
  }

  // событие «checkout» в реестре (best-effort, как у 2328-канала)
  if (refCode) {
    await recordReferralEvent({
      orderId: `st-${order.id}`,
      refCode,
      kind: "checkout",
    });
  }

  try {
    const session = await createCheckoutSession({
      amountCents: item.priceCents,
      currency: item.currency,
      productName: `no reality. — ${item.title}`,
      productDescription: `${item.category} prompt · ${item.engines.join(", ")}`,
      clientReferenceId: order.id,
      successUrl: `${publicBase(req)}/market/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${publicBase(req)}/market?canceled=1`,
      metadata: {
        order_id: order.id,
        product_code: item.code,
        buyer_hash: buyer.id,
        ...(refCode ? { ref_code: refCode } : {}),
        ...(wallet ? { buyer_wallet: wallet } : {}),
      },
    });

    await db.stripeOrder.update({
      where: { id: order.id },
      data: { sessionId: session.id },
    });

    console.log(
      `[money-op] stripe checkout created: order=${order.id} product=${item.code} ` +
        `amount=${(item.priceCents / 100).toFixed(2)} ${item.currency} ` +
        `session=${session.id} ref=${refCode ?? "-"} wallet=${wallet ?? "-"}`
    );

    return jsonResponse(buyer, {
      ok: true,
      url: session.url,
      orderId: order.id,
    });
  } catch (e) {
    // сессия не создалась — заказ помечаем expired, чтобы не висел pending
    await db.stripeOrder
      .updateMany({
        where: { id: order.id, status: "pending" },
        data: { status: "expired" },
      })
      .catch(() => undefined);

    if (e instanceof StripeConfigError) {
      return jsonResponse(buyer, { error: e.message }, 503);
    }
    console.error(
      "[market-stripe] session create failed:",
      e instanceof Error ? e.message : e
    );
    const status =
      e instanceof StripeApiError && e.status >= 400 && e.status < 500
        ? 400
        : 502;
    return jsonResponse(
      buyer,
      { error: "Payment provider error — try again" },
      status
    );
  }
}
