import { NextRequest, NextResponse } from "next/server";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";
import {
  claimableSummary,
  cashoutWonBets,
  CashoutError,
  validateWalletAddress,
} from "@/lib/bet/cashout";
import { is2328PayoutConfigured } from "@/lib/2328/payout";
import { is2328WebhookConfigured } from "@/lib/2328/webhook";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/cashout — кэшаут выигрыша REAL/SYNTH через 2328.io Payout.
 *
 * Тело: { wallet: "T…" | "0x…" } — сеть определяется форматом адреса
 * (TRX-TRC20 / Ethereum-ERC20). Одна выплата закрывает ВСЕ won & !claimed
 * ставки игрока; отказ провайдера снимает claimed обратно (webhook).
 * Гость без истории → 404 no_ledger.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`cashout:${ip}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const bettor = readBettor(req);
  if (bettor.isNew) {
    return bettorResponse(bettor, { error: "no bets yet" }, 404);
  }

  let wallet = "";
  try {
    const body = (await req.json()) as { wallet?: unknown };
    wallet = typeof body.wallet === "string" ? body.wallet : "";
  } catch {
    return bettorResponse(bettor, { error: "invalid json" }, 400);
  }
  if (!validateWalletAddress(wallet)) {
    return bettorResponse(
      bettor,
      { error: "wallet must be TRC20 (T…) or EVM (0x…)", code: "bad_wallet" },
      400
    );
  }

  try {
    const summary = await claimableSummary(bettor.id);
    if (summary.claimableCents < summary.minCashoutCents) {
      return bettorResponse(
        bettor,
        { error: "nothing to cash out yet", claimableCents: summary.claimableCents },
        409
      );
    }

    const result = await cashoutWonBets(bettor.id, wallet);
    return bettorResponse(bettor, {
      ok: true,
      cashoutId: result.cashoutId,
      amountCents: result.amountCents,
      bets: result.bets,
      network: result.network,
      status: result.status,
      summary: await claimableSummary(bettor.id),
    });
  } catch (e) {
    if (e instanceof CashoutError) {
      return bettorResponse(
        bettor,
        { error: e.message, code: e.code },
        e.status
      );
    }
    console.error("[money-op][cashout] api_error:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, { error: "cashout failed" }, 500);
  }
}

/** GET /api/me/cashout — сводка доступного к кэшауту (для панели позиций). */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`cashout-view:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const bettor = readBettor(req);
  if (bettor.isNew) {
    return bettorResponse(bettor, {
      claimableCents: 0,
      claimedTotalCents: 0,
      minCashoutCents: 100,
      payoutsEnabled: is2328PayoutConfigured() && is2328WebhookConfigured(),
    });
  }

  const summary = await claimableSummary(bettor.id);
  return bettorResponse(bettor, summary);
}
