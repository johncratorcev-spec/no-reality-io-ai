import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { getPostByCode } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * UTM-редирект: считает уникальный клик (dedup по visitor_hash),
 * поднимает видео в рейтинге и перекидывает на пост в Threads.
 *
 * Порядок: сначала lookup поста (мгновенно из кэша CSV) —
 * клики по неизвестным кодам не пишутся в БД вообще.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const post = getPostByCode(code);
  if (!post) {
    return new NextResponse("Not found", { status: 404 });
  }

  // --- visitor fingerprint (анонимный): ip + ua + секрет ---
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  const visitorHash = createHash("sha256")
    .update(`${ip}::${ua}::${secret}`)
    .digest("hex");

  // --- уникальный клик: insert падает на дубле (unique constraint) ---
  let counted = false;
  try {
    await db.click.create({ data: { utmCode: code, visitorHash } });
    counted = true;
  } catch {
    counted = false; // уже считали этого visitor'а по этому коду
  }

  if (counted) {
    await db.postStats.upsert({
      where: { utmCode: code },
      create: { utmCode: code, score: 1 },
      update: { score: { increment: 1 } },
    });
  }

  return NextResponse.redirect(post.url, 302);
}
