import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
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

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  if (!key || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRefreshJob();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
