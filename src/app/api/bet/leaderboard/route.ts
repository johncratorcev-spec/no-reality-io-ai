import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

interface EyeRow {
  rank: number;
  wallet: string;
  bets: number;
  wins: number;
  accuracy: number;
  netCents: number;
}

/**
 * GET /api/bet/leaderboard — Best Eyes Leaderboard: недельный топ по
 * точности угадываний (v5). Привязка: считаются только ставки,
 * у которых заполнен Bet.wallet (легаси-ставки при подключённом
 * крипто-кошельке; v7.1: крипто-подключение удалено, новые ставки
 * виртуальные и идут на аккаунте).
 *
 * Окно — 7 дней, минимум 5 резолвленных ставок. Ранг: accuracy ↓,
 * при равенстве — netCents ↓ (кто больше заработал).
 * ?mine=1 — ранг текущего кошелька (cookie nr_wallet/nr_phantom).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`bet-lb:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const mine =
    req.cookies.get("nr_wallet")?.value?.toLowerCase() ||
    req.cookies.get("nr_phantom")?.value?.toLowerCase() ||
    null;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const bets = await db.bet.findMany({
      where: {
        wallet: { not: null },
        status: { in: ["won", "lost"] },
        createdAt: { gte: since },
      },
      select: {
        wallet: true,
        status: true,
        amountCents: true,
        payoutCents: true,
      },
    });

    const agg = new Map<string, { wins: number; total: number; net: number }>();
    for (const b of bets) {
      const w = (b.wallet || "").toLowerCase();
      if (!w) continue;
      const a = agg.get(w) ?? { wins: 0, total: 0, net: 0 };
      a.total++;
      if (b.status === "won") {
        a.wins++;
        a.net += (b.payoutCents ?? 0) - b.amountCents;
      } else {
        a.net -= b.amountCents;
      }
      agg.set(w, a);
    }

    const MIN_BETS = 5;
    const rows: EyeRow[] = [...agg.entries()]
      .filter(([, a]) => a.total >= MIN_BETS)
      .map(([wallet, a]) => ({
        rank: 0,
        wallet,
        bets: a.total,
        wins: a.wins,
        accuracy: Math.round((a.wins / a.total) * 100),
        netCents: a.net,
      }))
      .sort((x, y) => y.accuracy - x.accuracy || y.netCents - x.netCents)
      .slice(0, 10)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    let mineRow: (EyeRow & { qualified: boolean }) | null = null;
    if (mine && agg.has(mine)) {
      const a = agg.get(mine)!;
      const qualified = a.total >= MIN_BETS;
      mineRow = {
        rank: 0,
        wallet: mine,
        bets: a.total,
        wins: a.wins,
        accuracy: Math.round((a.wins / a.total) * 100),
        netCents: a.net,
        qualified,
      };
    }

    return NextResponse.json({ week: true, minBets: MIN_BETS, rows, mine: mineRow });
  } catch {
    return NextResponse.json({ week: true, minBets: 5, rows: [], mine: null });
  }
}
