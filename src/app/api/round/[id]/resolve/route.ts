import { NextRequest, NextResponse } from "next/server";
import { resolveExpiredRounds, resolveRound } from "@/lib/bet/core";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/round/:id/resolve?key=<ADMIN_SECRET> — точка внешнего cron'а
 * (§4.3.5). Дублирует ленивый резолв в /api/round на случай, если в момент
 * истечения окна никто не смотрит ленту. Идемпотентно: повторный вызов
 * по уже решённому раунду вернёт resolved: null.
 *
 * :id = "expired" — пакетный прогон по всем просроченным (до 25 раундов).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`roundresolve:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const key = req.nextUrl.searchParams.get("key") || "";
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  if (key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    if (id === "expired") {
      const n = await resolveExpiredRounds(25);
      return NextResponse.json({ ok: true, resolvedCount: n });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "bad round id" }, { status: 400 });
    }
    const summary = await resolveRound(id);
    return NextResponse.json({ ok: true, resolved: summary });
  } catch (e) {
    console.error("[round:resolve] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "resolve_failed" }, { status: 500 });
  }
}
