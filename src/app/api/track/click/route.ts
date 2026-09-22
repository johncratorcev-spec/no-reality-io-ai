import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";
import { FEATURES } from "@/lib/features";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/track/click — асинхронная запись UTM-клика от
   Cloudflare Worker (task 44, §1): Worker отдаёт 302 мгновенно,
   а клик дописывает сюда через ctx.waitUntil — та же существующая
   БД (Click + PostStats), тот же дедуп по unique(utmCode, visitorHash).

   Аутентификация: заголовок x-nr-worker-key = CLICK_WORKER_SECRET
   (env, совпадает с секретом в wrangler Worker'а). Без FEATURE_CLICK_WORKER
   или без секрета endpoint выключен (501) — обычный /r/[code] живёт как жил.

   Body: { code, visitorHash? } — visitorHash Worker считает сам
   (sha256 ip+ua+секрет, WebCrypto); если не передан — считаем здесь
   из ip+ua, как в /r/[code].
   ================================================================ */

const HEX64 = /^[a-f0-9]{64}$/;

export async function POST(req: NextRequest) {
  if (!FEATURES.clickWorker) {
    return NextResponse.json({ error: "Disabled" }, { status: 501 });
  }
  const workerKey = process.env.CLICK_WORKER_SECRET || "";
  const provided = req.headers.get("x-nr-worker-key") || "";
  if (!workerKey || provided !== workerKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Worker шлёт один запрос на клик: лимит с запасом на всплески
  const rl = rateLimit(`track:click:${ip}`, 600, 60_000);
  if (!rl.ok) {
    return new NextResponse(null, { status: 429 });
  }

  let body: { code?: unknown; visitorHash?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(code)) {
    return new NextResponse(null, { status: 204 });
  }
  if (!getPostByCode(code)) {
    return new NextResponse(null, { status: 204 }); // неизвестный код — молча
  }

  // visitorHash: пришёл от Worker (уже с секретом) — берём как есть;
  // иначе считаем из ip+ua+секрета по канону /r/[code]
  let visitorHash =
    typeof body.visitorHash === "string" && HEX64.test(body.visitorHash)
      ? body.visitorHash
      : "";
  if (!visitorHash) {
    const ua = req.headers.get("user-agent") || "unknown";
    const secret = process.env.ADMIN_SECRET || "no-reality-secret";
    visitorHash = createHash("sha256")
      .update(`${ip}::${ua}::${secret}`)
      .digest("hex");
  }

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
    // БД недоступна — клик теряется так же, как в деградации /r/[code]
  }

  return new NextResponse(null, { status: 204 });
}
