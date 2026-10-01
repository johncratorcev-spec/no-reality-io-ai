import fs from "node:fs";
import Papa from "papaparse";
import { customAlphabet } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, hasAdminSession } from "@/lib/admin/session";
import { commitFile, getCsvFromGitHub, ghEnabled } from "@/lib/panel_github";
import { jinaMeta, parsePostInput, verifyVideoUrl } from "@/lib/panel_extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * v13 — POST /api/admin/bd/add-video: быстрая заливка клипа BD.
 *
 * Доступ: только сессия nr_admin. Источники: Threads (полный парсинг)
 * и X/Twitter (метаданные best-effort, адрес видео — вручную: у X нет
 * публичного прямого mp4 без авторизации — это честное ограничение).
 *
 * Запись: dev/sandbox — атомарный append в data/posts.csv;
 * serverless (Vercel) — коммит data/posts.csv в GitHub (автодеплой).
 * truth: real|synth — BD помечает сразу (раунд станет ставочным),
 * пусто — раунд закрывается вручную через Oracle Console.
 */

const SERVERLESS = !!(process.env.VERCEL || process.env.NETLIFY);
const CSV_PATH = () => `${process.cwd()}/data/posts.csv`;

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_",
  8
);

interface Body {
  url?: string;
  title?: string;
  author?: string;
  video?: string;
  badge?: string;
  truth?: string;
  mood?: string;
}

/** x.com / twitter.com status → { id, url } | null */
function parseXInput(raw: string): { id: string; url: string } | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[0-9]{15,20}$/.test(s)) {
    return { id: s, url: `https://x.com/i/web/status/${s}` };
  }
  const m = s.match(
    /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,20}\/status\/([0-9]{15,20})/i
  );
  if (m) return { id: m[1], url: s.split("?")[0] };
  return null;
}

function isDupe(rows: Record<string, string>[], code: string): boolean {
  return rows.some((r) => {
    const u = (r.url || "").trim();
    return u.includes(`/share/${code}/`) || u.includes(`/post/${code}`) || u.includes(`/status/${code}`);
  });
}

function buildRow(cols: {
  url: string;
  title: string;
  author: string;
  video: string;
  badge: string;
  truth: string;
  mood: string;
}): Record<string, string> {
  return {
    url: cols.url,
    title: cols.title,
    author: cols.author,
    utm_code: nanoid(),
    video_url: cols.video,
    boost_until: "",
    badge: cols.badge,
    pin: "",
    is_paid: "",
    price_usdt: "",
    prompt_preview: "",
    seller_wallet: "",
    media: "",
    truth: cols.truth,
    mood: cols.mood,
  };
}

