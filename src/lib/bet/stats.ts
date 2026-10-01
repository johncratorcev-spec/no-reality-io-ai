import "server-only";

import { db } from "@/lib/db";
import { ensureActiveSeason, type SeasonRow } from "@/lib/season";

/* ================================================================
   v13 — сезонная статистика глаз: лидерборд, серии, бейджи.
   Считается по SETTLED ставкам (won|lost) активного сезона,
   только ставки с accountId (балансовые EYE-ставки; legacy
   wallet/demo-ставки без аккаунта в зачёт не идут).

   Лидерборд «Глаз Бога»: winrate → net → volume. Своя позиция
   всегда возвращается (me), даже если игрок вне топ-N.
   ================================================================ */

export interface LeaderRow {
  rank: number;
  accountId: string;
  name: string | null;
  handle: string | null;
  bets: number;
  correct: number;
  winrate: number; // 0..100
  volumeCents: number;
  netCents: number; // payouts − stakes
  streak: number; // текущая серия верных коллов
  bestStreak: number;
  badges: string[];
}

interface Agg {
  accountId: string;
  bets: number;
  correct: number;
  volumeCents: number;
  netCents: number;
  streak: number;
  bestStreak: number;
  lastSide: "won" | "lost" | null;
}

/** Текущая серия верных коллов аккаунта (по settled-ставкам, свежие сверху). */
export async function winStreakOf(accountId: string): Promise<number> {
  const settled = await db.bet.findMany({
    where: { accountId, status: { in: ["won", "lost"] } },
    orderBy: [{ createdAt: "desc" }],
    take: 60,
    select: { status: true },
  });
  let streak = 0;
  for (const b of settled) {
    if (b.status !== "won") break;
    streak++;
  }
  return streak;
}

function badgesFor(r: {
  bets: number;
  winrate: number;
  streak: number;
  bestStreak: number;
  volumeCents: number;
  rank: number;
}): string[] {
  const out: string[] = [];
  if (r.rank === 1 && r.bets >= 5) out.push("god-eye");
  if (r.winrate >= 75 && r.bets >= 10) out.push("eagle");
  else if (r.winrate >= 60 && r.bets >= 5) out.push("sharp");
  if (r.bestStreak >= 7) out.push("unstoppable");
  else if (r.bestStreak >= 5) out.push("hot-hand");
  else if (r.bestStreak >= 3) out.push("warming-up");
  if (r.volumeCents >= 1000) out.push("whale");
  else if (r.volumeCents >= 300) out.push("high-roller");
  return out;
}

function aggregate(
  bets: { accountId: string; status: string; amountCents: number; payoutCents: number }[]
): Map<string, Agg> {
  /* последовательно по времени (свежие — последними): серии считаем проходом */
  const byAcc = new Map<string, Agg>();
  for (const b of bets) {
    const a =
      byAcc.get(b.accountId) ??
      ({
        accountId: b.accountId,
        bets: 0,
        correct: 0,
        volumeCents: 0,
        netCents: 0,
        streak: 0,
        bestStreak: 0,
        lastSide: null,
      } satisfies Agg);
    if (b.status === "won") {
      a.correct++;
      a.netCents += b.payoutCents - b.amountCents;
      a.streak++;
      a.bestStreak = Math.max(a.bestStreak, a.streak);
    } else if (b.status === "lost") {
      a.netCents -= b.amountCents;
      a.streak = 0;
    } else {
      continue; // pending/active не считаем
    }
    a.bets++;
    a.volumeCents += b.amountCents;
    byAcc.set(b.accountId, a);
  }
  /* streak в Agg после прохода = серия на конец последовательности */
  return byAcc;
}

/** Топ сезона + (опционально) строка указанного аккаунта с его ранком. */
export async function seasonLeaderboard(
  season: SeasonRow | null,
  opts?: { meId?: string | null; limit?: number }
): Promise<{ season: SeasonRow | null; top: LeaderRow[]; me: LeaderRow | null }> {
  if (!season) return { season: null, top: [], me: null };

  const bets = await db.bet.findMany({
    where: {
      createdAt: { gte: season.startsAt, lte: season.endsAt },
      accountId: { not: null },
      status: { in: ["won", "lost"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      accountId: true,
      status: true,
      amountCents: true,
      payoutCents: true,
    },
  });

  const agg = aggregate(
    bets.map((b) => ({
      accountId: b.accountId as string,
      status: b.status,
      amountCents: b.amountCents,
      payoutCents: b.payoutCents ?? 0,
    }))
  );

  const accounts = await db.account.findMany({
    where: { id: { in: [...agg.keys()] } },
    select: { id: true, displayName: true, tgUsername: true, email: true },
  });
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const nameOf = (id: string): string | null => {
    const a = accById.get(id);
    if (!a) return null;
    return a.displayName || (a.tgUsername ? `@${a.tgUsername}` : null);
  };
  const handleOf = (id: string): string | null => {
    const a = accById.get(id);
    if (!a) return null;
    return a.tgUsername ? `@${a.tgUsername}` : a.email ? a.email.split("@")[0] : null;
  };

  const rows: LeaderRow[] = [...agg.values()]
    .map((a) => {
      const winrate = a.bets > 0 ? Math.round((a.correct / a.bets) * 100) : 0;
      return {
        accountId: a.accountId,
        name: nameOf(a.accountId),
        handle: handleOf(a.accountId),
        bets: a.bets,
        correct: a.correct,
        winrate,
        volumeCents: a.volumeCents,
        netCents: a.netCents,
        streak: a.streak,
        bestStreak: a.bestStreak,
        badges: [] as string[],
        rank: 0,
      };
    })
    /* в зачёт — минимум 3 settled-ставки: меньше = шум */
    .filter((r) => r.bets >= 3)
    .sort(
      (x, y) =>
        y.winrate - x.winrate ||
        y.netCents - x.netCents ||
        y.volumeCents - x.volumeCents
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));

  for (const r of rows) {
    r.badges = badgesFor({
      bets: r.bets,
      winrate: r.winrate,
      streak: r.streak,
      bestStreak: r.bestStreak,
      volumeCents: r.volumeCents,
      rank: r.rank,
    });
  }

  const limit = opts?.limit ?? 50;
  const top = rows.slice(0, limit);
  let me: LeaderRow | null = null;
  if (opts?.meId) {
    const mine = rows.find((r) => r.accountId === opts.meId);
    if (mine) me = mine;
  }
  return { season, top, me };
}

/** Активный сезон (для API-роутов): идемпотентный ensure + инфо. */
export async function activeSeason(): Promise<SeasonRow | null> {
  return ensureActiveSeason();
}
