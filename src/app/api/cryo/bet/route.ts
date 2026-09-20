import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { placeCryoBet } from "@/lib/cryo/core";

export const dynamic = "force-dynamic";

/**
 * POST /api/cryo/bet — фиксация позиции $1 USDC (Block 5 спеки).
 * Body: { postCode, side: "yes"|"no", wallet, mode: "demo"|"phantom", txSig? }
 *
 * 200 → { market } (свежий view с позицией кошелька)
 * 409 → рынок заморожен/закрыт или позиция уже зафиксирована
 * 503 → БД недоступна (клиент деградирует в localStorage-позицию)
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:bet:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    postCode?: string;
    side?: string;
    wallet?: string;
    mode?: string;
    txSig?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body.postCode || !body.side || !body.wallet) {
    return NextResponse.json(
      { error: "postCode, side, wallet required" },
      { status: 400 }
    );
  }

  const res = await placeCryoBet({
    postCode: body.postCode,
    side: body.side === "yes" ? "yes" : "no",
    wallet: body.wallet,
    mode: body.mode === "phantom" ? "phantom" : "demo",
    txSig: body.txSig || null,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status }
    );
  }
  return NextResponse.json({ market: res.view });
}
