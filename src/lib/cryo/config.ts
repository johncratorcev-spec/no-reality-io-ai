/**
 * Cryo-Stop — рынок предсказаний на концовку ролика (task 41, rev. 42).
 *
 * УПРОЩЁННАЯ АРХИТЕКТУРА (требование пользователя): бесплатно, быстро,
 * легко, приём ТОЛЬКО USDC. Никаких агрегаторов и Outcome-токенов:
 * ставка = прямой перевод $1 USDC на казначейский кошелёк через Phantom.
 * Верификация — один JSON-RPC вызов публичного Solana RPC (бесплатно).
 *
 * КОНФИГ-DRIVEN: рынки описаны здесь кодом — ensureCryoMarkets()
 * (cryo/core.ts) идемпотентно создаёт строки CryoMarket по postCode.
 *
 * ВАЖНО: пока рынок открыт и исход не выбран — на карточке не показывается
 * НИ ОДНОЙ ссылки на видео. После выбора исхода карточка получает лейбл
 * PREDICTED и показывается как обычное видео.
 */
export interface CryoMarketConfigItem {
  /** utm_code поста из data/posts.csv */
  postCode: string;
  /** вопрос рынка (Block 4: материализуется посимвольно изо льда) */
  question: string;
  /** подписи кристаллов: слева ДА, справа НЕТ (Block 4 спеки) */
  labelYes: string;
  labelNo: string;
  /** цвет плазмы настроения ролика (Mood Badge → акцент кристаллов) */
  accent: string;
  /** момент истечения рынка (Block 7) — фиксированный ISO в UTC */
  endsAtUtc: string;
}

const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const CRYO = {
  /** сколько ролик СМОТРИТСЯ до стоп-кадра (требование: 5 секунд) */
  watchMs: 5000,
  /** плавное замерзание: переход цвета/контраста, не резкий шок */
  coolMs: 1100,
  /** задержка второго SFX после стоп-кадра (Block 3) */
  crackDelayMs: 400,
  /** плавление льда после выбора исхода → ролик доигрывает целиком */
  meltMs: 1400,
  /** фикс ставка одного тапа (Block 5: $1 USDC) */
  betAmountUsdc: "1.00",
  /** доля платформы при пари-мьютюэль расчистке (Block 9) */
  feePct: 0.03,
  /** за сколько секунд до финала жидкость закипает (Block 7) */
  boilLeadSec: 10,
  /** период опроса рынка лентой (мс) */
  pollMs: 8000,

  /**
   * USDC-канал (упрощение): прямой перевод на казначея через Phantom.
   *  - NEXT_PUBLIC_PREDICT_TREASURY  — base58 владелец казначея (виден клиенту);
   *  - NEXT_PUBLIC_PREDICT_USDC_MINT — минт USDC (по умолчанию mainnet);
   *  - PREDICT_TREASURY_ATA          — ATA казначея (серверная верификация);
   *  - PREDICT_RPC_URL               — публичный RPC для getTransaction.
   * Пока treasury не задан — demo-режим: тот же UX, позиция фиксируется
   * в реестре без on-chain платежа.
   */
  usdcMint:
    process.env.NEXT_PUBLIC_PREDICT_USDC_MINT || MAINNET_USDC,
  treasury: process.env.NEXT_PUBLIC_PREDICT_TREASURY || "",
  treasuryAta: process.env.PREDICT_TREASURY_ATA || "",
  rpcUrl: process.env.PREDICT_RPC_URL || "https://api.mainnet-beta.solana.com",

  /**
   * Тестовые рынки (Block «Протестировать формат на двух видео»):
   *  ZznHA9HM  — «Alien drip 👽»      (badge SWAG,   тёплая янтарная плазма)
   *  -bBc5Nno  — «Mimik / Voronezh»   (badge CREEPY, кислотная плазма)
   */
  markets: [
    {
      postCode: "ZznHA9HM",
      question: "will the alien hit the drip before the clip ends?",
      labelYes: "ДА",
      labelNo: "НЕТ",
      accent: "#ffc94d",
      endsAtUtc: "2026-09-23T12:00:00Z",
    },
    {
      postCode: "-bBc5Nno",
      question: "will mimik step out of the dark?",
      labelYes: "ДА",
      labelNo: "НЕТ",
      accent: "#8dff6e",
      endsAtUtc: "2026-09-23T12:00:00Z",
    },
  ] as readonly CryoMarketConfigItem[],
} as const;

export function cryoMarketByCode(code: string): CryoMarketConfigItem | undefined {
  return CRYO.markets.find((m) => m.postCode === code);
}

/** USDC-канал включён, когда задан казначей (иначе demo) */
export function cryoUsdcEnabled(): boolean {
  return Boolean(CRYO.treasury);
}
