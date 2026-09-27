import { NextRequest } from "next/server";
import {
  accountResponse,
  ensureAccount,
  accountView,
  linkWallet,
  readAccount,
  EconError,
} from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/link-wallet — привязка кошелька к мгновенному аккаунту.
 * Вызывается из use-wallet сразу после установки cookie сессии кошелька.
 *
 * Открывает NR PASS (пасс авторизованного): daily-бонус, повышенные капсы,
 * Best Eyes Leaderboard, будущая конвертация баланса в токен.
 * Если кошелёк уже привязан к другому аккаунту — сервер вернёт id того
 * аккаунта в поле adopt_account_id (cookie перезапишется), балансы не
 * теряются.
 */
export async function POST(req: NextRequest) {
  const account = readAccount(req);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return accountResponse(account, { error: "invalid json" }, 400);
  }

  /* кошелёк: из тела, иначе из cookie-сессии (use-wallet шлёт пустое тело
     сразу после connect — cookie nr_wallet/nr_phantom уже стоит) */
  const walletCookie =
    req.cookies.get("nr_wallet")?.value?.toLowerCase() ||
    req.cookies.get("nr_phantom")?.value?.toLowerCase() ||
    null;
  const wallet =
    typeof body.wallet === "string" && body.wallet.length >= 20
      ? body.wallet
      : typeof body.address === "string" && body.address.length >= 20
        ? body.address
        : walletCookie;
  if (!wallet) {
    return accountResponse(account, { error: "bad_wallet" }, 400);
  }

  try {
    const { account: linked } = await linkWallet(account.id, wallet);
    if (linked.id !== account.id) {
      /* adopts: возвращаем настоящий аккаунт + команду перезаписать cookie */
      const res = accountResponse(
        { id: linked.id, isNew: true },
        { adopted: true, account: accountView(await ensureAccount(linked.id)) }
      );
      return res;
    }
    const fresh = await ensureAccount(account.id);
    return accountResponse(account, {
      adopted: false,
      passGranted: linked.passGranted,
      account: accountView(fresh),
    });
  } catch (e) {
    if (e instanceof EconError) {
      return accountResponse(account, { error: e.code, message: e.message }, e.status);
    }
    console.error("[me/link-wallet] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "link_failed" }, 500);
  }
}
