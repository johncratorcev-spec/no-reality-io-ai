import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ensureOpenRound,
  roundView,
  resolveExpiredRounds,
} from "@/lib/bet/core";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/round?clip=<utm_code> — текущий раунд ставок на клип.
 *
 * Ленивый cron (§4.3.5): каждый вызов сначала резолвит просроченные раунды
 * (SQLite-запрос по индексу status+closesAt — дёшево), поэтому внешний cron
 * не обязателен: пока ленту хоть кто-то смотрит, резолвы происходят сами.
 *
 * Открывает раунд лениво при первом взгляде. Truth не возвращается до резолва.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`round:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const clip = (req.nextUrl.searchParams.get("clip") || "").trim();
  if (!/^[\w-]{4,16}$/.test(clip)) {
    return NextResponse.json({ error: "bad clip code" }, { status: 400 });
  }

  const bettor = readBettor(req);

  try {
    /* ленивый резолв просроченных (включая этот клип) */
    await resolveExpiredRounds();
    const round = await ensureOpenRound(clip);

    const myBet = await db.bet.findFirst({
      where: { roundId: round.id, bettorId: bettor.id },
      orderBy: { createdAt: "desc" },
      select: { side: true, amountCents: true, status: true, payoutCents: true },
    });

    return bettorResponse(bettor, { round: roundView(round, myBet) });
  } catch (e) {
    if (e instanceof Error && e.message.includes("not bettable")) {
      return bettorResponse(bettor, { error: "not_bettable" }, 404);
    }
    console.error("[round] failed:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, { error: "round_unavailable" }, 503);
  }
}
