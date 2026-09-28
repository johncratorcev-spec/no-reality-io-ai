import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — проба живости для мониторинга/отказоустойчивости
 * (Cloudflare failover, uptime-checker'ы).
 *
 * 200 { ok: true, db: "up" }   — приложение и БД живы
 * 200 { ok: true, db: "down" } — приложение живо, БД недоступна
 *                               (лента/статика всё ещё отдаются)
 * 503 никогда не бросаем на db: главный вопрос health-check — жив ли
 * процесс/origin; деградация БД фиксируется полем db.
 */
export async function GET() {
  let dbState = "up";
  try {
    await db.account.findFirst({ select: { id: true }, take: 1 });
  } catch {
    dbState = "down";
  }
  return NextResponse.json(
    {
      ok: true,
      db: dbState,
      ts: new Date().toISOString(),
      /* v8: явный отпечаток билда — раньше фолбэк "v6" маскировал
         актуальный деплой (npm_package_version недоступен в рантайме) */
      version: process.env.APP_VERSION || "v8",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
