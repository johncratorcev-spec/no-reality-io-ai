import { NextRequest } from "next/server";
import {
  accountResponse,
  ensureAccount,
  accountView,
  readAccount,
} from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — мгновенный аккаунт с нулевым порогом входа.
 *
 * Cookie nr_uid ставится прямо этим ответом (если аккаунта ещё нет —
 * создаётся лениво вместе с welcome-бонусом). Ни email, ни кошелёк, ни
 * формы: регистрация случается сама на первом действии.
 *
 * Ответ: { account: { accountId, balanceCents, passTier, isPass, wallet,
 * streakDays, dailyAvailable } }
 */
export async function GET(req: NextRequest) {
  const account = readAccount(req);
  try {
    const fresh = await ensureAccount(account.id);
    return accountResponse(account, {
      account: accountView(fresh),
    });
  } catch (e) {
    console.error("[me] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "account_failed" }, 500);
  }
}
