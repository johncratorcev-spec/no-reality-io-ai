import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getCryoPnl } from "@/lib/cryo/core";

export const dynamic = "force-dynamic";

/**
 * GET /api/cryo/pnl[?wallet=…] — PnL кошелька (task 42, пункт 8).
 *
 * Кошелёк определяется так: ?wallet= (гостевой demo-адрес) или
 * httpOnly cookie nr_phantom (авторизация Phantom). Ответ — агрегаты
 * (staked/claimable/claimed/net) + все позиции с исходами рынков.
 * БД недоступна → 503 { db: false }.
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:pnl:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const qWallet = req.nextUrl.searchParams.get("wallet")?.trim() || "";
  const cookieWallet = req.cookies.get("nr_phantom")?.value?.trim() || "";
  const wallet = qWallet || cookieWallet;

  if (!wallet) {
    return NextResponse.json(
      { wallet: null, error: "No wallet — connect Phantom" },
      { status: 200 }
    );
  }

  try {
    const pnl = await getCryoPnl(wallet);
    if (!pnl) {
      return NextResponse.json({ db: false }, { status: 503 });
    }
    return NextResponse.json(pnl, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ db: false }, { status: 503 });
  }
}
