import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/bet/live — живой индикатор предикшен-ленты («сейчас N человек
 * ставят»). Честный счётчик: уникальные bettorId со ставкой за 10 минут
 * плюс открытые раунды прямо сейчас (созданные за последние 2 мин).
 * Без надувных цифр — FOMO на реальных данных.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`bet-live:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  try {
    const since = new Date(Date.now() - 10 * 60_000);
    const [bettingRows, openRounds] = await Promise.all([
      db.bet.findMany({
        where: { createdAt: { gte: since }, status: { in: ["active", "pending", "won", "lost"] } },
        select: { bettorId: true },
        distinct: ["bettorId"],
      }),
      db.round.count({
        where: { status: "open", opensAt: { gte: new Date(Date.now() - 2 * 60_000) } },
      }),
    ]);

    const bettors = bettingRows.length;
    return NextResponse.json({
      betting: bettors,
      rounds: openRounds,
      label: bettors > 0 ? `${bettors} now` : "",
    });
  } catch {
    // БД недоступна — индикатор просто молчит
    return NextResponse.json({ betting: 0, rounds: 0, label: "" });
  }
}
