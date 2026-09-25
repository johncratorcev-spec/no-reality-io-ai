import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roundView, resolveRound } from "@/lib/bet/core";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/round/:id — пулы, таймер, моя ставка (§4.2).
 * Клиент поллит его каждые ~1.5с, пока раунд открыт.
 * Если окно истекло — раунд резолвится прямо здесь (детерминированно:
 * кураторский truth уже известен серверу) и ответ придёт со resolved_as.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`roundget:${ip}`, 240, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad round id" }, { status: 400 });
  }

  const bettor = readBettor(req);

  try {
    const round = await db.round.findUnique({ where: { id } });
    if (!round) {
      return bettorResponse(bettor, { error: "round_not_found" }, 404);
    }

    let current = round;
    if (
      round.status !== "resolved" &&
      round.closesAt.getTime() <= Date.now()
    ) {
      await resolveRound(round.id);
      current = (await db.round.findUnique({ where: { id } })) ?? round;
    }

    const myBet = await db.bet.findFirst({
      where: { roundId: current.id, bettorId: bettor.id },
      orderBy: { createdAt: "desc" },
      select: { side: true, amountCents: true, status: true, payoutCents: true },
    });

    return bettorResponse(bettor, { round: roundView(current, myBet) });
  } catch (e) {
    console.error("[round:get] failed:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, { error: "round_unavailable" }, 503);
  }
}
