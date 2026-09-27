/**
 * Клиентский срез раунда (BetPanel / PredictModal / любые компоненты ленты).
 * Server-тип RoundView живёт в lib/bet/core.ts; этот файл — клиент-безопасное
 * зеркало без серверных импортов.
 */
export interface RoundView {
  id: string;
  clipCode: string;
  status: "open" | "locked" | "resolved";
  opensAt?: string;
  closesAt: string;
  serverNow: string;
  windowSec: number;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  myBet: {
    side: "real" | "synth";
    amountCents: number;
    status: string;
    payoutCents: number | null;
  } | null;
  resolvedAs?: "real" | "synth";
  myResult?: "won" | "lost" | null;
  myPayoutCents?: number | null;
  rakeCents?: number;
}
