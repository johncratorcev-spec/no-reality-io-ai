import { getPostByCode } from "@/lib/csv";
import { findMarketItem } from "./catalog";

/**
 * Единая точка «что можно купить за крипту» (v5 — crypto-only).
 *
 * Источники:
 *   1) платный пост из posts.csv (is_paid + price_usdt) — промпт кадра ленты;
 *   2) товар витрины MARKET_ITEMS (/market) — код совпадает с utm_code в
 *      data/prompts.csv, полный текст отдаёт getPromptFull() после оплаты.
 *
 * Stripe выпилен: инвойс всегда 2328.io, разблокировка всегда через
 * Purchase (status paid|ready_for_payout|payout_sent) + cookie nr_buyer.
 */
export interface SellablePrompt {
  code: string;
  title: string;
  /** цена в USDT, decimal-строка ("12.00") — как любит 2328.io */
  priceUsdt: string;
  preview: string | null;
  sellerWallet: string | null;
}

export function getSellablePrompt(code: string): SellablePrompt | null {
  if (!code) return null;

  const post = getPostByCode(code);
  if (post?.isPaid && post.priceUsdt) {
    return {
      code,
      title: post.title || code,
      priceUsdt: post.priceUsdt,
      preview: post.promptPreview ?? null,
      sellerWallet: post.sellerWallet ?? null,
    };
  }

  const item = findMarketItem(code);
  if (item) {
    return {
      code,
      title: item.title,
      priceUsdt: (item.priceCents / 100).toFixed(2),
      preview: item.teaser,
      sellerWallet: null,
    };
  }

  return null;
}
