import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { readBuyer, jsonResponse } from "@/lib/buyer";
import { getPromptFull, commissionRate } from "@/lib/prompts/paid";
import { getSellablePrompt } from "@/lib/market/sell";
import { is2328PaymentConfigured } from "@/lib/2328/payment";
import { is2328PayoutConfigured } from "@/lib/2328/payout";

export const dynamic = "force-dynamic";

/**
 * GET /api/prompts/[code]/status — публичные данные платного промпта
 * и (только после подтверждённой оплаты) полный текст. v5: crypto-only.
 *
 * ЕДИНСТВЕННОЕ место, где prompt_full покидает сервер. Условие выдачи
 * строгое: существует Purchase этого покупателя (buyer-cookie) с utmCode,
 * у которого status = paid | ready_for_payout | payout_sent. Всё остальное
 * (pending / failed / aml_hold / чужая покупка) — только метаданные.
 *
 * Работает для платных постов posts.csv И товаров витрины MARKET_ITEMS.
 * soldTotal — честный счётчик оплаченных покупок (scarcity в UI витрины).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const buyer = readBuyer(req);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`promptstatus:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return jsonResponse(buyer, { error: "Too many requests" }, 429);
  }

  const sellable = getSellablePrompt(code);
  if (!sellable) {
    return jsonResponse(buyer, { error: "Not found" }, 404);
  }

  // разблокировка только по своей оплаченной покупке
  let unlocked = false;
  let purchaseId: string | null = null;
  let soldTotal = 0;
  try {
    const paid = await db.purchase.findFirst({
      where: {
        buyerHash: buyer.id,
        utmCode: code,
        status: { in: ["paid", "ready_for_payout", "payout_sent"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    unlocked = Boolean(paid);
    purchaseId = paid?.id ?? null;

    soldTotal = await db.purchase.count({
      where: { utmCode: code, status: { in: ["paid", "ready_for_payout", "payout_sent"] } },
    });
  } catch (e) {
    // БД недоступна (serverless cold start) — считаем разблокировки потерянными,
    // но не роняем страницу: промпт просто останется закрытым
    console.error(
      "[prompt-status] db unavailable:",
      e instanceof Error ? e.message : e
    );
  }

  const promptFull = unlocked ? getPromptFull(code) : null;

  return jsonResponse(buyer, {
    isPaid: true,
    priceUsdt: sellable.priceUsdt,
    title: sellable.title,
    preview: sellable.preview,
    soldTotal,
    commissionRate: commissionRate(),
    unlocked,
    purchaseId,
    prompt: promptFull,
    paymentsConfigured: is2328PaymentConfigured(),
    payoutsConfigured: is2328PayoutConfigured(),
  });
}
