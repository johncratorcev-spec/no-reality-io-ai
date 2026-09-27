import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  hasAdminSession,
  legacyKeyMatches,
  adminConfigured,
} from "@/lib/admin/session";
import { runRefreshJob } from "@/lib/refresh";
import { isServerless } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Ручной триггер джобы обновления ссылок.
 * GET /api/admin/refresh?key=<ADMIN_SECRET>
 * Защита: секрет + rate limit (5 запросов/мин на IP).
 * На serverless (Netlify) недоступна: нет python/headless-браузера —
 * CSV обновляется коммитом в репозиторий (редеплой).
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rl = rateLimit(`admin:refresh:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  if (isServerless()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "refresh job is not available on serverless: update data/posts.csv via git commit (auto-redeploy)",
      },
      { status: 501 }
    );
  }

  /* v7: сессия (cookie nr_admin) или легаси-ключ — оба timing-safe. */
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  const legacyKey =
    req.nextUrl.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!hasAdminSession(req) && !legacyKeyMatches(legacyKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRefreshJob();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
