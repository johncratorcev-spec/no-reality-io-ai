import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { readBuyer, jsonResponse } from "@/lib/buyer";
import { calcSplit } from "@/lib/prompts/paid";
import { getSellablePrompt } from "@/lib/market/sell";
import { normalizeRefCode, recordReferralEvent } from "@/lib/referral";
import {
  create2328Payment,
  get2328PaymentInfo,
  is2328PaymentConfigured,
  Pay2328ApiError,
  Pay2328ConfigError,
} from "@/lib/2328/payment";

export const dynamic = "force-dynamic";

/**
 * POST /api/prompts/[code]/checkout — создать КРИПТО-платёж за промпт
 * (v5: единственный канал — 2328.io, карты/Stripe выпилены).
 *
 * Работает для обоих источников: платных постов posts.csv и товаров
 * витрины MARKET_ITEMS (см. lib/market/sell.ts).
 *
 * Флоу: buyer-cookie → sellable-промпт → живая pending-покупка
 * (ре-клик не плодит инвойсы) → инвойс 2328 (hosted checkout) → payUrl.
 *
 * Рефералка: код пригласившего вшивается в orderId (nr-<id>-<ref>) —
 * атрибуция переживает любой сбой БД; webhook при paid запишет
 * ReferralEvent(kind=paid) и 20% уйдут рефереру.
 */

const PENDING_REUSE_MS = 30 * 60_000; // живой инвойс: TTL в 2328 = 30 мин

function publicBase(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const buyer = readBuyer(req);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // покупок много не бывает: 10 стартов оплаты / мин с одного IP
  const rl = rateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return jsonResponse(
      buyer,
      { error: "Too many requests" },
      429
    );
  }

  let body: { ref?: unknown } | null = null;
  try {
    body = (await req.json()) as { ref?: unknown };
  } catch {
    body = null; // тело опционально — кнопка может прислать и пустой POST
  }

  const sellable = getSellablePrompt(code);
  if (!sellable) {
    return jsonResponse(
      buyer,
      { error: "This prompt is not for sale" },
      404
    );
  }

  if (!is2328PaymentConfigured()) {
    return jsonResponse(
      buyer,
      { error: "Payments are not configured yet — try again later" },
      503
    );
  }

  // --- реферальная атрибуция: код вшиваем в orderId (переживёт что угодно).
  // Само-приглашение отсекается: если покупатель сам подключал кошелёк и код
  // совпал с его собственным — атрибуции нет. ---
  let refCode = normalizeRefCode(body?.ref);
  const walletCookie = req.cookies.get("nr_wallet")?.value?.toLowerCase();
  if (refCode && walletCookie && walletCookie.match(/^0x[0-9a-f]{40}$/)) {
    const { deriveRefCode } = await import("@/lib/referral");
    if (deriveRefCode(walletCookie) === refCode) refCode = null;
  }

  // --- ре-использование живой pending-покупки (второй клик / потерянный ответ) ---
  const reuse = await db.purchase.findFirst({
    where: {
      buyerHash: buyer.id,
      utmCode: code,
      status: "pending",
      createdAt: { gte: new Date(Date.now() - PENDING_REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (reuse) {
    try {
      const info = await get2328PaymentInfo({ orderId: reuse.orderId });
      const payUrl = info ? String(info.url ?? "") : "";
      if (payUrl) {
        return jsonResponse(buyer, {
          ok: true,
          payUrl,
          purchaseId: reuse.id,
          amountUsdt: reuse.amountUsdt,
          reused: true,
        });
      }
    } catch {
      // 2328 недоступен/инвойс не нашёлся — создадим новую сессию ниже
    }
  }

  // --- новая покупка ---
  const purchase = await db.purchase.create({
    data: {
      utmCode: code,
      buyerHash: buyer.id,
      orderId: "", // заполним сразу после создания строки (нужен id)
      paymentId: `pending-${crypto.randomUUID()}`, // временный; заменим на uuid 2328
      amountUsdt: sellable.priceUsdt,
      ...calcSplit(sellable.priceUsdt),
    },
  });

  const orderId = refCode
    ? `nr-${purchase.id}-${refCode}`
    : `nr-${purchase.id}`;
  await db.purchase.update({
    where: { id: purchase.id },
    data: { orderId },
  });
  if (refCode) {
    await recordReferralEvent({ orderId, refCode, kind: "checkout" });
  }

  try {
    const payment = await create2328Payment({
      amountUsdt: sellable.priceUsdt,
      orderId,
      urlCallback: `${publicBase(req)}/api/webhooks/2328`,
      urlReturn: `${publicBase(req)}/market/thanks?code=${encodeURIComponent(code)}`,
      description: `no reality. prompt — ${sellable.title}`,
    });

    await db.purchase.update({
      where: { id: purchase.id },
      data: { paymentId: payment.uuid || orderId },
    });

    return jsonResponse(buyer, {
      ok: true,
      payUrl: payment.payUrl,
      purchaseId: purchase.id,
      amountUsdt: sellable.priceUsdt,
    });
  } catch (e) {
    // покупку помечаем failed: её orderId больше не используется,
    // повторный клик создаст чистую сессию
    await db.purchase
      .update({
        where: { id: purchase.id },
        data: { status: "failed", paymentStatus: "create_failed" },
      })
      .catch(() => {});

    if (e instanceof Pay2328ConfigError) {
      return jsonResponse(buyer, { error: e.message }, 503);
    }
    const status =
      e instanceof Pay2328ApiError && e.status >= 400 && e.status < 500
        ? 400
        : 502;
    console.error(
      "[checkout] 2328 create payment failed:",
      e instanceof Error ? e.message : e
    );
    return jsonResponse(
      buyer,
      { error: "Payment provider error — try again" },
      status
    );
  }
}
