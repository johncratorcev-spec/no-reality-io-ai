import { NextRequest, NextResponse } from "next/server";
import {
  claimDailyBonus,
  ensureAccount,
  accountView,
  EconError,
} from "@/lib/account";
import { authedAccountId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/daily — daily-бонус NR PASS (раз в UTC-день).
 * v10: только с подписанной сессией (401 auth_required у гостя);
 * без пасса — 403 pass_required.
 */
export async function POST(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    await ensureAccount(accountId);
    const res = await claimDailyBonus(accountId);
    const fresh = await ensureAccount(accountId);
    return NextResponse.json({
      ...res,
      account: accountView(fresh),
    });
  } catch (e) {
    if (e instanceof EconError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error("[me/daily] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "daily_failed" }, { status: 500 });
  }
}
