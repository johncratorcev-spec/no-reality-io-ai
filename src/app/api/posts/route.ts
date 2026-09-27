import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPostsFromCSV, toClientPosts, type ClientPost } from "@/lib/csv";
import { cacheWrap } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * Отдаёт посты из CSV, обогащённые score из БД,
 * отсортированные по рейтингу (уникальные UTM-клики).
 * v2: truth (кураторский вердикт REAL/SYNTH) вырезается — анти-чит.
 *
 * v7 (п.10/13 ТЗ): обогащение кэшируется на 20с (cacheWrap: memory сейчас,
 * Supabase-адаптер при заданных env) — CSV-парс и запрос score перестают
 * биться на холодных стартах; ответ разрешает edge-кэш (s-maxage 60 +
 * SWR 300 из next.config.ts). no-store убран: truth всё равно вырезан.
 */
export async function GET(_req: NextRequest) {
  const posts: ClientPost[] = await cacheWrap("posts:enriched:v7", 20, async () => {
    const raw = getPostsFromCSV();
    const codes = raw.map((p) => p.utmCode);
    const stats = await db.postStats.findMany({
      where: { utmCode: { in: codes } },
    });
    const scoreMap = new Map(stats.map((s) => [s.utmCode, s.score]));
    const enriched = raw
      .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
      .sort((a, b) => b.score - a.score);
    return toClientPosts(enriched);
  });

  return NextResponse.json({ posts });
}
