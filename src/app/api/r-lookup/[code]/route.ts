import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/r-lookup/[code] — назначение UTM-редиректа одним JSON.

   Нужен Cloudflare Worker'у (task 44, §1): Worker отдаёт 302 САМ
   с грани (мгновенно), а назначение берёт здесь — чтение из
   mtime-кэша CSV, ни одной строки в БД, никакого секрета:
   ссылки на посты публичны. Результат Worker кэширует в KV на час.

   200 → { code, url }   404 → { error } (неизвестный код)
   ================================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // щедро: Worker кэширует ответ, сюда долетают только промахи KV
  const rl = rateLimit(`r-lookup:${ip}`, 300, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(code)) {
    return NextResponse.json({ error: "Bad code" }, { status: 400 });
  }

  const post = getPostByCode(code);
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { code, url: post.url },
    { headers: { "cache-control": "public, max-age=300" } }
  );
}
