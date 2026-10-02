import { NextRequest, NextResponse } from "next/server";
import { legacyKeyMatches, hasAdminSession } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { REF_PAYOUT_THRESHOLD_CENTS } from "@/lib/referral";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * v14 — USDT-выплаты пригласившим (ТЗ: «Выплата от 5 USDT, иначе копится
 * на балансе пригласившего»).
 *
 * GET  /api/admin/ref-payout — кто накопил ≥ 5 USDT (ревью перед выплатой).
 * POST /api/admin/ref-payout { accountId } — зафиксировать выплату:
 *   pending → paid (earned −= сумма, paid += сумма). Сам перевод USDT
 *   делает BD вне системы; здесь — реестр и порог.
 */

export async function GET(req: NextRequest) {
  if (!hasAdminSession(req) && !legacyKeyMatches(req.nextUrl.searchParams.get("key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.account.findMany({
    where: { refEarnedCents: { gt: 0 } },
    select: {
      id: true,
      displayName: true,
      tgUsername: true,
      revshare: true,
      refEarnedCents: true,
      refPaidCents: true,
      refBurnedCents: true,
    },
    orderBy: { refEarnedCents: "desc" },
    take: 100,
  });
  return NextResponse.json({
    ok: true,
    thresholdUsdtCents: REF_PAYOUT_THRESHOLD_CENTS,
    accounts: rows.map((a) => ({
      id: a.id,
      name: a.displayName || (a.tgUsername ? `@${a.tgUsername}` : "player"),
      revshare: a.revshare,
      earnedUsdtCents: a.refEarnedCents,
      paidUsdtCents: a.refPaidCents,
      burnedUsdtCents: a.refBurnedCents,
      pendingUsdtCents: Math.max(0, a.refEarnedCents - a.refPaidCents),
      payable: a.refEarnedCents - a.refPaidCents >= REF_PAYOUT_THRESHOLD_CENTS,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!hasAdminSession(req) && !legacyKeyMatches(req.nextUrl.searchParams.get("key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`ref-payout:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  let body: { accountId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  try {
    const res = await db.$transaction(async (tx) => {
      const acc = await tx.account.findUnique({
        where: { id: accountId },
        select: { refEarnedCents: true, refPaidCents: true },
      });
      if (!acc) return null;
      const pending = acc.refEarnedCents - acc.refPaidCents;
      if (pending < REF_PAYOUT_THRESHOLD_CENTS) return { below_threshold: true, pending };
      /* v14 модель: refEarnedCents — НАКОПЛЕННЫЙ итог (вебхук только
         инкрементит), refPaidCents — суммарно выплачено; остаток =
         earned − paid. Выплата переносит остаток в paid, earned не
         трогаем — иначе следующий цикл «pack → pending» сломается
         (pending стал бы отрицательным). */
      await tx.account.update({
        where: { id: accountId },
        data: {
          refPaidCents: { increment: pending },
        },
      });
      return { paidUsdtCents: pending };
    });
    if (!res) {
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }
    if ("below_threshold" in res && res.below_threshold) {
      return NextResponse.json(
        { error: "below_threshold", pendingUsdtCents: res.pending },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error("[admin/ref-payout] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
