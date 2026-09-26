import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { BET } from "./config";
import { is2328PayoutConfigured, create2328Payout } from "@/lib/2328/payout";
import { is2328WebhookConfigured } from "@/lib/2328/webhook";

/**
 * Кэшаут выигрыша через 2328.io Payout API (USDT на кошелёк игрока).
 *
 * Модель безопасности (§8 v2 — деньги только по подписанным событиям):
 *  - сумма кэшаута = Σ payoutCents ставок won & !claimed этого bettorId;
 *  - ставка помечается claimed ТОЛЬКО после успешного ответа 2328 payout
 *    (sign-подписанный запрос улетел, uuid получен);
 *  - payout-webhook (PAYOUT-ключ HMAC) completed → фиксируем txid в лог;
 *    failed/cancelled → снятие claimed, деньги снова доступны для кэшаута;
 *  - повторный кэшаут тех же ставок невозможен: claim идёт updateMany
 *    "won & !claimed", нулевой count → нечего платить;
 *  - каждая операция логируется [money-op][cashout].
 */

export class CashoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

function moneyLog(event: string, fields: Record<string, unknown>) {
  console.log(`[money-op][cashout] ${event}`, JSON.stringify(fields));
}

/* ------------------------------------------------------------------ */
/*  Кошелёк                                                            */
/* ------------------------------------------------------------------ */

/** TRC20 (T…, base58 без 0OIl) или EVM (0x + 40 hex) — две сети USDT. */
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

export function validateWalletAddress(wallet: string): string | null {
  const w = wallet.trim();
  if (TRON_RE.test(w)) return "TRX-TRC20";
  if (EVM_RE.test(w)) return "Ethereum-ERC20";
  return null;
}

/* ------------------------------------------------------------------ */
/*  Состояние игрока                                                   */
/* ------------------------------------------------------------------ */

export interface ClaimableSummary {
  claimableCents: number;
  claimedTotalCents: number;
  minCashoutCents: number;
  payoutsEnabled: boolean;
}

export async function claimableSummary(bettorId: string): Promise<ClaimableSummary> {
  const agg = await db.bet.aggregate({
    where: { bettorId, status: "won" },
    _sum: { payoutCents: true },
  });
  const wonTotal = agg._sum.payoutCents ?? 0;
  const claimedAgg = await db.bet.aggregate({
    where: { bettorId, status: "won", claimed: true },
    _sum: { payoutCents: true },
  });
  const claimedTotal = claimedAgg._sum.payoutCents ?? 0;
  return {
    claimableCents: Math.max(0, wonTotal - claimedTotal),
    claimedTotalCents: claimedTotal,
    minCashoutCents: BET.minBetCents,
    payoutsEnabled: is2328PayoutConfigured() && is2328WebhookConfigured(),
  };
}

/* ------------------------------------------------------------------ */
/*  Кэшаут                                                             */
/* ------------------------------------------------------------------ */

export interface CashoutResult {
  cashoutId: string;
  amountCents: number;
  bets: number;
  network: string;
  toAddress: string;
  payUuid: string;
  status: string;
}

/**
 * Выплата всех доступных выигрышей одним 2328-пейаутом.
 * Идемпотентность: mark-шаг в транзакции — только won & !claimed;
 * конкурентный вызов увидит count 0 и упадёт no_claimable (409).
 */
export async function cashoutWonBets(
  bettorId: string,
  wallet: string,
  refCode?: string | null
): Promise<CashoutResult> {
  const network = validateWalletAddress(wallet);
  if (!network) {
    throw new CashoutError("wallet must be TRC20 (T…) or EVM (0x…)", 400, "bad_wallet");
  }
  if (!is2328PayoutConfigured()) {
    throw new CashoutError(
      "payouts are not configured yet — winnings stay on your ledger",
      503,
      "payouts_disabled"
    );
  }

  /* блокируем пачку: только won & !claimed, payoutCents > 0 */
  const bets = await db.bet.findMany({
    where: { bettorId, status: "won", claimed: false, payoutCents: { gt: 0 } },
    select: { id: true, payoutCents: true },
  });
  const amountCents = bets.reduce((s, b) => s + (b.payoutCents ?? 0), 0);
  if (bets.length === 0 || amountCents < BET.minBetCents) {
    throw new CashoutError("nothing to cash out yet", 409, "no_claimable");
  }

  const cashoutId = randomUUID().slice(0, 8);
  const payoutOrderId = `bw-${cashoutId}`;
  const toAddress = wallet.trim();
  const amountUsdt = (amountCents / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://no-reality.fun";

  let payUuid = "";
  let status = "pending";
  try {
    const payout = await create2328Payout({
      amountUsdt,
      toAddress,
      network,
      orderId: payoutOrderId,
      urlCallback: `${base}/api/webhooks/2328`,
    });
    payUuid = payout.uuid;
    status = payout.status;
  } catch (e) {
    moneyLog("cashout_payout_failed", {
      payoutOrderId,
      bettorId,
      amountCents,
      error: e instanceof Error ? e.message : e,
    });
    throw new CashoutError("payout provider unavailable", 502, "payout_failed");
  }

  /* claim ТОЛЬКО после успешного инвойса; гонка конкурентов видна по count */
  const marked = await db.bet.updateMany({
    where: { id: { in: bets.map((b) => b.id) }, status: "won", claimed: false },
    data: { claimed: true, claimedAt: new Date(), payoutOrderId },
  });
  if (marked.count !== bets.length) {
    moneyLog("cashout_claim_race", {
      payoutOrderId,
      expected: bets.length,
      marked: marked.count,
    });
  }

  moneyLog("cashout_created", {
    payoutOrderId,
    bettorId,
    amountCents,
    amountUsdt,
    toAddress,
    network,
    bets: bets.length,
    payUuid: payUuid || null,
    ref: refCode ?? null,
  });

  return {
    cashoutId,
    amountCents,
    bets: bets.length,
    network,
    toAddress,
    payUuid,
    status,
  };
}

/**
 * Payout-webhook failed/cancelled: снимаем claimed — выигрыш снова
 * доступен для повторного кэшаута (админ разберётся в причине ошибки).
 */
export async function unclaimBetPayout(payoutOrderId: string, reason: string) {
  const unclaimed = await db.bet.updateMany({
    where: { payoutOrderId, claimed: true },
    data: { claimed: false, claimedAt: null, payoutOrderId: null },
  });
  if (unclaimed.count) {
    moneyLog("cashout_unclaimed", { payoutOrderId, bets: unclaimed.count, reason });
  }
  return unclaimed.count;
}
