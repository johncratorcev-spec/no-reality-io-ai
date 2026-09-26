import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";
import { readBuyer } from "@/lib/buyer";
import { db } from "@/lib/db";
import {
  create2328Payment,
  get2328PaymentInfo,
  is2328PaymentConfigured,
  Pay2328ApiError,
  Pay2328ConfigError,
} from "@/lib/2328/payment";
import {
  boostPricePerDayUsdt,
  normalizeBoostDays,
} from "@/lib/boost-order";

export const dynamic = "force-dynamic";

/**
 * POST /api/boost/checkout — платное поднятие клипа в топ предикшен-ленты
 * (Boosted / Featured Clip, v5). Оплата ТОЛЬКО крипто — инвойс 2328.io.
 *
 *   { code: "<utm_code>", days: 1|3|7 }
 *
 * → BoostOrder(pending, orderId bs-<id>) → payUrl 2328 → webhook paid →
 *   paidUntil = now + days×24h → getRankedPosts поднимает клип и вешает
 *   чип FEATURED на карточку.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`boost:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { code?: unknown; days?: unknown } = {};
  try {
    body = (await req.json()) as { code?: unknown; days?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^[\w-]{4,16}$/.test(code)) {
    return NextResponse.json({ error: "bad clip code" }, { status: 400 });
  }
  const post = getPostByCode(code);
  if (!post) {
    return NextResponse.json({ error: "clip not found" }, { status: 404 });
  }

  const days = normalizeBoostDays(body.days);
  const amountUsdt = (Number(boostPricePerDayUsdt()) * days).toFixed(2);

  if (!is2328PaymentConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet — try again later" },
      { status: 503 }
    );
  }

  const buyer = readBuyer(req);

  // живая pending-покупка этого клипа — ре-клик не плодит инвойсы
  const reuse = await db.boostOrder.findFirst({
    where: {
      buyerHash: buyer.id,
      clipCode: code,
      status: "pending",
      createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (reuse) {
    const payUrl = await reissuePayUrl(reuse.orderId);
    if (payUrl) {
      return buyerJson(buyer, {
        ok: true,
        payUrl,
        orderId: reuse.orderId,
        amountUsdt: reuse.amountUsdt,
        reused: true,
      });
    }
  }

  const order = await db.boostOrder.create({
    data: {
      clipCode: code,
      buyerHash: buyer.id,
      orderId: "", // заполним после создания строки
      amountUsdt,
      days,
    },
  });
  const orderId = `bs-${order.id}`;
  await db.boostOrder.update({ where: { id: order.id }, data: { orderId } });

  try {
    const payment = await create2328Payment({
      amountUsdt,
      orderId,
      urlCallback: `${publicBase(req)}/api/webhooks/2328`,
      urlReturn: `${publicBase(req)}/boost?code=${encodeURIComponent(code)}&paid=1`,
      description: `no reality. boost ${code} ×${days}d`,
      ttlSeconds: 1800,
    });
    await db.boostOrder.update({
      where: { id: order.id },
      data: { paymentId: payment.uuid || orderId },
    });

    console.log(
      "[money-op][boost] invoice_created",
      JSON.stringify({ orderId, clip: code, amountUsdt, days })
    );

    return buyerJson(buyer, {
      ok: true,
      payUrl: payment.payUrl,
      orderId,
      amountUsdt,
      days,
    });
  } catch (e) {
    await db.boostOrder
      .update({ where: { id: order.id }, data: { status: "failed" } })
      .catch(() => {});
    if (e instanceof Pay2328ConfigError) {
      return buyerJson(buyer, { error: e.message }, 503);
    }
    const status =
      e instanceof Pay2328ApiError && e.status >= 400 && e.status < 500
        ? 400
        : 502;
    console.error(
      "[boost] 2328 create payment failed:",
      e instanceof Error ? e.message : e
    );
    return buyerJson(buyer, { error: "Payment provider error — try again" }, status);
  }
}

/** повторно достаём ссылку инвойса у 2328 (best-effort) */
async function reissuePayUrl(orderId: string): Promise<string | null> {
  try {
    const info = await get2328PaymentInfo({ orderId });
    return info ? String(info.url ?? "") || null : null;
  } catch {
    return null;
  }
}

function publicBase(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

/** JSON + гарантия доставки nr_buyer cookie (урок E2E) */
function buyerJson(buyer: { id: string; isNew: boolean }, body: unknown, status = 200) {
  const res = NextResponse.json(body, { status });
  if (buyer.isNew) {
    res.cookies.set("nr_buyer", buyer.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
