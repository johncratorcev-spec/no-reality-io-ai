import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { hasAdminSession } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";
import { getPostsFromCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

/* ================================================================
   v7 — «легко создавать события (фото, видео)» из панели.

   GET  /api/admin/events          — список событий ленты (для панели).
   POST /api/admin/events          — добавить событие строкой в posts.csv:
       { title, author, url?, truth: "real"|"synth", mood?,
         videoUrl?, imageUrl? }        ← фото (imageUrl) или видео (videoUrl)
   Приложение читает CSV с проверкой mtime — новая карточка появляется
   в лентах без перезапуска. utm_code генерируется автоматически (nanoid).
   ================================================================ */

const CSV_PATH = path.join(process.cwd(), "data", "posts.csv");
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function newUtmCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!/^https:\/\/[^\s"'<>]+$/.test(u) || u.length > 2048) return null;
  return u;
}

function safeText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const posts = getPostsFromCSV().map((p) => ({
      code: p.utmCode,
      title: p.title,
      author: p.author,
      truth: p.truth ?? null,
      mood: p.mood ?? null,
      hasVideo: Boolean(p.videoUrl),
      hasPhoto: Boolean(p.media?.some((m) => m.type === "image")),
      boostedUntil: p.boostUntil ?? null,
    }));
    return NextResponse.json({ ok: true, posts });
  } catch {
    return NextResponse.json({ error: "posts_unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin:events:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const title = safeText(body.title, 220);
  const author = safeText(body.author, 80) || "@no-reality";
  const postUrl = httpsUrl(body.url) || "https://www.threads.com/";
  const videoUrl = httpsUrl(body.videoUrl);
  const imageUrl = httpsUrl(body.imageUrl);
  const truthRaw = String(body.truth || "").trim().toLowerCase();
  const truth = truthRaw === "real" || truthRaw === "synth" ? truthRaw : "";
  const moodRaw = String(body.mood || "").trim().toLowerCase();
  const mood = ["swag", "creepy", "future", "ufo"].includes(moodRaw) ? moodRaw : "";

  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (!truth) {
    return NextResponse.json({ error: "truth_required (real|synth)" }, { status: 400 });
  }
  if (!videoUrl && !imageUrl) {
    return NextResponse.json(
      { error: "videoUrl or imageUrl (https) required" },
      { status: 400 }
    );
  }

  /* карусель: фото → слайд i, видео → слайд v (или колонка video_url) */
  const media = videoUrl
    ? ""
    : JSON.stringify([{ t: "i", u: imageUrl }]);

  const row = {
    url: postUrl,
    title,
    author,
    utm_code: newUtmCode(),
    video_url: videoUrl || "",
    boost_until: "",
    badge: "",
    pin: "",
    is_paid: "",
    price_usdt: "",
    prompt_preview: "",
    seller_wallet: "",
    media,
    truth,
    mood,
  };

  try {
    /* папа-парс туда-обратно: не ломаем кавычки/запятые в заголовках */
    const raw = fs.readFileSync(CSV_PATH, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
    });
    parsed.data.push(row);
    const out = Papa.unparse(parsed.data, { columns: Object.keys(row) });
    /* атомарная запись: tmp + rename, чтобы читатели не увидели полстроки */
    const tmp = `${CSV_PATH}.tmp`;
    fs.writeFileSync(tmp, out.endsWith("\n") ? out : `${out}\n`, "utf-8");
    fs.renameSync(tmp, CSV_PATH);
    console.log(`[admin/events] created: code=${row.utm_code} truth=${truth} media=${videoUrl ? "video" : "photo"}`);
    return NextResponse.json({ ok: true, code: row.utm_code, media: videoUrl ? "video" : "photo" });
  } catch (e) {
    console.error("[admin/events] write failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "csv_write_failed" }, { status: 500 });
  }
}
