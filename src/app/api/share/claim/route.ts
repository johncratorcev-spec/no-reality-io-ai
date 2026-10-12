import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount, EconError } from "@/lib/account";
import { claimShare, shareStatusToday, type ShareKind } from "@/lib/hook";

export const dynamic = "force-dynamic";

/**
 * POST /api/share/claim { kind: "win" | "streak" } — EYE за шеринг
 * вердикта (ТЗ §4): один вид — раз в UTC-день. CTA «поделись и получи
 * ещё EYE» живёт в результат-карточке и на стриках.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`share-claim:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let kind: ShareKind = "win";
  try {
    const body = (await req.json()) as { kind?: unknown };
    if (body.kind === "streak" || body.kind === "invite") kind = body.kind;
  } catch {
    /* дефолт win */
  }

  try {
    await ensureAccount(accountId);
    const res = await claimShare(accountId, kind);
    const status = await shareStatusToday(accountId);
    return NextResponse.json({ ...res, claimedToday: status });
  } catch (e) {
    if (e instanceof EconError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[share/claim] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "share_claim_failed" }, { status: 500 });
  }
}

/** GET — сегодняшнее состояние кнопок шеринга (для UI) */
export async function GET(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ authed: false, win: false, streak: false });
  }
  const status = await shareStatusToday(accountId).catch(() => ({ win: false, streak: false }));
  return NextResponse.json({ authed: true, ...status });
}