export async function POST(req: NextRequest) {
  if (!adminConfigured() || !hasAdminSession(req)) {
    return NextResponse.json({ ok: false, error: "access_denied" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateOk(ip)) {
    return NextResponse.json({ ok: false, error: "too_many_requests" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const url = (body?.url ?? "").trim();
  if (!url || url.length > 2000) {
    return NextResponse.json({ ok: false, error: "empty or too long link" }, { status: 400 });
  }
  const truth = ["real", "synth", ""].includes((body?.truth ?? "").trim().toLowerCase())
    ? (body?.truth ?? "").trim().toLowerCase()
    : "";
  const mood = (body?.mood ?? "").trim().slice(0, 24);
  const badge = (body?.badge ?? "").trim().slice(0, 40);
  const video = (body?.video ?? "").trim();
  const titleCustom = (body?.title ?? "").trim();
  const authorCustom = (body?.author ?? "").trim();

  const xPost = parseXInput(url);
  const threads = xPost ? null : parsePostInput(url);
  if (!xPost && !threads) {
    return NextResponse.json(
      { ok: false, error: "cannot parse — paste a Threads or X post link (or a bare code)" },
      { status: 400 }
    );
  }

  const sourceUrl = xPost ? xPost.url : (threads as { url: string }).url;
  const code = xPost ? xPost.id : (threads as { code: string }).code;

  /* --- метаданные: Threads → jina; X → jina best-effort --- */
  let title = titleCustom;
  let author = authorCustom;
  if (!title || !author) {
    try {
      const meta = await jinaMeta(sourceUrl);
      if (meta) {
        if (!title) title = meta.title ?? "";
        if (!author) author = meta.author ?? (xPost ? "" : "@unknown");
      }
    } catch {
      /* метаданные не пришли — заполним вручную */
    }
  }
  if (!title) title = xPost ? `X post ${code}` : "untitled clip";
  if (!author) author = xPost ? "@x-unknown" : "@unknown";
  if (!titleCustom && /[а-яё]/i.test(title)) {
    return NextResponse.json(
      {
        ok: false,
        error: `the post title is not English — put your translation into the title field. Original: ${title.slice(0, 120)}`,
      },
      { status: 400 }
    );
  }

  /* --- адрес видео: у Threads обязателен; у X — из формы (ограничение X) --- */
  let videoUrl = video;
  if (!videoUrl && xPost) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "X does not expose a direct video link publicly — open the post, copy the video address (…mp4) and paste it into the video field",
      },
      { status: 400 }
    );
  }
  if (!videoUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "video URL required: open the post, right-click the video → copy video address (a ….mp4 link)",
      },
      { status: 400 }
    );
  }
  if (!/^https:\/\/[^\s"']+$/.test(videoUrl)) {
    return NextResponse.json({ ok: false, error: "video URL must be https" }, { status: 400 });
  }
  const videoOk = await verifyVideoUrl(videoUrl);
  if (!videoOk) {
    return NextResponse.json(
      { ok: false, error: "the CDN did not serve the video (206 video/mp4) — the link expired or was copied wrong" },
      { status: 400 }
    );
  }

  const row = buildRow({ url: sourceUrl, title, author, video: videoUrl, badge, truth, mood });

  /* --- дубли + запись --- */
  if (SERVERLESS && ghEnabled()) {
    const raw = await getCsvFromGitHub();
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (isDupe(parsed.data ?? [], code)) {
      return NextResponse.json({ ok: false, error: "this post is already in the feed" }, { status: 409 });
    }
    const rowCsv = Papa.unparse([Object.values(row)]);
    /* если в CSV нет новых колонок — допишем заголовок один раз */
    const headerHasAll = (raw.split("\n")[0] || "").includes("truth");
    const nextCsv = headerHasAll
      ? `${raw.replace(/\s*$/, "\n")}${rowCsv}\n`
      : `${raw.replace(/\s*$/, "\n")}${Papa.unparse([row])}\n`;
    const sha = await commitFile(
      "data/posts.csv",
      nextCsv,
      `bd: + ${author}${badge ? ` [${badge}]` : ""} (${code.slice(0, 24)})`
    );
    return NextResponse.json({
      ok: true,
      mode: "serverless",
      result: { code, utm: row.utm_code, author, title: title.slice(0, 200), truth, commit: sha.slice(0, 7) },
    });
  }

  /* dev/sandbox: локальный CSV */
  const raw = fs.readFileSync(CSV_PATH(), "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (isDupe(parsed.data ?? [], code)) {
    return NextResponse.json({ ok: false, error: "this post is already in the feed" }, { status: 409 });
  }
  parsed.data.push(row);
  const out = Papa.unparse(parsed.data, { columns: Object.keys(row) });
  const tmp = `${CSV_PATH()}.tmp`;
  fs.writeFileSync(tmp, out.endsWith("\n") ? out : `${out}\n`, "utf-8");
  fs.renameSync(tmp, CSV_PATH());
  console.log(`[admin/bd/add-video] created: ${row.utm_code} truth=${truth || "-"} src=${xPost ? "x" : "threads"}`);

  return NextResponse.json({
    ok: true,
    mode: "local",
    result: { code, utm: row.utm_code, author, title: title.slice(0, 200), truth },
  });
}

/* простой rate-limit 10/мин на IP (поверх сессии) */
const hits = new Map<string, number[]>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 10) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  return true;
}
