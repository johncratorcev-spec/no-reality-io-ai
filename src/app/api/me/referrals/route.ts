import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { deriveRefCode } from "@/lib/referral";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/referrals — реферальный прогресс текущей сессии (v5 → v7.1).
 *
 * Видимость заработка (ТЗ v5): сколько приведённые ставки/покупки принесли
 * в USDT, сколько людей конвертировалось, последние события. Субъект —
 * nr_uid (мгновенный аккаунт / google / magic); legacy-куки кошельков
 * читаются для старых сессий. Без сессии — нули.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`me-ref:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const wallet =
    req.cookies.get("nr_wallet")?.value?.toLowerCase() ||
    req.cookies.get("nr_phantom")?.value?.toLowerCase() ||
    null;
  if (!wallet) {
    /* v7.1: единый аккаунт nr_uid — рефералка работает без кошелька */
    const uid = req.cookies.get("nr_uid")?.value;
    if (uid && /^[0-9a-f-]{36}$/i.test(uid)) {
      return referralView(`uid:${uid.toLowerCase()}`);
    }
    return NextResponse.json({ connected: false, ratePct: 0.2 });
  }

  return referralView(wallet);
}

/** реферальный реестр по субъекту сессии (uid:/legacy-кошелёк) */
async function referralView(subject: string) {
  try {
    const code = deriveRefCode(subject);
    const events = await db.referralEvent.findMany({
      where: { refCode: code, kind: "paid" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { orderId: true, amountUsdt: true, payoutUsdt: true, createdAt: true },
    });
    const allPaid = await db.referralEvent.findMany({
      where: { refCode: code, kind: "paid" },
      select: { payoutUsdt: true },
    });

    // payoutUsdt — decimal-строка; суммируем аккуратно в центы
    const totalCents = allPaid.reduce(
      (s, e) => s + Math.round(Number(e.payoutUsdt ?? 0) * 100),
      0
    );

    return NextResponse.json({
      connected: true,
      ratePct: 0.2,
      code,
      invitedPaid: allPaid.length,
      earnedUsdt: (totalCents / 100).toFixed(2),
      recent: events.map((e) => ({
        orderId: e.orderId,
        amountUsdt: e.amountUsdt,
        payoutUsdt: e.payoutUsdt,
        at: e.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ connected: true, ratePct: 0.2, code: null, invitedPaid: 0, earnedUsdt: "0.00", recent: [] });
  }
}
