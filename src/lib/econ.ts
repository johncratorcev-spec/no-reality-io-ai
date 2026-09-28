/**
 * Клиент-безопасные константы внутренней экономики (v7).
 * Серверные дефолты — src/lib/account.ts (ECON); здесь — зеркала для UI,
 * чтобы компоненты не тянули server-only модуль.
 *
 * v7 — ВИРТУАЛЬНЫЕ МОНЕТЫ: внутренняя валюта считается в центах (int),
 * но для игрока это ЦЕЛЫЕ МОНЕТЫ (1 монета = 1 цент). 300 монет за
 * регистрацию, ставка 100–500 монет, пополнение в монетах с бонусом.
 * Реальные деньги появляются только в двух местах: крипто-пополнение
 * (dp-*) и платный буст (bs-*) — оба строго через 2328.io.
 */

/** пресеты пополнения баланса (крипто USDT через 2328.io) */
export const DEPOSIT_PRESETS_CENTS = [500, 1000, 2000] as const;

/** бонус-мультипликатор монет за пакет (%, зеркало ECON.depositBonusPcts) */
export const DEPOSIT_BONUS_PCTS = [0, 10, 25] as const;

/** daily-бонус NR PASS (зеркало ECON.dailyBonusCents) */
export const DAILY_BONUS_CENTS = 50;

/** welcome-бонус нового аккаунта: 300 виртуальных монет за регистрацию */
export const WELCOME_BONUS_CENTS = 300;

/** награда за просмотр ленты: +N монет за каждые EVERY уникальных клипов в сутки */
export const WATCH_REWARD_CENTS = 10;
export const WATCH_REWARD_EVERY_CLIPS = 3;
/** дневной капс наград за просмотр ленты (монет за UTC-день) */
export const WATCH_REWARD_DAILY_CAP_CENTS = 100;

/** награда за угадывание: фиксированный бонус за каждую верную ставку */
export const GUESS_REWARD_CENTS = 10;

/** награда за добавление видео в ленту (куратору панели) */
export const VIDEO_REWARD_CENTS = 100;

/** формат баланса в МОНЕТАХ: 237 → "237", 1250 → "1250" */
export function fmtCoins(cents: number): string {
  return String(Math.round(cents));
}

/** легаси-имя (v6) — теперь тоже монеты, чтобы старые вызовы не врали "$" */
export function fmtBalance(cents: number): string {
  return fmtCoins(cents);
}
