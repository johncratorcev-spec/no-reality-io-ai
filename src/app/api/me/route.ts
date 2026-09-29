import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAccount, accountView } from "@/lib/account";
import { authedAccountId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — v10: ОТКРЫТЫЙ САЙТ, БЕТТИНГ ЗА АВТОРИЗАЦИЕЙ.
 *
 * { authed: true,  account: AccountView } — валидная подписанная сессия
 *   (nr_uid + nr_auth-HMAC). Аккаунт лениво додаётся, если вдруг отсутствует.
 * { authed: false, account: null }        — гость: НИКАКИХ аккаунтов и cookie
 *   не создаётся (раньше каждый визит плодил гостя с welcome-бонусом —
 *   при открытых страницах это раздувало БД и экономику).
 * { authed: false, account: AccountView } — легаси-гость (аккаунт до-v10
 *   существует, подписи нет): баланс виден, но ставки/награды закрыты —
 *   регистрация с промо подхватит этот nr_uid и сохранит баланс.
 */
export async function GET(req: NextRequest) {
  const uid = req.cookies.get("nr_uid")?.value;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) {
    return NextResponse.json({ authed: false, account: null });
  }
  try {
    const existing = await db.account.findUnique({ where: { id: uid } });
    if (!existing) {
      return NextResponse.json({ authed: false, account: null });
    }
    if (!authedAccountId(req)) {
      return NextResponse.json({ authed: false, account: accountView(existing) });
    }
    const fresh = await ensureAccount(uid);
    return NextResponse.json({ authed: true, account: accountView(fresh) });
  } catch (e) {
    console.error("[me] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { authed: false, account: null, error: "account_failed" },
      { status: 500 }
    );
  }
}
