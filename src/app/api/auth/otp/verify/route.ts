import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { otpVerify, SupabaseAuthError, SB_OTP_COOKIE } from "@/lib/auth/supabase";
import { signInWithEmailIdentity, reqIp } from "@/lib/auth/identity";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/verify { email, token } — обмен 6-значного кода
 * Supabase на сессию сайта (nr_uid + подписанный nr_auth). Связка/регистрация
 * — общая дверь signInWithEmailIdentity. Успех → { ok, next }.
 */
export async function POST(req: NextRequest) {
  const ip = reqIp(req);
  const rl = rateLimit(`auth:otp_verify:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let email = "";
  let token = "";
  try {
    const body = (await req.json()) as { email?: unknown; token?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!email || !/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: "bad_input" }, { status: 400 });
  }

  /* код отправлялся именно на этот email (cookie ставит /send) */
  const sentHash = req.cookies.get(SB_OTP_COOKIE)?.value || "";
  const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 32);
  if (sentHash && sentHash !== emailHash) {
    return NextResponse.json({ error: "email_mismatch" }, { status: 400 });
  }

  try {
    const profile = await otpVerify(email, token);
    const outcome = await signInWithEmailIdentity(profile, req);
    const res = NextResponse.json({ ok: true, newAccount: outcome.newAccount });
    setSessionCookies(res, outcome.accountId);
    res.cookies.set(SB_OTP_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    if (e instanceof SupabaseAuthError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status }
      );
    }
    console.error("[auth/otp/verify] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}
