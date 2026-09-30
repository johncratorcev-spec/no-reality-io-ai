import { NextResponse } from "next/server";
import { seasonInfo } from "@/lib/season";

export const dynamic = "force-dynamic";

/**
 * GET /api/season — публичный статус сезона (создаёт Season s1 при первом
 * визите, идемпотентно). Лендинг («Season 1 live» + дата среза) и
 * профиль (серая строка «Season 1 · snapshot in N days») читают отсюда.
 */
export async function GET() {
  try {
    const info = await seasonInfo();
    if (!info) {
      return NextResponse.json({ error: "season_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, season: info });
  } catch (e) {
    console.error("[season] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "season_unavailable" }, { status: 503 });
  }
}
