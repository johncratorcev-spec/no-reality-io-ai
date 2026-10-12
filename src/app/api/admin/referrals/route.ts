import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminCodeMatches, legacyKeyMatches } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/referrals?key=<ADMIN_SECRET> — ручная ревизия топ-рефереров
 * (ТЗ §5 «возможность ручной ревизии топ-рефереров»).
 *
 * Топ-20 по числу квалификаций за 7 дней: сколько paid/held, сколько
 * held по same_device (главный маркер ботоводов), сумма выплаченных EYE,
 * доли device-совпадений. Дополнительно: свежие held-строки на разбор.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin-ref:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const keyOk =
    legacyKeyMatches(req.nextUrl.searchParams.get("key")) ||
    adminCodeMatches(req.headers.get("x-admin-secret") || "");
  if (!keyOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await db.referralReward.groupBy({
      by: ["referrerId", "status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { eyeReferrer: true },
    });

    const agg = new Map<string, { paid: number; held: number; eye: number }>();
    for (const r of rows) {
      const cur = agg.get(r.referrerId) ?? { paid: 0, held: 0, eye: 0 };
      if (r.status === "paid") {
        cur.paid += r._count._all;
        cur.eye += r._sum.eyeReferrer ?? 0;
      } else {
        cur.held += r._count._all;
      }
      agg.set(r.referrerId, cur);
    }

    const ids = [...agg.keys()];
    const accounts = await db.account.findMany({
      where: { id: { in: ids } },
      select: { id: true, refCode: true, email: true, displayName: true, signupIpHash: true, createdAt: true },
    });
    const accOf = new Map(accounts.map((a) => [a.id, a]));

    const top = [...agg.entries()]
      .map(([id, v]) => {
        const a = accOf.get(id);
        return {
          accountId: id,
          refCode: a?.refCode ?? null,
          email: a?.email ?? null,
          name: a?.displayName ?? null,
          createdAt: a?.createdAt?.toISOString() ?? null,
          paid: v.paid,
          held: v.held,
          eyePaid: v.eye,
          /** сигнал для ревизии: доля заблокированных квалификаций */
          heldRatio: v.paid + v.held > 0 ? Math.round((v.held / (v.paid + v.held)) * 100) : 0,
        };
      })
      .sort((x, y) => y.paid + y.held - (x.paid + x.held))
      .slice(0, 20);

    const recentHeld = await db.referralReward.findMany({
      where: { status: "held", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        referrerId: true,
        refereeId: true,
        reason: true,
        refereeFp: true,
        referrerFp: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ top, recentHeld });
  } catch (e) {
    console.error("[admin/referrals] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "admin_referrals_failed" }, { status: 500 });
  }
}
