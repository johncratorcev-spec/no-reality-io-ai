import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signout — выход из сессии (v16).
 *
 * Сессия — это httpOnly nr_uid + подписанный nr_auth (единственный
 * метод входа — email+пароль, чистая БД, v22). «Выход»
 * сбрасывает cookie аккаунта: гость получает свежий мгновенный
 * аккаунт, владелец email при следующем входе вернётся в свой
 * аккаунт по email+паролю (баланс и пасс сохраняются на сервере).
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  const clear = { httpOnly: true as const, maxAge: 0, path: "/" };
  res.cookies.set("nr_uid", "", clear);
  /* v9: маркер членства — обязателен к сбросу, иначе middleware
     продолжит пускать на закрытые страницы после «выхода» */
  res.cookies.set("nr_auth", "", clear);
  return res;
}
