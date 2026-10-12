import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  googleExchangeCode,
  SB_VERIFIER_COOKIE,
  SB_NEXT_COOKIE,
} from "@/lib/auth/supabase";
import { signInWithEmailIdentity } from "@/lib/auth/identity";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/supabase/google/callback — шаг 2 Google-входа через
 * Supabase Auth: ?code → PKCE-обмен (code_verifier из cookie) → профиль →
 * связка/регистрация → наш подписанный cookie → next.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/auth?auth=${encodeURIComponent(reason)}`, 303);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:sb_g_cb:${ip}`, 20, 60_000);
  if (!rl.ok) return fail("rate_limited");

  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  const verifier = req.cookies.get(SB_VERIFIER_COOKIE)?.value || "";
  const nextRaw = req.cookies.get(SB_NEXT_COOKIE)?.value || "";

  if (err === "access_denied") return fail("auth_denied");
  if (!code || !verifier) return fail("auth_state");

  try {
    const profile = await googleExchangeCode(code, verifier);
    const outcome = await signInWithEmailIdentity(profile, req);
    const res = NextResponse.redirect(`${origin}${sanitizeNext(nextRaw)}`, 303);
    setSessionCookies(res, outcome.accountId);
    res.cookies.set(SB_VERIFIER_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    res.cookies.set(SB_NEXT_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    console.error("[auth/supabase/google/callback] failed:", e instanceof Error ? e.message : e);
    return fail("auth_failed");
  }
}

/** открытый редирект запрещён: только внутренние пути */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/bet";
}
