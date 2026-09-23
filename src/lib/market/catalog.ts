/* ================================================================
   Витрина промптов /market — каталог товаров (task 45).

   Клиент-безопасный модуль: здесь только ПУБЛИЧНЫЕ метаданные
   (название, тизер, цена в центах, категория, движки). Полные тексты
   промптов живут в data/prompts.csv (utm_code = productCode) и
   покидают сервер только после подтверждённой оплаты — см.
   src/lib/prompts/paid.ts getPromptFull().

   Товары помечены badge "test drop": это тестовые продажи с
   Stripe-интеграцией в test mode (ключи sk_test_…). Для боевого
   дропа достаточно: убрать badge, положить текст в data/prompts.csv
   и переключить ключи на sk_live_… — код менять не нужно.
   ================================================================ */

export interface MarketItem {
  /** наш внутренний код продукта (= utm_code в data/prompts.csv) */
  code: string;
  title: string;
  teaser: string;
  /** человекочитаемая категория для чипа на карточке */
  category: string;
  /** цена в центах: 1200 = $12.00 (целые — без float-дрейфа) */
  priceCents: number;
  currency: "usd";
  /** движки, для которых адаптирован промпт */
  engines: string[];
  /** обложка карточки; если файла нет — рендерим градиент-фолбэк */
  cover: string;
  /** градиент-фолбэк и подложка превью [from, via, to] */
  gradient: [string, string, string];
  /** бейдж на карточке ("test drop", "new", …) */
  badge?: string;
}

export const MARKET_ITEMS: MarketItem[] = [
  {
    code: "neon-rain",
    title: "neon rain district",
    teaser:
      "a lone figure in a translucent raincoat drifting through a neon-drenched alley — wet asphalt reflections, anamorphic flares, blade-runner nostalgia.",
    category: "text → video",
    priceCents: 1200,
    currency: "usd",
    engines: ["veo 3", "kling 2.5", "runway gen-4"],
    cover: "/images/market/neon-rain.png",
    gradient: ["#2b1a5e", "#8a68e8", "#3ec6d8"],
    badge: "test drop",
  },
  {
    code: "liquid-chrome",
    title: "liquid chrome portrait",
    teaser:
      "a portrait that liquefies into flowing mercury and reforms — macro lens, 120fps ramp, iridescent highlights. hypnotic and loop-friendly.",
    category: "image → video",
    priceCents: 900,
    currency: "usd",
    engines: ["kling 2.1", "veo 3", "minimax hailuo"],
    cover: "/images/market/liquid-chrome.png",
    gradient: ["#1c1f26", "#b9c0cc", "#e9e4f4"],
    badge: "test drop",
  },
  {
    code: "paper-fold",
    title: "paper fold transition",
    teaser:
      "the frame folds inward like premium matte paper and unfolds into the next scene — geometric, pastel, satisfying. works as a series signature.",
    category: "transition",
    priceCents: 700,
    currency: "usd",
    engines: ["veo 3", "pika 2.2"],
    cover: "/images/market/paper-fold.png",
    gradient: ["#f3ead9", "#b9cfae", "#eec3c3"],
    badge: "test drop",
  },
];

/** поиск товара по коду (строгий whitelist — никакой динамики в чекауте) */
export function findMarketItem(code: unknown): MarketItem | null {
  if (typeof code !== "string") return null;
  return MARKET_ITEMS.find((i) => i.code === code) ?? null;
}

/** "$12.00" из 1200 — клиент-безопасное форматирование цены */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
