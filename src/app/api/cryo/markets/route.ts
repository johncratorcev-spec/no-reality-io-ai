import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getCryoMarketViews } from "@/lib/cryo/core";

export const dynamic = "force-dynamic";

/**
 * GET /api/cryo/markets[?wallet=0x…|sol…] — публичный список рынков Cryo-Stop
 * с пулами и пари-мьютюэль коэффициентами. wallet опционален: добавляет
 * позицию этого кошелька (myBet/myPayout/myClaimed) в каждый рынок.
 * БД недоступна → 200 с db:false (лента рендерится, ставки уходят в локал).
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:markets:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim() || null;
  try {
    const markets = await getCryoMarketViews(wallet);
    return NextResponse.json(
      { markets },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Markets unavailable" }, { status: 500 });
  }
}
