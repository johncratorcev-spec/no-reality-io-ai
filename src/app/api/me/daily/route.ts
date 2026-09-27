import { NextRequest } from "next/server";
import {
  accountResponse,
  claimDailyBonus,
  ensureAccount,
  accountView,
  readAccount,
  EconError,
} from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/daily — daily-бонус NR PASS (раз в UTC-день).
 * Гостям недоступен (403 pass_required) — это часть мотивации привязать
 * кошелёк: пасс открывает ежедневные начисления и стрик.
 */
export async function POST(req: NextRequest) {
  const account = readAccount(req);
  try {
    await ensureAccount(account.id);
    const res = await claimDailyBonus(account.id);
    const fresh = await ensureAccount(account.id);
    return accountResponse(account, {
      ...res,
      account: accountView(fresh),
    });
  } catch (e) {
    if (e instanceof EconError) {
      return accountResponse(account, { error: e.code, message: e.message }, e.status);
    }
    console.error("[me/daily] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "daily_failed" }, 500);
  }
}
