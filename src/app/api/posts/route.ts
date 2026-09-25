import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPostsFromCSV, toClientPosts } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * Отдаёт посты из CSV, обогащённые score из БД,
 * отсортированные по рейтингу (уникальные UTM-клики).
 * v2: truth (кураторский вердикт REAL/SYNTH) вырезается — анти-чит.
 */
export async function GET(_req: NextRequest) {
  const posts = getPostsFromCSV();

  const codes = posts.map((p) => p.utmCode);
  const stats = await db.postStats.findMany({
    where: { utmCode: { in: codes } },
  });

  const scoreMap = new Map(stats.map((s) => [s.utmCode, s.score]));

  const enriched = posts
    .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json(
    { posts: toClientPosts(enriched) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
