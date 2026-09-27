import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  GOOGLE_STATE_COOKIE,
  exchangeCode,
  googleConfigured,
  signInWithGoogle,
  stateMatches,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

const YEAR = 60 * 60 * 24 * 365;

/**
 * GET /api/auth/google/callback — шаг 2 OAuth:
 * сверка state → обмен code → вход/регистрация по email →
 * httpOnly-cookie nr_uid (сессия аккаунта) → редирект на ?next.
 * В случае ошибки — редирект на /bet?auth=google_failed.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin; // работает и без PUBLIC_BASE_URL (preview/sandbox)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:google_cb:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.redirect(`${origin}/bet?auth=rate_limited`, 303);
  }

  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/bet?auth=google_not_configured`, 303);
  }

  const urlState = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value || null;

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/bet?auth=${encodeURIComponent(reason)}`, 303);

  if (!code || !stateMatches(cookieState, urlState)) return fail("google_state");

  const profile = await exchangeCode(code);
  if (!profile || !profile.emailVerified) return fail("google_profile");

  try {
    const { accountId } = await signInWithGoogle(profile, req);
    const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
    const res = NextResponse.redirect(`${origin}${next}`, 303);
    res.cookies.set("nr_uid", accountId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch {
    return fail("google_failed");
  }
}

/** открытый редирект запрещён: только внутренние пути */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/bet";
}
