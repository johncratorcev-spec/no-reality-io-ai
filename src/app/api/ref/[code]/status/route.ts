import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRefCode } from "@/lib/referral";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/ref/[code]/status — публичный статус ссылки (ТЗ: «До оплаты
 * на ней текст "процент выключен"»). Никаких персональных данных:
 * только включён ли процент у владельца кода.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const rl = rateLimit(`ref-status:${req.headers.get("x-forwarded-for") || "local"}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const { code } = await ctx.params;
  const normalized = normalizeRefCode(code);
  if (!normalized) {
    return NextResponse.json({ ok: false, active: false, exists: false });
  }
  try {
    const acc = await db.account.findUnique({
      where: { refCode: normalized },
      select: { revshare: true },
    });
    return NextResponse.json({
      ok: true,
      exists: Boolean(acc),
      active: Boolean(acc?.revshare),
    });
  } catch {
    return NextResponse.json({ ok: false, active: false, exists: false });
  }
}
