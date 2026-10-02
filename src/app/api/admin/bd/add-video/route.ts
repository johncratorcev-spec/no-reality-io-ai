import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, hasAdminSession } from "@/lib/admin/session";
import { jinaMeta, parsePostInput, verifyVideoUrl } from "@/lib/panel_extract";
import { db } from "@/lib/db";
import { labelCommitOf, scrubCaption, competitionOf } from "@/lib/clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * v14 — POST /api/admin/bd/add-video: быстрая заливка клипа BD.
 *
 * Доступ: только сессия nr_admin. Источники: Threads (полный парсинг)
 * и X/Twitter (метаданные best-effort, адрес видео — вручную: у X нет
 * публичного прямого mp4 без авторизации — это честное ограничение).
 *
 * ЗАПИСЬ (v14): строка таблицы clips — CSV и GitHub-коммиты удалены.
 *   status = queued СРАЗУ (ТЗ §Авторезолв: «Дом ставит queued сразу»);
 *   позже планировщик сам откроет окно пользователю — правила метки те же.
 *   label: real|synth — ОБЯЗАТЕЛЕН (без метки — 400).
 *   caption_public проходит фильтр генеративных маркеров.
 */

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

interface Body {
  url?: string;
  title?: string;
  author?: string;
  video?: string;
  badge?: string;
  truth?: string;
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function generateClipId(): string {
  let s = "";
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  return s;
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

  /* --- метка обязательна (ТЗ: «Без метки — 400») --- */
  const truth = (body?.truth ?? "").trim().toLowerCase();
  if (truth !== "real" && truth !== "synth") {
    return NextResponse.json(
      { ok: false, error: "label required: real or synth (no label — no round)" },
      { status: 400 }
    );
  }

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
  let title = (body?.title ?? "").trim();
  let author = (body?.author ?? "").trim();
  if (!title || !author) {
    try {
      const meta = await jinaMeta(sourceUrl);
      if (meta) {
        if (!title) title = meta.title ?? "";
        if (!author) author = meta.author ?? (xPost ? "" : "");
      }
    } catch {
      /* метаданные не пришли — заполним вручную */
    }
  }
  if (!title) title = xPost ? `X post ${code}` : "untitled clip";
  if (!author) author = xPost ? "@x-unknown" : "@unknown";
  if (!(body?.title ?? "").trim() && /[а-яё]/i.test(title)) {
    return NextResponse.json(
      {
        ok: false,
        error: `the post title is not English — put your translation into the title field. Original: ${title.slice(0, 120)}`,
      },
      { status: 400 }
    );
  }

  /* --- адрес видео: у Threads обязателен; у X — из формы (ограничение X) --- */
  const video = (body?.video ?? "").trim();
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

  /* v15 — бейдж соревнования: ТОЛЬКО шаблон raffle-NN (иначе 400);
     пустой бейдж = обычный клип без золота */
  const badgeRaw = (body?.badge ?? "").trim().toLowerCase();
  const competition = competitionOf(badgeRaw);
  if (badgeRaw && !competition) {
    return NextResponse.json(
      { ok: false, error: "badge must match raffle-<number> (e.g. raffle-01) or be empty" },
      { status: 400 }
    );
  }
  const badge = competition ?? "";
  const id = generateClipId();

  /* --- дубли по уникальному source_url + запись в clips --- */
  const dupe = await db.clip.findUnique({ where: { sourceUrl }, select: { id: true } });
  if (dupe) {
    return NextResponse.json({ ok: false, error: "this post is already in the feed" }, { status: 409 });
  }

  try {
    const clip = await db.clip.create({
      data: {
        id,
        sourceUrl,
        videoUrl,
        authorHandle: author,
        captionPublic: scrubCaption(title),
        label: truth,
        labelCommit: labelCommitOf(id, truth),
        status: "queued",
        listedBy: "bd",
        badge,
      },
    });
    console.log(`[admin/bd/add-video] created: ${clip.id} label=${truth} src=${xPost ? "x" : "threads"}`);
    return NextResponse.json({
      ok: true,
      mode: "db",
      result: {
        clipId: clip.id,
        author,
        caption: clip.captionPublic,
        truth,
        status: clip.status,
        labelCommit: clip.labelCommit,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique")) {
      return NextResponse.json({ ok: false, error: "this post is already in the feed" }, { status: 409 });
    }
    console.error("[admin/bd/add-video] failed:", msg);
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 503 });
  }
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
