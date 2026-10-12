import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { otpSend, SupabaseAuthError, verifyTurnstile } from "@/lib/auth/supabase";
import { authIpHash, reqIp } from "@/lib/auth/identity";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/otp/send { email, turnstileToken? } — магический код
 * на email через Supabase Auth (free tier). Грейсфоллбэк: Supabase не
 * настроен/упал → 503 auth_unavailable, форма честно говорит об этом.
 * Turnstile (если настроен) — fail-closed.
 */
export async function POST(req: NextRequest) {
  const ip = reqIp(req);
  const rl = rateLimit(`auth:otp_send:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let email = "";
  let turnstileToken: unknown = null;
  try {
    const body = (await req.json()) as { email?: unknown; turnstileToken?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    turnstileToken = body.turnstileToken;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  /* бюджет попыток на ipHash — anti-spam письма (ТЗ §5 защита) */
  const rlKey = rateLimit(`auth:otp_key:${authIpHash(ip)}`, 10, 3600_000);
  if (!rlKey.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  try {
    await otpSend(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SupabaseAuthError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status }
      );
    }
    console.error("[auth/otp/send] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}
