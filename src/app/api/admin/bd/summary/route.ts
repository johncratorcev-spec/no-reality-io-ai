import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminConfigured, hasAdminSession } from "@/lib/admin/session";
import { seasonInfo } from "@/lib/season";

export const dynamic = "force-dynamic";

/**
 * v13 — GET /api/admin/bd/summary: раскладка BD-панели одним запросом.
 * Доступ: только сессия nr_admin (или легаси ?key=). noindex.
 *
 * Отдаёт: сезон, открытые раунды, топ-раунды по банку (сезон),
 * участники сезона, статистика 24ч/7д (ставки/объём/новые аккаунты),
 * текущий Daily Challenge и featured-клипы.
 */
export async function GET(req: NextRequest) {
  if (!adminConfigured() || !hasAdminSession(req)) {
    return NextResponse.json({ ok: false, error: "access_denied" }, { status: 401 });
  }

  try {
    const season = await seasonInfo();
    const seasonRow = season
      ? await db.season.findFirst({ where: { code: season.code } })
      : null;
    const from = seasonRow?.startsAt ?? new Date(Date.now() - 7 * 86_400_000);

    const dayAgo = new Date(Date.now() - 86_400_000);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    /* --- открытые раунды: живой банк прямо сейчас --- */
    const openRounds = await db.round.findMany({
      where: { status: { in: ["open", "locked"] } },
      select: {
        id: true,
        clipCode: true,
        poolRealCents: true,
        poolSynthCents: true,
        challenge: true,
        closesAt: true,
      },
      orderBy: { closesAt: "desc" },
      take: 20,
    });
    const openBank = openRounds.reduce(
      (s, r) => s + r.poolRealCents + r.poolSynthCents,
      0
    );

    /* --- топ-раундов по банку за сезон --- */
    const topRounds = await db.round.findMany({
      where: { status: "resolved", createdAt: { gte: from } },
      orderBy: [{ poolRealCents: "desc" }],
      take: 40,
      select: {
        id: true,
        clipCode: true,
        poolRealCents: true,
        poolSynthCents: true,
        resolvedAs: true,
        challenge: true,
        resolvedAt: true,
      },
    });
    const top = topRounds
      .map((r) => ({
        id: r.id,
        clip: r.clipCode,
        bank: r.poolRealCents + r.poolSynthCents,
        resolvedAs: r.resolvedAs,
        challenge: r.challenge,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => b.bank - a.bank)
      .slice(0, 10);

    /* --- участники сезона: аккаунты со ставками --- */
    const betsSeason = await db.bet.findMany({
      where: { createdAt: { gte: from }, accountId: { not: null } },
      select: { accountId: true, amountCents: true, status: true, createdAt: true },
    });
    const participants = new Set(betsSeason.map((b) => b.accountId)).size;
    const seasonVolume = betsSeason.reduce((s, b) => s + b.amountCents, 0);
    const seasonSettled = betsSeason.filter((b) => b.status === "won" || b.status === "lost").length;

    /* --- 24ч / 7д --- */
    const bets24 = betsSeason.filter((b) => b.createdAt >= dayAgo);
    const bets7 = betsSeason.filter((b) => b.createdAt >= weekAgo);
    const newAccounts24 = await db.account.count({ where: { createdAt: { gte: dayAgo } } });
    const newAccounts7 = await db.account.count({ where: { createdAt: { gte: weekAgo } } });

    /* --- v14: конвейер клипов (очередь/живой/резолвнутые за 24ч) --- */
    const pipeline = {
      queued: await db.clip.count({ where: { status: "queued" } }),
      live: await db.clip.count({ where: { status: "live" } }),
      resolved24h: await db.clip.count({
        where: { status: "resolved", resolvedAt: { gte: dayAgo } },
      }),
      void: await db.clip.count({ where: { status: "void" } }),
    };

    /* --- daily challenge + featured --- */
    const today = new Date().toISOString().slice(0, 10);
    const daily = await db.dailyChallenge.findUnique({ where: { day: today } });
    /* v14: featured живёт на clips */
    const featured = await db.clip.findMany({
      where: { featuredUntil: { gt: new Date() } },
      select: { id: true, featuredUntil: true },
      orderBy: { featuredUntil: "desc" },
      take: 10,
    });

    return NextResponse.json(
      {
        ok: true,
        season: season
          ? {
              code: season.code,
              name: season.name,
              daysLeft: season.daysLeft,
              snapshotLabel: season.snapshotLabel,
            }
          : null,
        open: {
          count: openRounds.length,
          bankCents: openBank,
          rounds: openRounds.map((r) => ({
            id: r.id,
            clip: r.clipCode,
            real: r.poolRealCents,
            synth: r.poolSynthCents,
            challenge: r.challenge,
            closesAt: r.closesAt.toISOString(),
          })),
        },
        top,
        participants,
        seasonVolume,
        seasonSettled,
        last24: { bets: bets24.length, volume: bets24.reduce((s, b) => s + b.amountCents, 0), newAccounts: newAccounts24 },
        last7: { bets: bets7.length, volume: bets7.reduce((s, b) => s + b.amountCents, 0), newAccounts: newAccounts7 },
        daily: daily ? { clip: daily.clipCode, label: daily.label } : null,
        featured: featured.map((f) => ({ clip: f.id, until: f.featuredUntil?.toISOString() ?? null })),
        pipeline,
        ts: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[admin/bd/summary] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
