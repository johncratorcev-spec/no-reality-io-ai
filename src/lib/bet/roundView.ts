/**
 * Клиентский срез раунда (BetPanel / PredictModal / любые компоненты ленты).
 * Server-тип RoundView живёт в lib/bet/core.ts; этот файл — клиент-безопасное
 * зеркало без серверных импортов.
 */
export interface RoundView {
  id: string;
  clipCode: string;
  status: "open" | "locked" | "resolved" | "void";
  opensAt?: string;
  closesAt: string;
  serverNow: string;
  windowSec: number;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  /** v13: Daily Challenge раунда дня */
  challenge?: boolean;
  myBet: {
    side: "real" | "synth";
    amountCents: number;
    status: string;
    payoutCents: number | null;
    betSec?: number | null;
  } | null;
  resolvedAs?: "real" | "synth";
  myResult?: "won" | "lost" | null;
  myPayoutCents?: number | null;
  rakeCents?: number;
  /* v14 — карточка после закрытия: колл, метка, хеш, секунда верного колла */
  labelCommit?: string;
  hashMatched?: boolean;
  myBetSec?: number | null;
  firstCorrectSec?: number | null;
}
