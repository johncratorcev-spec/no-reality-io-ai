import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/boost/status?code=<utm_code> — клиентский поллинг статуса
 * буста на /boost (v5). Активным буст считает только подписанный
 * webhook 2328 (status=paid, paidUntil в будущем) — redirect'ы с
 * чекаута деньгами не считаются.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`boost-status:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const code = (req.nextUrl.searchParams.get("code") || "").trim();
  if (!/^[\w-]{4,16}$/.test(code)) {
    return NextResponse.json({ error: "bad clip code" }, { status: 400 });
  }

  try {
    const order = await db.boostOrder.findFirst({
      where: { clipCode: code, status: "paid", paidUntil: { gt: new Date() } },
      orderBy: { paidUntil: "desc" },
      select: { paidUntil: true },
    });
    return NextResponse.json({
      active: Boolean(order),
      paidUntil: order?.paidUntil?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ active: false, paidUntil: null });
  }
}
