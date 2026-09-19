import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { PROMPT_DROP } from "@/lib/site";
import {
  create2328Payment,
  is2328PaymentConfigured,
  Pay2328ApiError,
  Pay2328ConfigError,
} from "@/lib/2328/payment";
import {
  deriveRefCode,
  normalizeRefCode,
  recordReferralEvent,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   PROMPT DROP (flash-продажа промпта персонажа коллаба, $100).
   Stateless по образцу доната: инвойс живёт у 2328.io, у нас —
   только orderId у покупателя (cookie-free, sessionStorage клиента).
   POST /api/prompt-drop/checkout → { payUrl, orderId, amountUsdt }
   Статус: GET /api/prompt-drop/status?orderId=pd-…
   ================================================================ */

function publicBase(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function nanoid(n = 12): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // эксклюзив за $100 — 4 старта оплаты / мин с одного IP за глаза
  const rl = rateLimit(`drop-checkout:${ip}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  /* тело опционально: { ref?: "rXXXXXXXXX" } из localStorage */
  let body: { ref?: unknown } | null = null;
  try {
    body = (await req.json()) as { ref?: unknown };
  } catch {
    body = null; // кнопка может прислать и пустой POST — это ок
  }

  // ключи провайдера + сам товар (env). Чек ДО создания инвойса:
  // никто не должен платить за промпт, который мы не сможем показать.
  if (!is2328PaymentConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet — try again later" },
      { status: 503 }
    );
  }
  if (!process.env.PROMPT_LOKI_FLASH?.trim()) {
    console.error("[prompt-drop] PROMPT_LOKI_FLASH is not set — refusing to sell");
    return NextResponse.json(
      { error: "The drop is not ready yet — try again later" },
      { status: 503 }
    );
  }

  const orderId = `pd-${nanoid()}`;

  /* --- реферальная атрибуция: код пригласившего вшиваем в orderId.
     Приглашение из ?ref= (localStorage клиента) или cookie-сессия,
     если покупатель сам подключил кошелёк. Само-приглашение не считается. */
  let refCode = normalizeRefCode(body?.ref);
  const walletCookie = req.cookies
    .get("nr_wallet")
    ?.value?.toLowerCase();
  if (refCode && walletCookie && walletCookie.match(/^0x[0-9a-f]{40}$/)) {
    if (deriveRefCode(walletCookie) === refCode) refCode = null; // сам-себе-пригласил
  }
  const finalOrderId = refCode ? `${orderId}-${refCode}` : orderId;
  if (refCode) {
    await recordReferralEvent({
      orderId: finalOrderId,
      refCode,
      kind: "checkout",
    });
  }

  try {
    const payment = await create2328Payment({
      amountUsdt: PROMPT_DROP.priceUsdt,
      orderId: finalOrderId,
      urlCallback: `${publicBase(req)}/api/webhooks/2328`,
      urlReturn: `${publicBase(req)}/v/${PROMPT_DROP.afterUtm}?drop=1`,
      description: "no reality. prompt drop — loki, the black cat hoodie",
      ttlSeconds: 1800,
    });

    return NextResponse.json({
      ok: true,
      payUrl: payment.payUrl,
      orderId: payment.orderId || finalOrderId,
      amountUsdt: PROMPT_DROP.priceUsdt,
    });
  } catch (e) {
    if (e instanceof Pay2328ConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error(
      "[prompt-drop] 2328 create payment failed:",
      e instanceof Error ? e.message : e
    );
    const status =
      e instanceof Pay2328ApiError && e.status >= 400 && e.status < 500
        ? 400
        : 502;
    return NextResponse.json(
      { error: "Payment provider error — try again" },
      { status }
    );
  }
}
