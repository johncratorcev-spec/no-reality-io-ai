import { NextRequest, NextResponse } from "next/server";
import { isValidTrackName, trackEvent } from "@/lib/bet/events";
import { visitorHashOf } from "@/lib/utm";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/track/event — клиентские события аналитики (§4.3.10):
 * clip_view / share_click / prompt_upsell_click / ref_click.
 * sendBeacon-совместимо (текстовое тело). Имена валидируются белым списком,
 * visitorHash считается на сервере — клиент не присылает PII.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ua = req.headers.get("user-agent") || "unknown";

  const rl = rateLimit(`track:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = body.name;
  if (!isValidTrackName(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const clipCode =
    typeof body.clip === "string" && /^[\w-]{0,64}$/.test(body.clip)
      ? body.clip
      : "";

  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};

  await trackEvent(name, {
    clipCode,
    visitorHash: visitorHashOf(ip, ua),
    meta,
  });

  return NextResponse.json({ ok: true });
}
