import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";
import { db } from "@/lib/db";
import { readBuyer, jsonResponse } from "@/lib/buyer";
import { getPromptFull, commissionRate } from "@/lib/prompts/paid";
import { is2328PaymentConfigured } from "@/lib/2328/payment";
import { is2328PayoutConfigured } from "@/lib/2328/payout";

export const dynamic = "force-dynamic";

/**
 * GET /api/prompts/[code]/status — публичные данные платного промпта
 * и (только после подтверждённой оплаты) полный текст.
 *
 * ЕДИНСТВЕННОЕ место, где prompt_full покидает сервер. Условие выдачи
 * строгое: существует Purchase этого покупателя (buyer-cookie) с utmCode,
 * у которого status = paid | ready_for_payout | payout_sent. Всё остальное
 * (pending / failed / aml_hold / чужая покупка) — только метаданные.
 *
 * commissionRate отдаём для прозрачного UI («автору 75%, платформе 25%»).
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

  const post = getPostByCode(code);
  if (!post) {
    return jsonResponse(buyer, { error: "Not found" }, 404);
  }

  // разблокировка только по своей оплаченной покупке
  let unlocked = false;
  let purchaseId: string | null = null;
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
    isPaid: Boolean(post.isPaid),
    priceUsdt: post.priceUsdt ?? null,
    preview: post.promptPreview ?? null,
    commissionRate: commissionRate(),
    unlocked,
    purchaseId,
    prompt: promptFull,
    paymentsConfigured: is2328PaymentConfigured(),
    payoutsConfigured: is2328PayoutConfigured(),
  });
}
