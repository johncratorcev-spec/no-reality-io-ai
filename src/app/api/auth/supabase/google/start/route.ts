import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  googleAuthorizeUrl,
  supabaseConfigured,
  SB_VERIFIER_COOKIE,
  SB_NEXT_COOKIE,
} from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/supabase/google/start?next=/… — шаг 1 Google-входа через
 * Supabase Auth (PKCE): code_verifier в httpOnly-cookie, редирект на
 * authorize. Не настроено → редирект на /auth?auth=auth_unavailable.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/auth?auth=${encodeURIComponent(reason)}`, 303);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:sb_g_start:${ip}`, 20, 60_000);
  if (!rl.ok) return fail("rate_limited");

  if (!supabaseConfigured()) return fail("auth_unavailable");

  const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
  const redirectTo = `${origin}/api/auth/supabase/google/callback${
    next !== "/bet" ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  try {
    const { url, verifier } = googleAuthorizeUrl(redirectTo);
    const res = NextResponse.redirect(url, 303);
    const base = {
      httpOnly: true as const,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600, // 10 минут на consent
      path: "/",
    };
    res.cookies.set(SB_VERIFIER_COOKIE, verifier, base);
    res.cookies.set(SB_NEXT_COOKIE, next, base);
    return res;
  } catch (e) {
    console.error("[auth/supabase/google/start] failed:", e instanceof Error ? e.message : e);
    return fail("auth_unavailable");
  }
}

/** открытый редирект запрещён: только внутренние пути */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/bet";
}
