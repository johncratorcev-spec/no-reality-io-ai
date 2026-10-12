import { NextRequest, NextResponse } from "next/server";
import { clipById } from "@/lib/clips";

export const dynamic = "force-dynamic";

/**
 * GET /api/clip/[id]/audio — ПРОКСИ голосового файла (ТЗ §10: «голосовые
 * файлы по прямой ссылке воспроизводятся прямо в UI, нативный плеер»).
 * Прямая ссылка — server-only; клиент играет этот маршрут.
 * Range пробрасывается (seek в нативном плеере).
 */
const UPSTREAM_TIMEOUT_MS = 25_000;

function passHeaders(up: Response): Headers {
  const h = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = up.headers.get(name);
    if (v) h.set(name, v);
  }
  h.set("cache-control", "public, max-age=3600");
  return h;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!/^[\w-]{4,40}$/.test(id)) {
    return NextResponse.json({ error: "bad clip id" }, { status: 400 });
  }

  let clip: Awaited<ReturnType<typeof clipById>> = null;
  try {
    clip = await clipById(id);
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!clip || clip.status === "void") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (clip.mediaType !== "audio") {
    return NextResponse.json({ error: "not an audio clip" }, { status: 404 });
  }

  let audioUrl = "";
  try {
    const raw = JSON.parse(clip.mediaJson || "{}") as { audioUrl?: unknown };
    if (typeof raw.audioUrl === "string") audioUrl = raw.audioUrl;
  } catch {
    audioUrl = "";
  }
  if (!audioUrl) {
    return NextResponse.json({ error: "audio missing" }, { status: 404 });
  }

  try {
    const up = await fetch(audioUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (no-reality media proxy)",
        ...(req.headers.get("range") ? { range: req.headers.get("range") as string } : {}),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!up.ok || !up.body) {
      return NextResponse.json({ error: "upstream failed" }, { status: 502 });
    }
    return new NextResponse(up.body, { status: up.status, headers: passHeaders(up) });
  } catch {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
}
