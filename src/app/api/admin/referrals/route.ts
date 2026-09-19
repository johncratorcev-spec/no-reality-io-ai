import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { referralRatePct } from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/admin/referrals?key=<ADMIN_SECRET> — реестр выплат.

   Отдаёт: агрегаты по каждому коду (оплаты, суммы, доля рефереру),
   профили код→кошелёк и последние события. Выплата — вручную админом
   через 2328.io payouts на кошелёк из профиля; факт оплаты фиксируйте
   у себя (или пометьте событие в БД).
   ================================================================ */

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`admin:referrals:${ip}`, 10, 60_000);
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
    const [events, profiles] = await Promise.all([
      db.referralEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.referralProfile.findMany({ orderBy: { updatedAt: "desc" } }),
    ]);

    // агрегаты по кодам: только оплаченные события дают выплату
    const byCode = new Map<
      string,
      { paidCount: number; amountUsdt: number; payoutUsdt: number; wallets: Set<string> }
    >();
    for (const e of events) {
      if (e.kind !== "paid") continue;
      const agg =
        byCode.get(e.refCode) ??
        { paidCount: 0, amountUsdt: 0, payoutUsdt: 0, wallets: new Set<string>() };
      agg.paidCount += 1;
      agg.amountUsdt += Number(e.amountUsdt ?? 0);
      agg.payoutUsdt += Number(e.payoutUsdt ?? 0);
      byCode.set(e.refCode, agg);
    }

    const payoutList = [...byCode.entries()]
      .map(([code, agg]) => ({
        refCode: code,
        paidCount: agg.paidCount,
        amountUsdt: agg.amountUsdt.toFixed(2),
        payoutUsdt: agg.payoutUsdt.toFixed(2),
        wallet:
          profiles.find((p) => p.code === code)?.wallet ??
          null, // код без профиля: выведем детерминированный хинт ниже
        hint: null as string | null,
      }))
      .sort((a, b) => b.payoutUsdt.localeCompare(a.payoutUsdt));

    // профили могли не доехать до БД (serverless) — тогда код→кошелёк
    // берём у приглашённого: код детерминирован, проверяем хинт для админа
    for (const row of payoutList) {
      if (!row.wallet) row.hint = "код без профиля — запросите кошелёк у владельца";
    }

    return NextResponse.json({
      ok: true,
      ratePct: referralRatePct(),
      totals: {
        paidEvents: payoutList.reduce((s, r) => s + r.paidCount, 0),
        payoutUsdt: payoutList
          .reduce((s, r) => s + Number(r.payoutUsdt), 0)
          .toFixed(2),
      },
      payouts: payoutList,
      profiles: profiles.map((p) => ({
        refCode: p.code,
        wallet: p.wallet,
        createdAt: p.createdAt,
      })),
      events: events.slice(0, 100),
    });
  } catch (e) {
    console.error(
      "[admin/referrals] db unavailable:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      {
        ok: false,
        error: "DB unavailable — reconcile from orderIds at 2328.io dashboard",
      },
      { status: 503 }
    );
  }
}
