import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { POSTS_CSV_SNAPSHOT } from "./posts.snapshot";

export interface FeedMedia {
  type: "image" | "video";
  url: string;
}

export interface FeedPost {
  url: string;          // оригинальная ссылка на пост в Threads
  title: string;
  author: string;
  utmCode: string;
  videoUrl: string;     // прямой MP4 для встраивания (CDN Threads)
  media?: FeedMedia[];  // карусель (фото/видео-слайды, JSON из колонки media)
  boostUntil?: number;  // unix ms: пост поднят на первое место до этого момента
  badge?: string;       // анимированный бейдж на карточке (напр. "CREEPY")
  pin?: number;         // абсолютный слот в ленте (1 — самая верхняя карточка)
  // --- платный промпт (маркетплейс) ---
  // ВАЖНО: prompt_full сюда НЕ добавляем — posts.csv сериализуется на клиент
  // (RSC-пейлоад). Полный текст живёт в lib/prompts/paid.ts (server-only).
  isPaid?: boolean;      // промпт продаётся
  priceUsdt?: string;    // цена в USDT, decimal-строка ("3.00")
  promptPreview?: string; // публичный тизер промпта (виден до оплаты)
  sellerWallet?: string; // USDT-кошелёк автора (публичный блокчейн-адрес)
}

/** Колонка media: компактный JSON [{"t":"i"|"v","u":"https://…"}] → слайды */
function parseMedia(raw: string): FeedMedia[] | undefined {
  const s = (raw || "").trim();
  if (!s.startsWith("[")) return undefined;
  try {
    const arr = JSON.parse(s) as Array<{ t?: string; u?: string }>;
    const media = arr
      .map((m) => ({
        type: m.t === "v" ? ("video" as const) : ("image" as const),
        url: (m.u || "").trim(),
      }))
      .filter((m) => m.url.startsWith("http"));
    return media.length > 0 ? media : undefined;
  } catch {
    return undefined;
  }
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

/* mtime-ключ снапшота: fs недоступен → парсим встроенную копию один раз */
const SNAPSHOT_MTIME = -2;

let cache: PostCache | null = null;

function csvPath(): string {
  return path.join(process.cwd(), "data", "posts.csv");
}

function load(): PostCache {
  let mtimeMs: number;
  let raw: string;

  try {
    const p = csvPath();
    mtimeMs = fs.statSync(p).mtimeMs;
    raw = fs.readFileSync(p, "utf-8");
  } catch {
    // serverless: CSV не попал в бандл — берём встроенную копию из сборки
    mtimeMs = SNAPSHOT_MTIME;
    raw = POSTS_CSV_SNAPSHOT;
  }

  if (cache && cache.mtimeMs === mtimeMs) return cache;
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
    const media = parseMedia(row.media || "");

    // неполная строка — в ленту не идёт (видео ИЛИ хотя бы один слайд карусели)
    if (!url || !utmCode || (!videoUrl && !media)) continue;

    const boostRaw = (row.boost_until || "").trim();
    const boostMs = boostRaw ? Date.parse(boostRaw) : NaN;
    const pin = Number.parseInt((row.pin || "").trim(), 10);

    const isPaidRaw = (row.is_paid || "").trim().toLowerCase();
    const isPaid = isPaidRaw === "1" || isPaidRaw === "true" || isPaidRaw === "yes";
    const priceUsdt = (row.price_usdt || "").trim();
    const promptPreview = (row.prompt_preview || "").trim();
    const sellerWallet = (row.seller_wallet || "").trim();

    const post: FeedPost = {
      url,
      title: (row.title || "").trim(),
      author: (row.author || "").trim(),
      utmCode,
      videoUrl,
      ...(media ? { media } : {}),
      ...(Number.isFinite(boostMs) ? { boostUntil: boostMs } : {}),
      ...((row.badge || "").trim()
        ? { badge: (row.badge || "").trim().toUpperCase() }
        : {}),
      ...((row.pin || "").trim() && Number.isFinite(pin) ? { pin } : {}),
      ...(isPaid ? { isPaid: true } : {}),
      ...(isPaid && priceUsdt ? { priceUsdt } : {}),
      ...(promptPreview ? { promptPreview } : {}),
      ...(sellerWallet ? { sellerWallet } : {}),
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
