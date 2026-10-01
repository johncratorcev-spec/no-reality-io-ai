import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authedAccountId } from "@/lib/auth/session";
import { activeSeason, seasonLeaderboard } from "@/lib/bet/stats";

export const dynamic = "force-dynamic";

/**
 * v13 — GET /api/leaderboard: публичный лидерборд «Глаз Бога» текущего сезона.
 *
 *   ?limit=N (default 50, max 100) — размер топа;
 *   своя позиция возвращается ВСЕГДА (me), даже если игрок вне топа
 *   (берётся сессия nr_uid/nr_auth — как у /api/me).
 *
 * В зачёт: settled-ставки (won|lost) сезона с accountId, минимум 3 ставки.
 * Ответ: { ok, season, top[], me, updatedAt }.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`lb:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(10, Math.min(100, Math.floor(limitRaw)))
      : 50;

    const season = await activeSeason();
    const meId = await authedAccountId(req);
    const { top, me } = await seasonLeaderboard(season, { meId, limit });

    return NextResponse.json(
      {
        ok: true,
        season: season
          ? {
              code: season.code,
              name: season.name,
              endsAt: season.endsAt.toISOString(),
            }
          : null,
        top,
        me,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[leaderboard] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
