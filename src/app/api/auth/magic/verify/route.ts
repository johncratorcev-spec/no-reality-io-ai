import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  consumeMagicToken,
  emailSession,
  linkMagicUser,
  magicLinkEnabled,
  EMAIL_COOKIE,
} from "@/lib/magic";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/auth/magic/verify?token=… — одноразовый вход по ссылке
   из письма (task 44, ТЗ §2).

   Токен → email → httpOnly cookie nr_email (30 дней). Если в этом же
   браузере живёт wallet-сессия — связываем email↔wallet (MagicUser).
   Дальше redirect на /pnl (профиль: reach, бонусы, бейджи).

   DELETE — выход из email-сессии (сброс cookie).
   ================================================================ */

const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

export async function GET(req: NextRequest) {
  if (!magicLinkEnabled()) {
    return NextResponse.redirect(
      new URL("/?magic=disabled", req.nextUrl.origin),
      302
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`magic:verify:${ip}`, 20, 3_600_000);
  if (!rl.ok) {
    return NextResponse.redirect(
      new URL("/?magic=throttled", req.nextUrl.origin),
      302
    );
  }

  const token = req.nextUrl.searchParams.get("token") || "";
  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect(
      new URL("/?magic=expired", req.nextUrl.origin),
      302
    );
  }

  // связка email↔wallet, если кошелёк уже подключён в этом браузере
  const wallet =
    req.cookies.get("nr_phantom")?.value ||
    req.cookies.get("nr_wallet")?.value?.toLowerCase();
  if (wallet) await linkMagicUser(email, wallet);

  const res = NextResponse.redirect(
    new URL("/pnl", req.nextUrl.origin),
    302
  );
  res.cookies.set(EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const had = Boolean(emailSession(req));
  const res = NextResponse.json({ ok: true, signedOut: had });
  res.cookies.set(EMAIL_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return res;
}
