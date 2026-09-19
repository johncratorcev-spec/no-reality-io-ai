import "server-only";

import { db } from "@/lib/db";
import { getPostByCode } from "@/lib/csv";
import { create2328Payout } from "@/lib/2328/payout";

/**
 * Очередь выплат авторам.
 *
 * Атомарно забирает покупку из очереди (ready_for_payout → payout_sent,
 * условный updateMany — гонки между webhook'ом и админ-прогоном исключены)
 * и отправляет payout с payoutOrderId = "pay-<id>-<attempt>".
 *
 * attempt растёт с каждой попыткой (Date.now): ретрай после failed создаёт
 * НОВУЮ выплату — идемпотентность 2328 по order_id вернула бы старую
 * (уже провалившуюся), если бы ключ не менялся.
 */
export async function runSinglePayout(purchaseId: string): Promise<string> {
  const payoutOrderId = `pay-${purchaseId}-${Date.now()}`;

  const claimed = await db.purchase.updateMany({
    where: { id: purchaseId, status: "ready_for_payout" },
    data: { status: "payout_sent", payoutOrderId, payoutId: "pending" },
  });
  if (claimed.count === 0) return "skipped"; // уже забрано / статус изменился

  const purchase = await db.purchase.findUnique({ where: { id: purchaseId } });
  const post = purchase ? getPostByCode(purchase.utmCode) : null;
  const wallet = post?.sellerWallet || "";

  if (!purchase || !wallet) {
    // платить некому — честно возвращаем в очередь, логируем
    await rollbackClaim(purchaseId, payoutOrderId);
    console.log(
      "[payouts] no seller wallet for purchase",
      JSON.stringify({ purchaseId })
    );
    return "no_wallet";
  }

  try {
    const payout = await create2328Payout({
      amountUsdt: purchase.sellerAmount,
      toAddress: wallet,
      orderId: payoutOrderId,
      urlCallback: publicBaseUrl() + "/api/webhooks/2328",
    });
    await db.purchase.update({
      where: { id: purchaseId },
      data: { payoutId: payout.uuid || "pending" },
    });
    console.log(
      "[payouts] created",
      JSON.stringify({
        orderId: payoutOrderId,
        amount: purchase.sellerAmount,
        to: `${wallet.slice(0, 8)}…`,
      })
    );
    return "sent";
  } catch (e) {
    // возвращаем в очередь — деньги покупки не теряются, выплату можно повторить
    await rollbackClaim(purchaseId, payoutOrderId);
    throw e;
  }
}

async function rollbackClaim(id: string, payoutOrderId: string) {
  await db.purchase.updateMany({
    where: { id, status: "payout_sent", payoutOrderId },
    data: { status: "ready_for_payout", payoutOrderId: null, payoutId: null },
  });
}

function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "https://no-reality.fun").replace(
    /\/$/,
    ""
  );
}
