/**
 * Cryo-Stop — market on the ending of a clip (task 41, rev. 43).
 *
 * SIMPLIFIED ARCHITECTURE (user requirement): free to run, fast, light,
 * USDC-ONLY. No aggregators, no outcome tokens: a bet is a direct USDC
 * transfer of ANY amount (config below) to the treasury via Phantom.
 * Verification = one JSON-RPC call to a public Solana RPC (free).
 *
 * CONFIG-DRIVEN: markets are described here in code — ensureCryoMarkets()
 * (cryo/core.ts) idempotently upserts CryoMarket rows by postCode.
 *
 * IMPORTANT: while a market is live and the outcome is not chosen, the
 * card shows NO links to the video at all. After the outcome is picked,
 * the card gets a PREDICTED label and plays like a regular video.
 */
export interface CryoOptionConfigItem {
  /** ключ исхода: "yes"/"no" или нарративный ("drip", "vanish", …).
   *  Ключ живёт в CryoBet.side — существующие ставки совместимы. */
  key: string;
  /** человеческая формулировка варианта («hits the drip») */
  label: string;
}

export interface CryoMarketConfigItem {
  /** utm_code поста из data/posts.csv */
  postCode: string;
  /** вопрос рынка (Block 4: материализуется посимвольно изо льда) */
  question: string;
  /** outcome button labels: YES on the left, NO on the right (EN, task 43) */
  labelYes: string;
  labelNo: string;
  /**
   * Task 44 (ТЗ §4): нарративные опции «what happens next» — 2–4 понятных
   * варианта развития сцены вместо голого YES/NO. НЕ заданы → рынок
   * деградирует к двум классическим кнопкам labelYes/labelNo.
   * Пари-мьютюэль обобщается на N пулов без изменения формулы.
   */
  options?: readonly CryoOptionConfigItem[];
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
  /** ставка по умолчанию (одна позиция на кошелёк на рынок) */
  betAmountUsdc: "1.00",
  /** task 43: ставка ЛЮБЫМ количеством USDC — границы и пресеты */
  minBetUsdc: "0.10",
  maxBetUsdc: "500.00",
  betPresetsUsdc: ["1", "5", "10", "25"] as readonly string[],
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
   *               нарративные 3 опции (task 44): drip / vanish / boom
   *  -bBc5Nno  — «Mimik / Voronezh»   (badge CREEPY, кислотная плазма)
   *               нарративные 2 опции на классических ключах yes/no
   */
  markets: [
    {
      postCode: "ZznHA9HM",
      question: "what happens next in the clip?",
      labelYes: "YES",
      labelNo: "NO",
      options: [
        { key: "drip", label: "it hits the drip" },
        { key: "vanish", label: "it vanishes in the smoke" },
        { key: "boom", label: "the whole scene explodes" },
      ],
      accent: "#ffc94d",
      endsAtUtc: "2026-09-25T12:00:00Z",
    },
    {
      postCode: "-bBc5Nno",
      question: "what will mimik do before the clip ends?",
      labelYes: "steps out",
      labelNo: "stays hidden",
      options: [
        { key: "yes", label: "steps out of the dark" },
        { key: "no", label: "stays a shadow" },
      ],
      accent: "#8dff6e",
      endsAtUtc: "2026-09-25T12:00:00Z",
    },
  ] as readonly CryoMarketConfigItem[],
} as const;

export function cryoMarketByCode(code: string): CryoMarketConfigItem | undefined {
  return CRYO.markets.find((m) => m.postCode === code);
}

/**
 * Ключи исходов рынка: заданные нарративные опции (2–4) или классика yes/no.
 * Единственный источник правды для валидации ставок и вердиктов.
 */
export function cryoOptionsOf(c: CryoMarketConfigItem): readonly CryoOptionConfigItem[] {
  return c.options ?? [
    { key: "yes", label: c.labelYes },
    { key: "no", label: c.labelNo },
  ];
}

/** USDC-канал включён, когда задан казначей (иначе demo) */
export function cryoUsdcEnabled(): boolean {
  return Boolean(CRYO.treasury);
}
