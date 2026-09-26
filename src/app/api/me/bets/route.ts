import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";
import { claimableSummary } from "@/lib/bet/cashout";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/bets — история ставок игрока (§4.2), если есть сессия-cookie.
 * История даёт «дофамин/стыд» после резолва и повод вернуться.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`mybets:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const bettor = readBettor(req);
  if (bettor.isNew) {
    return bettorResponse(bettor, {
      bets: [],
      claimableCents: 0,
      claimedTotalCents: 0,
      payoutsEnabled: false,
    });
  }

  try {
    const [bets, summary] = await Promise.all([
      db.bet.findMany({
        where: { bettorId: bettor.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          clipCode: true,
          side: true,
          amountCents: true,
          status: true,
          payoutCents: true,
          mode: true,
          claimed: true,
          createdAt: true,
          round: { select: { status: true, resolvedAs: true, closesAt: true } },
        },
      }),
      claimableSummary(bettor.id),
    ]);

    return bettorResponse(
      bettor,
      {
        bets: bets.map((b) => ({
          id: b.id,
          clip: b.clipCode,
          side: b.side,
          amountCents: b.amountCents,
          status: b.status,
          payoutCents: b.payoutCents,
          mode: b.mode,
          claimed: b.claimed,
          roundStatus: b.round.status,
          resolvedAs: b.round.resolvedAs,
          createdAt: b.createdAt.toISOString(),
        })),
        claimableCents: summary.claimableCents,
        claimedTotalCents: summary.claimedTotalCents,
        payoutsEnabled: summary.payoutsEnabled,
      }
    );
  } catch (e) {
    console.error("[me:bets] failed:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, {
      bets: [],
      claimableCents: 0,
      claimedTotalCents: 0,
      payoutsEnabled: false,
    });
  }
}
