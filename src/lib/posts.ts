import { db } from "@/lib/db";
import { getPostsFromCSV, toClientPosts, type ClientPost, type FeedPost } from "@/lib/csv";
import { isBoosted } from "@/lib/boost";

export type RankedPost = FeedPost & { score: number };
export type ClientRankedPost = ClientPost & { score: number };

/**
 * Единственная реализация "ленты с рейтингом":
 * CSV + score из БД. Бустнутые (24ч) посты стоят первыми,
 * дальше — по уникальным кликам.
 *
 * Дедуп-гард (task 42, пункт 5): у каждого поста уникальный utm_code и
 * video_url; одинаковые (author + title) считаются репостом того же
 * ролика — остаётся первая (приоритетная) строка.
 */
export async function getRankedPosts(): Promise<RankedPost[]> {
  const posts = getPostsFromCSV();

  /* ---- дедуп ---- */
  const seenCode = new Set<string>();
  const seenVideo = new Set<string>();
  const seenAuthorTitle = new Set<string>();
  const unique: typeof posts = [];
  for (const p of posts) {
    const code = p.utmCode?.trim().toLowerCase();
    if (!code || seenCode.has(code)) continue;
    seenCode.add(code);
    const vid = (p.videoUrl ?? "").trim().toLowerCase();
    if (vid) {
      if (seenVideo.has(vid)) continue;
      seenVideo.add(vid);
    }
    const atKey = `${(p.author ?? "").trim().toLowerCase()}|${(p.title ?? "")
      .trim()
      .toLowerCase()}`;
    if (p.title?.trim() && seenAuthorTitle.has(atKey)) continue;
    if (p.title?.trim()) seenAuthorTitle.add(atKey);
    unique.push(p);
  }

  const scoreMap = new Map<string, number>();
  try {
    const stats = await db.postStats.findMany({
      where: { utmCode: { in: unique.map((p) => p.utmCode) } },
    });
    for (const s of stats) scoreMap.set(s.utmCode, s.score);
  } catch (e) {
    // serverless: БД может быть недоступна — лента работает без рейтинга
    console.warn(
      "[posts] рейтинги недоступны:",
      e instanceof Error ? e.message : e
    );
  }

  return unique
    .map((p) => ({ ...p, score: scoreMap.get(p.utmCode) ?? 0 }))
    .sort((a, b) => {
      // запиненные (колонка pin) — абсолютные слоты поверх всего остального
      const pa = a.pin ?? 0;
      const pb = b.pin ?? 0;
      if (pa || pb) {
        if (pa && pb) return pa - pb; // оба запинены — по номеру слота
        return pa ? -1 : 1;
      }
      const ba = isBoosted(a) ? 1 : 0;
      const bb = isBoosted(b) ? 1 : 0;
      if (ba !== bb) return bb - ba; // бустнутые — наверх
      if (ba && bb) {
        // оба в бусте: свежий буст выше
        return (b.boostUntil ?? 0) - (a.boostUntil ?? 0) || b.score - a.score;
      }
      return b.score - a.score;
    });
}

/**
 * Клиентский срез ленты: truth (кураторский вердикт REAL/SYNTH) вырезается
 * ДО сериализации в RSC-пейлоад. Иначе игрок читает ответ из view-source —
 * и рынок мёртв. bettable=true не раскрывает, КАКАЯ правда.
 */
export function toClientRankedPosts(posts: RankedPost[]): ClientRankedPost[] {
  return toClientPosts(posts) as ClientRankedPost[];
}
