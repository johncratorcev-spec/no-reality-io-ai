import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signout — выход из сессии (v7.1).
 *
 * Крипто-кошелёк больше не существует как метод входа: сессия — это
 * httpOnly nr_uid (мгновенный аккаунт или google/magic-вход). «Выход»
 * сбрасывает cookie аккаунта и magic-email: гость получает свежий
 * аккаунт, google-пользователь при следующем входе вернётся в свой
 * аккаунт по email (баланс и пасс сохраняются на сервере).
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const clear = { httpOnly: true as const, maxAge: 0, path: "/" };
  res.cookies.set("nr_uid", "", clear);
  res.cookies.set("nr_email", "", clear);
  /* v9: маркер членства — обязателен к сбросу, иначе middleware
     продолжит пускать на закрытые страницы после «выхода» */
  res.cookies.set("nr_auth", "", clear);
  res.cookies.set("nr_promo_pending", "", clear);
  return res;
}
