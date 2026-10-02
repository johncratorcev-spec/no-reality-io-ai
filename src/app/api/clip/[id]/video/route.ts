import { NextRequest, NextResponse } from "next/server";
import { clipById } from "@/lib/clips";

export const dynamic = "force-dynamic";

/**
 * GET /api/clip/[id]/video — ПРОКСИ видео клипа.
 *
 * video_url (CDN) живёт только на сервере (ТЗ: «video_url только серверу»).
 * Клиент во всех местах (лента, раунд, превью) играет этот маршрут.
 * Range-запросы пробрасываются, чтобы работал seek/скраб на мобильных.
 * Метка/автор/исходная ссылка здесь не участвуют вовсе.
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
  if (!clip || !clip.videoUrl || clip.status === "void") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const range = req.headers.get("range") || undefined;
  let up: Response;
  try {
    up = await fetch(clip.videoUrl, {
      headers: range ? { Range: range } : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[clip-video] upstream failed", {
      id,
      err: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }

  if (!up.ok && up.status !== 206) {
    console.error("[clip-video] upstream status", { id, status: up.status });
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }

  return new NextResponse(up.body, { status: up.status, headers: passHeaders(up) });
}
