import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/track — учёт посещений страниц (pageviews).

   Клиент (TrackVisit в layout) отправляет { path, referrer } через
   navigator.sendBeacon — fire-and-forget, ответ не нужен (204).
  visitorHash — анонимный отпечаток ip+ua+секрет (как в r/[code]):
   мы не храним ни IP, ни UA, ни любые персональные данные.

   Записи НЕ дедуплицируются: это честные pageviews. Уникальные
   посетители считаются в /api/admin/stats как COUNT(DISTINCT hash).
   Ошибки БД глотаются (best-effort, как реферальные события):
   трекинг никогда не должен ломать UX.
   ================================================================ */

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // щедрый лимит: обычный серфер не превысит, флуд не зальёт БД
  const rl = rateLimit(`track:${ip}`, 240, 60_000);
  if (!rl.ok) {
    return new NextResponse(null, { status: 204 });
  }

  let path = "";
  let referrer: string | null = null;
  try {
    const body = (await req.json()) as { path?: unknown; referrer?: unknown };
    if (typeof body?.path === "string" && body.path.startsWith("/")) {
      path = body.path.slice(0, 256);
    }
    if (typeof body?.referrer === "string" && body.referrer) {
      referrer = body.referrer.slice(0, 256);
    }
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!path) {
    return new NextResponse(null, { status: 204 });
  }

  // анонимный visitor-хэш: ip + ua + секрет (тот же паттерн, что в Click)
  const ua = req.headers.get("user-agent") || "unknown";
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  const visitorHash = createHash("sha256")
    .update(`${ip}::${ua}::${secret}`)
    .digest("hex");

  try {
    await db.pageVisit.create({ data: { path, visitorHash, referrer } });
  } catch {
    // БД недоступна (serverless-холодный старт и т.п.) — статистика
    // потеряет один pageview, но пользователь ничего не заметит
  }

  return new NextResponse(null, { status: 204 });
}
