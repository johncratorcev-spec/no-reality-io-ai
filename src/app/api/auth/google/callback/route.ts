import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  GOOGLE_STATE_COOKIE,
  authenticateGoogleCallback,
  googleConfigured,
  signInWithGoogle,
  stateMatches,
} from "@/lib/auth/google";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google/callback — шаг 2 OAuth (v16, passport-google-oauth20):
 * сверка state → passport обменивает code и тянет профиль → ОТКРЫТЫЙ вход:
 *
 *   - google-email уже с аккаунтом → вход (nr_uid + nr_auth) → ?next;
 *   - новый google-email → аккаунт сразу (регистрация без кодов);
 *   - живой гость (nr_uid без email) продолжает свой аккаунт.
 *
 * Ошибки OAuth — редирект на /auth?auth=… (экран входа).
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin; // работает и без PUBLIC_BASE_URL (preview/sandbox)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:google_cb:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.redirect(`${origin}/auth?auth=rate_limited`, 303);
  }

  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/auth?auth=google_not_configured`, 303);
  }

  const urlState = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value || null;

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/auth?auth=${encodeURIComponent(reason)}`, 303);

  if (!code || !stateMatches(cookieState, urlState)) return fail("google_state");

  const result = await authenticateGoogleCallback(req);
  if (result.error) return fail("google_failed");
  if (result.failure) return fail(result.failure === "access_denied" ? "google_denied" : "google_profile");
  const profile = result.profile;
  if (!profile || !profile.emailVerified) return fail("google_profile");

  try {
    const outcome = await signInWithGoogle(profile, req);
    const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
    const res = NextResponse.redirect(`${origin}${next}`, 303);
    /* v10: nr_uid + ПОДПИСАННЫЙ nr_auth (HMAC-привязка к uid) */
    setSessionCookies(res, outcome.accountId);
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
