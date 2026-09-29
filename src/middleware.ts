import { NextRequest, NextResponse } from "next/server";

/**
 * v9 — закрытый запуск: все страницы сайта только для авторизованных.
 *
 * Маркер членства — httpOnly-cookie nr_auth («1»), её выдают ВСЕ входы
 * (пароль + промокод, google, magic) и сбрасывает /api/auth/signout.
 * Гость (мгновенный nr_uid) маркера не имеет → перекидывается на /auth.
 *
 * Исключения из гейта:
 *  - /auth           — сам экран входа (иначе вечный редирект);
 *  - /api/*          — API живёт по своим сессиям (selftest'ы, вебхуки,
 *                      инвойсы 2328; гейт — продуктовая дверь, а не
 *                      замена сессионной проверки в роутах);
 *  - /r/*            — UTM-редиректы: клик должен дойти до счётчика,
 *                      дальше его встретит гейт целевой страницы;
 *  - /admin*         — админка защищена собственной схемой ADMIN_SECRET;
 *  - служебные пути с точкой (favicon, robots, sitemap, картинки) и
 *    верификационный каталог домена.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const authed = req.cookies.get("nr_auth")?.value === "1";
  if (authed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.search = "";
  /* next ставим всегда (включая "/"): после входа вернём туда, куда шёл */
  url.searchParams.set("next", `${pathname}${search}` || "/");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api|_next|_next/static|_next/image|r/|admin|auth|f0ff36544bd3574e9aac5ea4997e0d56b1526c80|.*\\..*).*)",
  ],
};
