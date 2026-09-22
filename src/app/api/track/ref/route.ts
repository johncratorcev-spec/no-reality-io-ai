import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { FEATURES } from "@/lib/features";
import {
  normalizeOwnerCode,
  normalizeTargetId,
  normalizeTargetType,
  recordUtmClick,
  visitorHashOf,
} from "@/lib/utm";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/track/ref — учёт перехода по ПЕРСОНАЛЬНОЙ ссылке
   (task 44, ТЗ §5). Клиент (TrackVisit) биконит { ref, targetType,
   targetId }, когда на любой странице сидит ?ref=rXXX.

   Дедуп по unique(ownerCode, targetType, targetId, visitorHash):
   один visitor считается на объект один раз. Ответ 204 — fire-and-forget.
   ================================================================ */

export async function POST(req: NextRequest) {
  if (!FEATURES.utmTracking) {
    return new NextResponse(null, { status: 204 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`track:ref:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return new NextResponse(null, { status: 204 });
  }

  let body: { ref?: unknown; targetType?: unknown; targetId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const ownerCode = normalizeOwnerCode(body.ref);
  if (!ownerCode) {
    return new NextResponse(null, { status: 204 });
  }

  const ua = req.headers.get("user-agent") || "unknown";
  await recordUtmClick({
    ownerCode,
    targetType: normalizeTargetType(body.targetType),
    targetId: normalizeTargetId(body.targetId),
    visitorHash: visitorHashOf(ip, ua),
  });

  return new NextResponse(null, { status: 204 });
}
