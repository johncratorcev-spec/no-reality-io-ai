import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession, legacyKeyMatches, adminCodeMatches } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { labelCommitOf, scrubCaption } from "@/lib/clips";
import { checkVideoAlive } from "@/lib/bet/core";
import { parsePostInput, jinaMeta, verifyVideoUrl } from "@/lib/panel_extract";

export const dynamic = "force-dynamic";

/**
 * v14 — приём клипов в очередь (ТЗ §Авторезолв).
 *
 * POST /api/admin/clips — секрет админа (сессия BD-панели, ?key= или
 * заголовок x-admin-secret):
 *
 *   { sourceUrl, videoUrl, label }  → статус queued СРАЗУ.
 *   { input, label }                → Threads/X-ссылка: парсим автора/
 *                                     подпись, videoUrl обязателен.
 *   { status: "draft" }             → черновик в очередь не идёт (опционально);
 *                                     дефолт — queued (ТЗ: «Дом ставит queued сразу»).
 *
 * БЕЗ МЕТКИ — 400 (ТЗ: «Без метки — 400»). Метка — real|synth.
 * label_commit считается на сервере из COMMIT_PEPPER (env).
 * Подпись проходит фильтр генеративных маркеров (seedance/higgsfield/
 * kling/runway/veo/ai/prompt/нейро) — помеченное в раунд не отдаётся.
 * Позже тот же вход откроется пользователю планировщиком — правила
 * метки те же.
 *
 * GET — очередь/жизненный цикл клипов (для BD-дашборда; автор виден
 * только админу — клиентский payload автора не отдаёт).
 */

function authorized(req: NextRequest): boolean {
  if (hasAdminSession(req)) return true;
  if (legacyKeyMatches(req.nextUrl.searchParams.get("key"))) return true;
  const hdr = req.headers.get("x-admin-secret");
  return Boolean(hdr && adminCodeMatches(hdr));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const clips = await db.clip.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true,
        status: true,
        captionPublic: true,
        authorHandle: true,
        labelCommit: true,
        opensAt: true,
        closesAt: true,
        resolvedAt: true,
        listedBy: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      ok: true,
      clips: clips.map((c) => ({
        id: c.id,
        status: c.status,
        caption: c.captionPublic,
        author: c.authorHandle, // только админ; публичный payload автора не отдаёт
        labelCommit: c.labelCommit,
        opensAt: c.opensAt?.toISOString() ?? null,
        closesAt: c.closesAt?.toISOString() ?? null,
        resolvedAt: c.resolvedAt?.toISOString() ?? null,
        listedBy: c.listedBy,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[admin/clips] GET failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin-clips:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: {
    sourceUrl?: unknown;
    videoUrl?: unknown;
    label?: unknown;
    input?: unknown;
    listedBy?: unknown;
    status?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  /* ---- метка обязательна (ТЗ: «Без метки — 400») ---- */
  const label = typeof body.label === "string" ? body.label.trim().toLowerCase() : "";
  if (label !== "real" && label !== "synth") {
    return NextResponse.json(
      { error: "label_required", message: "label must be real|synth" },
      { status: 400 }
    );
  }

  let sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  let videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  let authorHandle = "";
  let captionRaw = "";

  /* ---- Threads/X-ссылка: достаём автора/подпись сами, видео вручную ---- */
  if (typeof body.input === "string" && body.input.trim()) {
    const parsed = parsePostInput(body.input.trim());
    if (!parsed) {
      return NextResponse.json(
        { error: "bad_input", message: "cannot parse threads/x link" },
        { status: 400 }
      );
    }
    sourceUrl = parsed.url;
    const meta = await jinaMeta(parsed.url).catch(() => null);
    if (meta) {
      authorHandle = meta.author || "";
      captionRaw = meta.title || "";
    }
  }

  if (!/^https?:\/\//i.test(sourceUrl) || !/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json(
      { error: "bad_input", message: "sourceUrl and videoUrl required (or parsable input)" },
      { status: 400 }
    );
  }

  /* видео должно быть живым (битая ссылка недопустима даже в очереди) */
  const alive = (await verifyVideoUrl(videoUrl)) || (await checkVideoAlive(videoUrl));
  if (!alive) {
    return NextResponse.json(
      { error: "dead_video", message: "video url did not respond as video" },
      { status: 422 }
    );
  }

  const listedBy =
    typeof body.listedBy === "string" && body.listedBy.trim()
      ? body.listedBy.trim().slice(0, 40)
      : "bd";

  /* ТЗ-энум статусов: draft | queued | live | resolved | void.
     Админ создаёт либо draft (отложить), либо queued (дефолт ТЗ) */
  const initialStatus = body.status === "draft" ? "draft" : "queued";

  /* id — короткий публичный код (ничего не раскрывает) */
  const id = generateClipId();

  try {
    const clip = await db.clip.create({
      data: {
        id,
        sourceUrl,
        videoUrl,
        authorHandle,
        captionPublic: scrubCaption(captionRaw),
        label,
        labelCommit: labelCommitOf(id, label),
        status: initialStatus,
        listedBy,
      },
    });
    return NextResponse.json({
      ok: true,
      clip: {
        id: clip.id,
        status: clip.status,
        labelCommit: clip.labelCommit,
        caption: clip.captionPublic,
        createdAt: clip.createdAt.toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique")) {
      return NextResponse.json(
        { error: "duplicate", message: "source_url already listed" },
        { status: 409 }
      );
    }
    console.error("[admin/clips] POST failed:", msg);
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function generateClipId(): string {
  let s = "";
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  return s;
}
