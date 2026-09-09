import { db } from "@/lib/db";
import { getPostsFromCSV, type FeedPost } from "@/lib/csv";
import { isBoosted } from "@/lib/boost";

export type RankedPost = FeedPost & { score: number };

/**
 * Единственная реализация "ленты с рейтингом":
 * CSV + score из БД. Бустнутые (24ч) посты стоят первыми,
 * дальше — по уникальным кликам.
 */
export async function getRankedPosts(): Promise<RankedPost[]> {
  const posts = getPostsFromCSV();

  const stats = await db.postStats.findMany({
    where: { utmCode: { in: posts.map((p) => p.utmCode) } },
  });
  const scoreMap = new Map(stats.map((s) => [s.utmCode, s.score]));

  return posts
    .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
    .sort((a, b) => {
      const ba = isBoosted(a) ? 1 : 0;
      const bb = isBoosted(b) ? 1 : 0;
      if (ba !== bb) return bb - ba; // бустнутые — наверх
      return b.score - a.score;
    });
}
