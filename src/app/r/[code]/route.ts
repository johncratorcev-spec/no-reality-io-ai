import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getPostByCode } from "@/lib/csv";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * UTM-редирект: считает уникальный клик (dedup по visitor_hash),
 * поднимает видео в рейтинге и перекидывает на пост в Threads.
 *
 * Порядок: rate limit (флуд/DDoS-защита) → lookup поста (мгновенно из
 * кэша CSV) — клики по неизвестным кодам и превышения лимита
 * в БД не пишутся вообще.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // --- защита от флуда: 30 редиректов/мин на IP, 120/мин на один код ---
  const rlIp = rateLimit(`r:ip:${ip}`, 30, 60_000);
  if (!rlIp.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rlIp.retryAfterSec) },
    });
  }
  const rlCode = rateLimit(`r:code:${code}`, 120, 60_000);
  if (!rlCode.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(rlCode.retryAfterSec) },
    });
  }

  const post = getPostByCode(code);
  if (!post) {
    return new NextResponse("Not found", { status: 404 });
  }

  // --- visitor fingerprint (анонимный): ip + ua + секрет ---
  const ua = req.headers.get("user-agent") || "unknown";
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  const visitorHash = createHash("sha256")
    .update(`${ip}::${ua}::${secret}`)
    .digest("hex");

  // --- уникальный клик: insert падает на дубле (unique constraint) ---
  try {
    const counted = await db.click
      .create({ data: { utmCode: code, visitorHash } })
      .then(
        () => true,
        () => false // дубль этого visitor'а — уже считали
      );
    if (counted) {
      await db.postStats.upsert({
        where: { utmCode: code },
        create: { utmCode: code, score: 1 },
        update: { score: { increment: 1 } },
      });
    }
  } catch {
    // serverless (Netlify): БД может быть недоступна —
    // редирект обязан работать всегда, клик просто не засчитается
  }

  return NextResponse.redirect(post.url, 302);
}
