/**
 * Локальная память позиций Cryo-Stop (Block 6: состояние переживает
 * перезагрузку; деградация без БД — ставка живёт только здесь).
 * Используется и CryoStopCard (запись при ставке), и VideoCard
 * (чтение при монтировании → карточка сразу PREDICTED, без заморозки).
 */

import type { CryoSide } from "./core";

export interface CryoLocalBet {
  side: CryoSide;
  wallet: string;
  local: boolean;
  ts: number;
}

const betKey = (code: string) => `nr-cryo-bet-${code}`;

export function readCryoLocalBet(code: string): CryoLocalBet | null {
  try {
    const raw = localStorage.getItem(betKey(code));
    if (!raw) return null;
    const d = JSON.parse(raw) as CryoLocalBet;
    if (d.side !== "yes" && d.side !== "no") return null;
    return d;
  } catch {
    return null;
  }
}

export function writeCryoLocalBet(code: string, bet: CryoLocalBet): void {
  try {
    localStorage.setItem(betKey(code), JSON.stringify(bet));
  } catch {
    /* приватный режим — живём в сессии */
  }
}

/** анти-реплей метка для memo платежа (base58-безопасная, короткая) */
export function makeBetRef(): string {
  const rnd = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return `nr${Date.now().toString(36)}${rnd}`;
}
