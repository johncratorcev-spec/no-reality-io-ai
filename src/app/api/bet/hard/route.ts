import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/bet/hard — Daily Hard Mode: самые сложные клипы дня внутри
 * предикшен-ленты. «Сложный» = толпа ошибается: доля победителей в
 * резолвленных раундах клипа минимальна (деньги забирает платформа,
 * глаз аудитории подводит чаще всего).
 *
 * Считаем по завершённым раундам за 48 часов:
 *   accuracy(clip) = winners / (winners + losers), минимум 6 ставок.
 * Возвращаем до 12 кодов, отсортированных по возрастанию accuracy
 * (самые коварные — первыми).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`bet-hard:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  try {
    const since = new Date(Date.now() - 48 * 60 * 60_000);
    const rounds = await db.round.findMany({
      where: { status: "resolved", resolvedAt: { gte: since } },
      select: { clipCode: true, rakeCents: true },
    });
    if (rounds.length === 0) {
      return NextResponse.json({ codes: [] });
    }

    /* ставки резолвленных раундов за окно — один запрос */
    const bets = await db.bet.findMany({
      where: {
        clipCode: { in: [...new Set(rounds.map((r) => r.clipCode))] },
        status: { in: ["won", "lost"] },
        createdAt: { gte: since },
      },
      select: { clipCode: true, status: true },
    });

    const agg = new Map<string, { won: number; lost: number }>();
    for (const b of bets) {
      const a = agg.get(b.clipCode) ?? { won: 0, lost: 0 };
      if (b.status === "won") a.won++;
      else a.lost++;
      agg.set(b.clipCode, a);
    }

    const MIN_BETS = 6;
    const rows = [...agg.entries()]
      .filter(([, a]) => a.won + a.lost >= MIN_BETS)
      .map(([code, a]) => ({ code, accuracy: a.won / (a.won + a.lost), bets: a.won + a.lost }))
      .sort((x, y) => x.accuracy - y.accuracy)
      .slice(0, 12);

    return NextResponse.json({
      codes: rows.map((r) => r.code),
      stats: rows,
    });
  } catch {
    return NextResponse.json({ codes: [] });
  }
}
