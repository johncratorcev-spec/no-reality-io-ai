import fs from "fs";
import path from "path";
import Papa from "papaparse";

export interface FeedPost {
  url: string;          // оригинальная ссылка на пост в Threads
  title: string;
  author: string;
  utmCode: string;
  videoUrl: string;     // прямой MP4 для встраивания (CDN Threads)
}

/**
 * Единственный источник правды — /data/posts.csv.
 * Посты без video_url не попадают в ленту (ссылка может быть протухшей
 * или пост удалён в Threads — строка остаётся в CSV на будущее).
 */
export function getPostsFromCSV(): FeedPost[] {
  const csvPath = path.join(process.cwd(), "data", "posts.csv");

  let raw = "";
  try {
    raw = fs.readFileSync(csvPath, "utf-8");
  } catch {
    return [];
  }

  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const posts: FeedPost[] = [];
  for (const row of parsed.data) {
    const url = (row.url || "").trim();
    const utmCode = (row.utm_code || "").trim();
    const videoUrl = (row.video_url || "").trim();

    if (!url || !utmCode || !videoUrl) continue; // неполная строка — в ленту не идёт

    posts.push({
      url,
      title: (row.title || "").trim(),
      author: (row.author || "").trim(),
      utmCode,
      videoUrl,
    });
  }

  return posts;
}
