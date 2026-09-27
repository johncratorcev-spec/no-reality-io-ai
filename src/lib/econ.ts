/**
 * Клиент-безопасные константы внутренней экономики (v6).
 * Серверные дефолты — src/lib/account.ts (ECON); здесь — зеркала для UI,
 * чтобы компоненты не тянули server-only модуль.
 */

/** пресеты пополнения баланса (крипто USDT через 2328.io) */
export const DEPOSIT_PRESETS_CENTS = [500, 1000, 2000] as const;

/** daily-бонус NR PASS (зеркало ECON.dailyBonusCents) */
export const DAILY_BONUS_CENTS = 50;

/** welcome-бонус нового аккаунта (зеркало ECON.welcomeBonusCents) */
export const WELCOME_BONUS_CENTS = 300;

/** подпись внутренней валюты в UI */
export const COIN_LABEL = "$";

/** формат баланса: 237 → "$2.37", 500 → "$5" */
export function fmtBalance(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
