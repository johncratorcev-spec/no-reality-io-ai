import { NextRequest, NextResponse } from "next/server";
import { tickGame } from "@/lib/bet/core";
import { adminCodeMatches, legacyKeyMatches } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/tick — внешний страхующий тик планировщика игры.
 *
 * Игра в основном живёт лениво (каждый запрос /api/round и /bet тикает),
 * но когда в окне никто не смотрит, раунд должен всё равно закрыться и
 * открыться следующий. Внешний крон (Vercel Cron / cron-job.org, минута)
 * дергает этот эндпоинт с секретом: ?key=<ADMIN_SECRET> или заголовок
 * x-admin-secret, либо заголовок x-cron-secret == CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`cron-tick:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const keyOk = legacyKeyMatches(req.nextUrl.searchParams.get("key"));
  const hdrOk = adminCodeMatches(req.headers.get("x-admin-secret") || "");
  const cronSecret = process.env.CRON_SECRET || "";
  /* Vercel Cron: GET /api/cron/tick с `authorization: Bearer <CRON_SECRET>`
     (Vercel сам подставляет bearer из env CRON_SECRET для vercel.json crons) */
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const externalSecret = req.headers.get("x-cron-secret") || "";
  const secretOk = Boolean(
    cronSecret &&
      (bearer === cronSecret || externalSecret === cronSecret)
  );
  if (!keyOk && !hdrOk && !secretOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const r = await tickGame();
    return NextResponse.json({ ok: true, ...r, ts: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/tick] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "tick_failed" }, { status: 503 });
  }
}
