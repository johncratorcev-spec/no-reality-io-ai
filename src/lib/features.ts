/**
 * Feature flags (task 44, ТЗ §9): каждая новая механика выключается одной
 * env-переменной без правки кода. Дефолт — «включено» для фич ядра ТЗ
 * (UTM-трекинг, бонусы, нарративные рынки): они безопасны и обратимы.
 * Внешние сервисы (Cloudflare beacon, Magic Link) включаются только при
 * наличии их ключей — без ключей код даже не монтируется.
 *
 * Значения:
 *   FEATURE_UTM_TRACKING=0        — выключить персональные UTM-переходы
 *   FEATURE_BONUSES=0             — выключить welcome-бонусы и free bets
 *   FEATURE_NARRATIVE_MARKETS=0   — откатить рынки к голым YES/NO
 *   FEATURE_CLICK_WORKER=1        — включить приём кликов от CF Worker
 *   NEXT_PUBLIC_CF_BEACON_TOKEN   — токен Cloudflare Web Analytics
 *   RESEND_API_KEY + FEATURE_MAGIC_LINK!=0 — Magic Link вход
 */
export const FEATURES = {
  /** Cloudflare Web Analytics beacon (без токена скрипт не ставится) */
  cloudflareBeacon: Boolean(process.env.NEXT_PUBLIC_CF_BEACON_TOKEN),

  /** персональные UTM-ссылки и подсчёт переходов (api/track/ref) */
  utmTracking: process.env.FEATURE_UTM_TRACKING !== "0",

  /** виральные бонусы: welcome free bets, бейджи, реферальные кредиты */
  bonuses: process.env.FEATURE_BONUSES !== "0",

  /** нарративные опции рынка «what happens next» (2–4 варианта) */
  narrativeMarkets: process.env.FEATURE_NARRATIVE_MARKETS !== "0",

  /** приём асинхронных кликов от Cloudflare Worker (api/track/click) */
  clickWorker: process.env.FEATURE_CLICK_WORKER === "1",

  /** Magic Link по email — только при настроенном Resend */
  magicLink:
    process.env.FEATURE_MAGIC_LINK !== "0" &&
    Boolean(process.env.RESEND_API_KEY),
} as const;

export type FeatureKey = keyof typeof FEATURES;
