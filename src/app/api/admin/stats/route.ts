import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  hasAdminSession,
  legacyKeyMatches,
  adminConfigured,
} from "@/lib/admin/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/admin/stats?key=<ADMIN_SECRET> — статистика посещений
   и событий из БД (Supabase/Prisma).

   v11 — УЗКОЕ МЕСТО УСТРАНЕНО: раньше здесь были findMany() без
   лимита (PageVisit/Click/ReferralEvent/DepositOrder/UtmClick) —
   с ростом трафика панель протаскивала всю таблицу через пулер
   (connection_limit=1) и падала в 503 по таймауту пула. Теперь всё
   считается SQL-агрегатами (count/groupBy/sum), наружу — только
   итоги; форма ответа не изменилась.

   Отдаёт: pageviews (total/24h/7d/unique/topPaths/14 дней), clicks,
   rating, referrals, economy (аккаунты/баланс/пополнения),
   favorites, utm, cryo. Без ключа — 401; БД недоступна — 503.
   ================================================================ */

interface DayRow {
  day: string;
  views: number;
  visitors: number;
}
interface CountRow {
  k: string;
  c: number;
}
interface TwoColRow {
  a: string;
  b: string;
  c: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`admin:stats:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  /* v7: сессия (cookie nr_admin) или легаси-ключ — оба timing-safe. */
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  const legacyKey =
    req.nextUrl.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!hasAdminSession(req) && !legacyKeyMatches(legacyKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const dayMs = 86_400_000;
    const since24 = new Date(now - dayMs);
    const since7d = new Date(now - 7 * dayMs);
    const since14d = new Date(now - 14 * dayMs);

    /* --- pageviews: всё считаем в SQL (узкое место v11 устранено) --- */
    const [pvTotal, pv24, pv7d, uniqVisitors, topPathsRows, dayRows] =
      await Promise.all([
        db.pageVisit.count(),
        db.pageVisit.count({ where: { createdAt: { gte: since24 } } }),
        db.pageVisit.count({ where: { createdAt: { gte: since7d } } }),
        db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT "visitorHash")::bigint AS c FROM "PageVisit"`,
        db.pageVisit.groupBy({ by: ["path"], _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
        db.$queryRaw<DayRow[]>`SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::int AS views, COUNT(DISTINCT "visitorHash")::int AS visitors FROM "PageVisit" WHERE "createdAt" >= ${since14d} GROUP BY 1`,
      ]);

    const dayMap = new Map(dayRows.map((r) => [r.day, r]));
    const last14: { day: string; views: number; visitors: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = dayKey(new Date(now - i * dayMs));
      const agg = dayMap.get(k);
      last14.push({ day: k, views: Number(agg?.views ?? 0), visitors: Number(agg?.visitors ?? 0) });
    }

    /* --- clicks: уникальные переходы по UTM --- */
    const [clicksTotal, topCodesRows, ratingAgg] = await Promise.all([
      db.click.count(),
      db.click.groupBy({ by: ["utmCode"], _count: { _all: true }, orderBy: { _count: { utmCode: "desc" } }, take: 10 }),
      db.postStats.aggregate({ _sum: { score: true }, _count: { _all: true } }),
    ]);

    /* --- referrals --- */
    const [profilesCount, evKindRows, payoutSumRows] = await Promise.all([
      db.referralProfile.count(),
      db.$queryRaw<CountRow[]>`SELECT kind AS k, COUNT(*)::int AS c FROM "ReferralEvent" GROUP BY kind`,
      /* payoutUsdt — decimal-строка: Prisma _sum по String не умеет, суммируем в SQL */
      db.$queryRaw<{ s: number }[]>`SELECT COALESCE(SUM("payoutUsdt"::numeric), 0)::float8 AS s FROM "ReferralEvent" WHERE kind = 'paid'`,
    ]);

