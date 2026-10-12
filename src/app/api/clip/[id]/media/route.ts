import { NextRequest, NextResponse } from "next/server";
import { clipById } from "@/lib/clips";

export const dynamic = "force-dynamic";

/**
 * GET /api/clip/[id]/media?i=N — ПРОКСИ фото-слайда карусели (ТЗ §10:
 * «карусели из Threads отображаются полностью, свайп, порядок фото»).
 * Порядок фото — как в исходном посте (mediaJson.photos[]).
 * Исходные ссылки фото — server-only; клиент играет этот маршрут.
 */
const UPSTREAM_TIMEOUT_MS = 15_000;

function passHeaders(up: Response): Headers {
  const h = new Headers();
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const v = up.headers.get(name);
    if (v) h.set(name, v);
  }
  h.set("cache-control", "public, max-age=86400");
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
  const idxRaw = req.nextUrl.searchParams.get("i") || "0";
  const idx = Number.parseInt(idxRaw, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx > 9) {
    return NextResponse.json({ error: "bad slide index" }, { status: 400 });
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
  if (clip.mediaType !== "carousel") {
    return NextResponse.json({ error: "not a carousel" }, { status: 404 });
  }

  let photos: string[] = [];
  try {
    const raw = JSON.parse(clip.mediaJson || "{}") as { photos?: unknown };
    if (Array.isArray(raw.photos)) {
      photos = raw.photos.filter((u): u is string => typeof u === "string" && u.length > 0);
    }
  } catch {
    photos = [];
  }
  const url = photos[idx];
  if (!url) {
    return NextResponse.json({ error: "slide not found" }, { status: 404 });
  }

  try {
    const up = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (no-reality media proxy)" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!up.ok || !up.body) {
      return NextResponse.json({ error: "upstream failed" }, { status: 502 });
    }
    return new NextResponse(up.body, { status: 200, headers: passHeaders(up) });
  } catch {
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  }
}
