import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBettor } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/attach-bets — доатрибуция анонимных ставок кошельку (v5).
 *
 * Вызывается клиентом сразу после успешного connect: ставки, сделанные с
 * этим bettorId (cookie nr_bet) ДО подключения кошелька, получают wallet —
 * иначе Best Eyes Leaderboard их не увидит.
 *
 * Безопасность: нужно ИМЕТЬ обе сессии (nr_bet + nr_wallet/nr_phantom);
 * чужие ставки не затрагиваются — bettorId совпадает только у себя.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`attach:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const bettor = readBettor(req);
  const wallet =
    req.cookies.get("nr_wallet")?.value?.toLowerCase() ||
    req.cookies.get("nr_phantom")?.value?.toLowerCase() ||
    null;

  if (!wallet || !(/^0x[0-9a-f]{40}$/.test(wallet) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet))) {
    return NextResponse.json({ error: "no wallet session" }, { status: 400 });
  }

  try {
    const moved = await db.bet.updateMany({
      where: { bettorId: bettor.id, wallet: null, status: { in: ["pending", "active", "won", "lost"] } },
      data: { wallet },
    });
    return NextResponse.json({ ok: true, attached: moved.count });
  } catch {
    return NextResponse.json({ ok: false, attached: 0 }, { status: 503 });
  }
}
