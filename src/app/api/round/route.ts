import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tickGame, currentLiveRound, roundView } from "@/lib/bet/core";
import { toPublicClip, clipById, queuedClipCount, labelCommitMatches } from "@/lib/clips";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/round — состояние игры (v14).
 *
 * Каждый вызов — тик планировщика: резолв просроченных live-раундов
 * (одна транзакция: метка, банк, вес, reveal) и, если live нет,
 * продвижение самого старого queued клипа. Пока игру хоть кто-то
 * смотрит — она живёт; внешний крон /api/cron/tick страхует.
 *
 *   ?clip=<id> — конкретный клип: publicClip + его live/последний раунд
 *   без параметра — текущий live-раунд игры (экран /bet)
 *
 * Публичный payload клипа: id, подпись после фильтра, ПРОКСИ видео,
 * closes_at, пулы, label_commit — БЕЗ метки, автора, исходной ссылки.
 * Метка раскрывается только в resolved (resolvedAs + label_commit).
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

  const clipParam = (req.nextUrl.searchParams.get("clip") || "").trim();
  if (clipParam && !/^[\w-]{4,40}$/.test(clipParam)) {
    return NextResponse.json({ error: "bad clip id" }, { status: 400 });
  }

  const bettor = readBettor(req);

  try {
    /* тик планировщика — игра идёт сама */
    await tickGame();

    let clipRow = null as Awaited<ReturnType<typeof clipById>>;
    let round = null as Awaited<ReturnType<typeof currentLiveRound>>;

    if (clipParam) {
      clipRow = await clipById(clipParam);
      if (!clipRow) {
        return bettorResponse(bettor, { error: "not_found" }, 404);
      }
      /* live-раунд клипа, иначе последний (для результата/просмотра) */
      const now = new Date();
      const live = await db.round.findFirst({
        where: { clipCode: clipParam, status: "open", closesAt: { gt: now } },
        orderBy: { closesAt: "desc" },
      });
      const any = live
        ? null
        : await db.round.findFirst({
            where: { clipCode: clipParam },
            orderBy: { closesAt: "desc" },
          });
      const r = live ?? any;
      round = r && clipRow ? { round: r, clip: clipRow } : null;
    } else {
      round = await currentLiveRound();
      clipRow = round?.clip ?? null;
    }

    const queueLeft = await queuedClipCount();

    if (!round || !clipRow) {
      return bettorResponse(bettor, {
        round: null,
        clip: clipRow ? toPublicClip(clipRow) : null,
        queueLeft,
      });
    }

    const myBet = await db.bet.findFirst({
      where: { roundId: round.round.id, bettorId: bettor.id },
      orderBy: { createdAt: "desc" },
      select: {
        side: true,
        amountCents: true,
        status: true,
        payoutCents: true,
        betSec: true,
      },
    });

    /* самая ранняя секунда верного колла (для карточки результата) */
    let firstCorrectSec: number | null = null;
    if (round.round.status === "resolved") {
      const agg = await db.bet.aggregate({
        where: { roundId: round.round.id, status: "won", betSec: { not: null } },
        _min: { betSec: true },
      });
      firstCorrectSec = agg._min.betSec ?? null;
    }

    const hashMatched =
      round.round.status === "resolved"
        ? labelCommitMatches(clipRow.id, clipRow.label, clipRow.labelCommit)
        : undefined;

    return bettorResponse(bettor, {
      round: roundView(round.round, myBet, clipRow.labelCommit, firstCorrectSec, hashMatched),
      clip: toPublicClip(clipRow),
      queueLeft,
    });
  } catch (e) {
    console.error("[round] failed:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, { error: "round_unavailable" }, 503);
  }
}
