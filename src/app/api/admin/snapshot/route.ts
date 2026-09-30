import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession, adminConfigured } from "@/lib/admin/session";
import { ensureActiveSeason, snapshotCsv, snapshotRows, seasonView } from "@/lib/season";

export const dynamic = "force-dynamic";

/**
 * v11 — GET /api/admin/snapshot?key=<ADMIN_SECRET> — CSV-срез Season 1.
 *
 * ЕДИНСТВЕННЫЙ АРТЕФАКТ, который продаётся партнёрам на этой неделе:
 *   userId, telegramId, eye, score, bets, correct, weight, displayName
 *
 * Правила среза (объявлены в день старта, зафиксированы на сезон):
 *   - окно: [season.startsAt, season.endsAt);
 *   - валидные ставки = settled (won|lost), попадание в срез при ≥ 5;
 *   - аккаунты «только welcome, 0 ставок» отсеваются автоматически;
 *   - дубли невозможны: telegramId unique на Account;
 *   - weight = eye * min(1, valid_bets / 10) — менять нельзя;
 *   - сортировка по weight desc (сильнейшие сверху).
 *
 * Доступ: ?key= (легаси-curl/скрипты) или cookie nr_admin (панель).
 */
export async function GET(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const season = await ensureActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "season_unavailable" }, { status: 503 });
    }
    const rows = await snapshotRows(season);
    const csv = snapshotCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="snapshot-${season.code}-${stamp}.csv"`,
        "cache-control": "no-store",
        "x-season-ends-at": seasonView(season).endsAt,
        "x-snapshot-rows": String(rows.length),
      },
    });
  } catch (e) {
    console.error("[admin/snapshot] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "snapshot_failed" }, { status: 503 });
  }
}
