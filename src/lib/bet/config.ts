/**
 * Конфиг ставок REAL/SYNTH (ТЗ v2 §4.3.8): рейк и доли — всё через env,
 * чтобы крутить экономику без деплоя кода.
 *
 *   RAKE_PCT=0.10            — рейк платформы с общего пула (8–12% по ТЗ)
 *   AUTHOR_SHARE_OF_RAKE=0.15 — доля автора спорного клипа от рейка
 *   REF_RATE_PCT=0.20        — доля реферера от рейка приведённой ставки
 *   MIN_BET_CENTS=10         — 10 EYE (v11 — приказ: ставки 10/25/50)
 *   MAX_BET_CENTS=50         — 50 EYE
 *   BET_WINDOW_SEC=45        — окно ставок после открытия клипа (15–60с)
 *   BET_POLL_MS=1500         — период опроса раунда клиентом, пока open
 *   FEATURE_BET_DEMO=0       — запретить demo-ставки (только crypto)
 */

function num(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v) || v < min || v > max) return def;
  return v;
}

export const BET = {
  /** рейк платформы (доля от общего пула активных ставок) */
  rakePct: num("RAKE_PCT", 0.1, 0, 0.5),
  /** доля автора клипа от рейка */
  authorShareOfRake: num("AUTHOR_SHARE_OF_RAKE", 0.15, 0, 1),
  /** доля реферера от рейка приведённой ставки */
  refRatePct: num("REF_RATE_PCT", 0.2, 0, 1),
  /** границы ставки, EYE (v11 — приказ: три кнопки 10/25/50) */
  minBetCents: Math.round(num("MIN_BET_CENTS", 10, 1, 100000)),
  maxBetCents: Math.round(num("MAX_BET_CENTS", 50, 1, 1000000)),
  /** пресеты суммы на кнопках, EYE (в границах min/max) */
  betPresetsCents: [10, 25, 50],
  /** окно ставок раунда, секунды (15–60 по ТЗ; легаси — v22 раунды) */
  windowSec: Math.round(num("BET_WINDOW_SEC", 45, 5, 60)),
  /**
   * v23 — окно РАФФЛА, секунды (по умолчанию НЕДЕЛЯ = 604800).
   * Каждый клип (видео/карусель) становится раффлом сразу при
   * публикации и живёт неделю: пул копится 7 дней, авторезолв по
   * closes_at. «Видео добавлять с авторезолвом — оно как раффл
   * существует неделю».
   */
  raffleWindowSec: Math.round(num("RAFFLE_WINDOW_SEC", 604_800, 600, 2_592_000)),
  /**
   * v23 — горизонт «скоростного» веса $NR, сек: decay 1/0.4/0 считается
   * от ОКНА РАФФЛА, но быстрый глаз награждаем только в первый час —
   * иначе при недельном окне множитель 0.4 размывает бонус.
   * Для коротких (легаси) раундов горизонт = само окно.
   */
  weightHorizonSec: 3600,
  /** опрос раунда клиентом, пока открыт, мс (v22 — 1с: пул в реалтайме) */
  pollMs: Math.round(num("BET_POLL_MS", 1000, 500, 10000)),
  /** целевой баланс real в ленте (контроль куратора, §4.3.7) */
  realRatioTarget: num("REAL_RATIO_TARGET", 0.3, 0, 1),
} as const;

/** demo-ставки разрешены: флаг не выключен (crypto-канал при этом не трогаем) */
export function betDemoEnabled(): boolean {
  return process.env.FEATURE_BET_DEMO !== "0";
}

/**
 * формат суммы для UI (v7): всё, что проходит через fmtUsd, — ВИРТУАЛЬНЫЕ
 * МОНЕТЫ (ставки/пулы/выигрыши внутренних монет): 237 → "237", 500 → "500".
 * Имя сохранено ради диффа; "$" здесь больше не существует — реальные
 * деньги живут только в кассе (пачки/revshare в USDT, lib/packs.ts).
 */
export function fmtUsd(cents: number): string {
  return String(Math.round(cents));
}

/**
 * v23 — компактный обратный отсчёт для диафрагмы таймера:
 * 45с → "45" · 72 мин → "72m" · 23ч → "23h" · 6 дней → "6d".
 * У недельного раффла цифра меняется по дням — зато честно.
 */
export function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 90) return String(s);
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m`;
  const h = Math.round(s / 3600);
  if (h < 36) return `${h}h`;
  return `${Math.round(s / 86400)}d`;
}
