import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { claimCryoBet } from "@/lib/cryo/core";

export const dynamic = "force-dynamic";

/**
 * POST /api/cryo/claim — «ЭКСТРАКЦИЯ НАГРАДЫ» (Block 9 спеки).
 * Body: { postCode, wallet } → { payout: "1.29" }
 * Победитель забирает долю пари-мьютюэль пула; повторная экстракция — 409.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:claim:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { postCode?: string; wallet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body.postCode || !body.wallet) {
    return NextResponse.json(
      { error: "postCode, wallet required" },
      { status: 400 }
    );
  }

  const res = await claimCryoBet(body.postCode, body.wallet);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ payout: res.payout });
}
