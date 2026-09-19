import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/admin/stats?key=<ADMIN_SECRET> — статистика посещений
   и событий из БД (SQLite/Prisma).

   Отдаёт:
   - pageviews: всего / за 24ч / за 7 дней, уникальные посетители,
     топ путей и по дням (PageVisit — пишет /api/track);
   - clicks: уникальные переходы по UTM-редиректам (Click) + топ кодов;
   - rating: сумма score (PostStats);
   - referrals: профили кошельков + события (checkout/paid) + начисления;
   - purchases: покупки промптов по статусам.

   Без ключа — 401; если БД недоступна — 503 (serverless-холодный старт).
   ================================================================ */

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

  const key =
    req.nextUrl.searchParams.get("key") || req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  if (!key || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const dayMs = 86_400_000;

    const [visits, clicks, stats, profiles, events, purchases] =
      await Promise.all([
        db.pageVisit.findMany({ orderBy: { createdAt: "asc" } }),
        db.click.findMany({ orderBy: { createdAt: "asc" } }),
        db.postStats.findMany({ orderBy: { score: "desc" } }),
        db.referralProfile.findMany({ orderBy: { createdAt: "asc" } }),
        db.referralEvent.findMany({ orderBy: { createdAt: "asc" } }),
        db.purchase.findMany({ orderBy: { createdAt: "asc" } }),
      ]);

    /* --- pageviews: totals / windows / byPath / byDay --- */
    const pv24 = visits.filter(
      (v) => now - v.createdAt.getTime() <= dayMs
    ).length;
    const pv7d = visits.filter(
      (v) => now - v.createdAt.getTime() <= 7 * dayMs
    ).length;
    const uniqueVisitors = new Set(visits.map((v) => v.visitorHash)).size;

    const byPath = new Map<string, number>();
    for (const v of visits) byPath.set(v.path, (byPath.get(v.path) ?? 0) + 1);
    const topPaths = [...byPath.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const byDay = new Map<string, { views: number; visitors: Set<string> }>();
    for (const v of visits) {
      const k = dayKey(v.createdAt);
      const agg = byDay.get(k) ?? { views: 0, visitors: new Set<string>() };
      agg.views += 1;
      agg.visitors.add(v.visitorHash);
      byDay.set(k, agg);
    }
    const last14: { day: string; views: number; visitors: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const k = dayKey(new Date(now - i * dayMs));
      const agg = byDay.get(k);
      last14.push({
        day: k,
        views: agg?.views ?? 0,
        visitors: agg?.visitors.size ?? 0,
      });
    }

    /* --- clicks: уникальные переходы по UTM --- */
    const byCode = new Map<string, number>();
    for (const c of clicks) byCode.set(c.utmCode, (byCode.get(c.utmCode) ?? 0) + 1);
    const topCodes = [...byCode.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([utmCode, count]) => ({ utmCode, count }));

    /* --- referrals --- */
    const evByKind = new Map<string, number>();
    for (const e of events) evByKind.set(e.kind, (evByKind.get(e.kind) ?? 0) + 1);
    const payoutUsdt = events
      .filter((e) => e.kind === "paid")
      .reduce((s, e) => s + Number(e.payoutUsdt ?? 0), 0);

    /* --- purchases --- */
    const purchasesByStatus = new Map<string, number>();
    for (const p of purchases) {
      purchasesByStatus.set(p.status, (purchasesByStatus.get(p.status) ?? 0) + 1);
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      pageviews: {
        total: visits.length,
        last24h: pv24,
        last7d: pv7d,
        uniqueVisitors,
        topPaths,
        last14Days: last14,
      },
      clicks: {
        totalUnique: clicks.length,
        topCodes,
        ratingScoreSum: stats.reduce((s, r) => s + r.score, 0),
        ratedCodes: stats.length,
      },
      referrals: {
        profiles: profiles.length,
        eventsTotal: events.length,
        eventsByKind: Object.fromEntries(evByKind),
        accruedPayoutUsdt: payoutUsdt.toFixed(2),
      },
      purchases: {
        total: purchases.length,
        byStatus: Object.fromEntries(purchasesByStatus),
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