    /* --- economy (v6) --- */
    const [accountsTotal, passUsers, depositsStatusRows, depositsPaidAgg, ledgerSum] =
      await Promise.all([
        db.account.count(),
        db.account.count({ where: { passTier: { gt: 0 } } }),
        db.$queryRaw<CountRow[]>`SELECT status AS k, COUNT(*)::int AS c FROM "DepositOrder" GROUP BY status`,
        db.depositOrder.aggregate({ _sum: { amountCents: true }, where: { status: "paid" } }),
        db.ledgerTxn.aggregate({ _sum: { delta: true } }),
      ]);

    /* --- favorites / utm / cryo --- */
    const [favTotal, favAgg] = await Promise.all([
      db.favorite.count(),
      db.favoriteStats.findMany({ where: { count: { gt: 0 } }, orderBy: { count: "desc" }, take: 5 }),
    ]);

    const [utmTotal, utmUniq, utmTypeRows, utmTargetRows] = await Promise.all([
      db.utmClick.count(),
      db.$queryRaw<{ c: bigint }[]>`SELECT COUNT(DISTINCT "visitorHash")::bigint AS c FROM "UtmClick"`,
      db.$queryRaw<CountRow[]>`SELECT "targetType" AS k, COUNT(*)::int AS c FROM "UtmClick" GROUP BY "targetType"`,
      db.$queryRaw<TwoColRow[]>`SELECT "targetType" AS a, "targetId" AS b, COUNT(*)::int AS c FROM "UtmClick" GROUP BY 1, 2 ORDER BY c DESC LIMIT 5`,
    ]);

    const markets = await db.cryoMarket.groupBy({ by: ["status"], _count: { _all: true } });
    const betsTotal = await db.cryoBet.count();

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      pageviews: {
        total: pvTotal,
        last24h: pv24,
        last7d: pv7d,
        uniqueVisitors: Number(uniqVisitors[0]?.c ?? 0),
        topPaths: topPathsRows.map((r) => ({ path: r.path, count: r._count._all })),
        last14Days: last14,
      },
      clicks: {
        totalUnique: clicksTotal,
        topCodes: topCodesRows.map((r) => ({ utmCode: r.utmCode, count: r._count._all })),
        ratingScoreSum: ratingAgg._sum.score ?? 0,
        ratedCodes: ratingAgg._count._all,
      },
      referrals: {
        profiles: profilesCount,
        eventsTotal: evKindRows.reduce((s, r) => s + Number(r.c), 0),
        eventsByKind: Object.fromEntries(evKindRows.map((r) => [r.k, Number(r.c)])),
        accruedPayoutUsdt: Number(payoutSumRows[0]?.s ?? 0).toFixed(2),
      },
      economy: {
        accounts: accountsTotal,
        passUsers,
        balanceCents: ledgerSum._sum.delta ?? 0,
        deposits: {
          total: depositsStatusRows.reduce((s, r) => s + Number(r.c), 0),
          byStatus: Object.fromEntries(depositsStatusRows.map((r) => [r.k, Number(r.c)])),
          paidCents: depositsPaidAgg._sum.amountCents ?? 0,
        },
      },
      favorites: {
        total: favTotal,
        postsWithFavorites: favAgg.length,
        topPosts: favAgg.map((f) => ({ postCode: f.postCode, count: f.count })),
      },
      utm: {
        total: utmTotal,
        uniqueVisitors: Number(utmUniq[0]?.c ?? 0),
        byType: Object.fromEntries(utmTypeRows.map((r) => [r.k, Number(r.c)])),
        topTargets: utmTargetRows.map((r) => ({ target: `${r.a}:${r.b || "-"}`, count: Number(r.c) })),
      },
      cryo: {
        markets: markets.reduce((s, m) => s + m._count._all, 0),
        byStatus: Object.fromEntries(markets.map((m) => [m.status, m._count._all])),
        betsTotal,
      },
    });
  } catch (e) {
    console.error(
      "[admin/stats] db unavailable:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { ok: false, error: "DB unavailable" },
      { status: 503 }
    );
  }
}
