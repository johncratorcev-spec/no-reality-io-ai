import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { placeCryoBet } from "@/lib/cryo/core";
import { CRYO } from "@/lib/cryo/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/cryo/bet — fix a position of ANY USDC amount (task 43; direct
 * transfer to the treasury via Phantom, demo mode without on-chain).
 * Body: { postCode, side: "yes"|"no", wallet, amount: "0.10".."500.00",
 *         mode: "demo"|"phantom", txSig?, betRef? }
 *
 * 200 → { market } (fresh view with the wallet position)
 * 400 → bad amount / phantom transaction failed USDC verification
 * 409 → market frozen/closed or position already fixed
 * 503 → DB unavailable (client degrades to a localStorage position)
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
    amount?: string;
    mode?: string;
    txSig?: string;
    betRef?: string;
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
    amount: body.amount ?? CRYO.betAmountUsdc,
    mode: body.mode === "phantom" ? "phantom" : "demo",
    txSig: body.txSig || null,
    betRef: body.betRef || null,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status }
    );
  }
  return NextResponse.json({ market: res.view });
}
