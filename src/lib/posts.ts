import { db } from "@/lib/db";
import { getPostsFromCSV, type FeedPost } from "@/lib/csv";

export type RankedPost = FeedPost & { score: number };

/**
 * Единственная реализация "ленты с рейтингом":
 * CSV + score из БД, сортировка по уникальным кликам.
 * Используется серверным рендером страницы.
 */
export async function getRankedPosts(): Promise<RankedPost[]> {
  const posts = getPostsFromCSV();

  const stats = await db.postStats.findMany({
    where: { utmCode: { in: posts.map((p) => p.utmCode) } },
  });
  const scoreMap = new Map(stats.map((s) => [s.utmCode, s.score]));

  return posts
    .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
