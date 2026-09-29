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

  /* v9: проба АВТОРИЗАЦИИ — ровно тот узел, который упал на проде v8
     (стейл Prisma-клиент без модели EmailAuth → 500 на регистрации).
     db=up + auth=down ⇒ деплой со старым клиентом: пересобрать
     (prisma generate в build) и перезадеплоить. */
  let authState = "up";
  try {
    await db.emailAuth.findFirst({ select: { accountId: true }, take: 1 });
    await db.promoCode.findFirst({ select: { id: true }, take: 1 });
  } catch {
    authState = "down";
  }

  return NextResponse.json(
    {
      ok: true,
      db: dbState,
      auth: authState,
      ts: new Date().toISOString(),
      /* v8: явный отпечаток билда — раньше фолбэк "v6" маскировал
         актуальный деплой (npm_package_version недоступен в рантайме) */
      version: process.env.APP_VERSION || "v10",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
