import fs from "fs";
import path from "path";
import Papa from "papaparse";

export interface FeedPost {
  url: string;          // оригинальная ссылка на пост в Threads
  title: string;
  author: string;
  utmCode: string;
  videoUrl: string;     // прямой MP4 для встраивания (CDN Threads)
  boostUntil?: number;  // unix ms: пост поднят на первое место до этого момента
}

/**
 * Единственный источник правды — /data/posts.csv.
 * Посты без video_url не попадают в ленту (ссылка может быть протухшей
 * или пост удалён в Threads — строка остаётся в CSV на будущее).
 *
 * Парсим только при изменении mtime файла: /r/[code] — горячий путь,
 * полный парс на каждый клик недопустим.
 */

interface PostCache {
  mtimeMs: number;
  posts: FeedPost[];
  byCode: Map<string, FeedPost>;
}

const EMPTY: PostCache = { mtimeMs: -1, posts: [], byCode: new Map() };

let cache: PostCache | null = null;

function csvPath(): string {
  return path.join(process.cwd(), "data", "posts.csv");
}

function load(): PostCache {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(csvPath()).mtimeMs;
  } catch {
    return EMPTY; // файла нет — пустая лента
  }

  if (cache && cache.mtimeMs === mtimeMs) return cache;

  let raw = "";
  try {
    raw = fs.readFileSync(csvPath(), "utf-8");
  } catch {
    return EMPTY;
  }

  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const posts: FeedPost[] = [];
  const byCode = new Map<string, FeedPost>();

  for (const row of parsed.data) {
    const url = (row.url || "").trim();
    const utmCode = (row.utm_code || "").trim();
    const videoUrl = (row.video_url || "").trim();

    if (!url || !utmCode || !videoUrl) continue; // неполная строка — в ленту не идёт

    const boostRaw = (row.boost_until || "").trim();
    const boostMs = boostRaw ? Date.parse(boostRaw) : NaN;

    const post: FeedPost = {
      url,
      title: (row.title || "").trim(),
      author: (row.author || "").trim(),
      utmCode,
      videoUrl,
      ...(Number.isFinite(boostMs) ? { boostUntil: boostMs } : {}),
    };
    posts.push(post);
    byCode.set(utmCode, post);
  }

  cache = { mtimeMs, posts, byCode };
  return cache;
}

export function getPostsFromCSV(): FeedPost[] {
  return load().posts;
}

export function getPostByCode(code: string): FeedPost | undefined {
  return load().byCode.get(code);
}
