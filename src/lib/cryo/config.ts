/**
 * Cryo-Stop — рынок предсказаний на концовку ролика (task 41).
 *
 * КОНФИГ-DRIVEN: рынки описаны здесь кодом, а не сидятся руками —
 * ensureCryoMarkets() (cryo/core.ts) идемпотентно создаёт строки CryoMarket
 * по postCode при первом обращении к API. Фича работает сразу на любом
 * окружении (в т.ч. serverless с чистой БД), ставки живут в БД.
 *
 * ВАЖНО: на карточке с рынком не показывается НИ ОДНОЙ ссылки на видео
 * (требование спеки) — VideoCard прячет весь chrome при наличии market.
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

export const CRYO = {
  /** фикс ставка одного тапа (Block 5: $1 USDC → Outcome_Token) */
  betAmountUsdc: "1.00",
  /** доля платформы при пари-мьютюэль расчистке (Block 9) */
  feePct: 0.03,
  /** сколько длится анимация заморозки (Block 2: ровно 0.8 секунды) */
  freezeMs: 800,
  /** задержка второго SFX (Block 3: 400 мс после первого) */
  crackDelayMs: 400,
  /** за сколько секунд до финала жидкость закипает (Block 7) */
  boilLeadSec: 10,
  /** период опроса рынка лентой (мс) */
  pollMs: 8000,
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
      endsAtUtc: "2026-09-22T12:00:00Z",
    },
    {
      postCode: "-bBc5Nno",
      question: "will mimik step out of the dark?",
      labelYes: "ДА",
      labelNo: "НЕТ",
      accent: "#8dff6e",
      endsAtUtc: "2026-09-22T12:00:00Z",
    },
  ] as readonly CryoMarketConfigItem[],

  /**
   * Обмен USDC → Outcome_Token (Block 5) идёт через Jupiter Aggregator,
   * когда заданы минты. Пока Outcome-токен не выпущен — demo-режим:
   * тот же UX protected-popup, позиция фиксируется в реестре.
   */
  jupiterInputMint: process.env.CRYO_JUPITER_INPUT_MINT || "", // USDC (Solana)
  jupiterOutputMint: process.env.CRYO_JUPITER_OUTPUT_MINT || "", // Outcome_Token
} as const;

export function cryoMarketByCode(code: string): CryoMarketConfigItem | undefined {
  return CRYO.markets.find((m) => m.postCode === code);
}
