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
export interface CryoMarketConfigItem {
  /** utm_code поста из data/posts.csv */
  postCode: string;
  /** вопрос рынка (Block 4: материализуется посимвольно изо льда) */
  question: string;
  /** outcome button labels: YES on the left, NO on the right (EN, task 43) */
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
   *  -bBc5Nno  — «Mimik / Voronezh»   (badge CREEPY, кислотная плазма)
   */
  markets: [
    {
      postCode: "ZznHA9HM",
      question: "will the alien hit the drip before the clip ends?",
      labelYes: "YES",
      labelNo: "NO",
      accent: "#ffc94d",
      endsAtUtc: "2026-09-23T12:00:00Z",
    },
    {
      postCode: "-bBc5Nno",
      question: "will mimik step out of the dark?",
      labelYes: "YES",
      labelNo: "NO",
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
