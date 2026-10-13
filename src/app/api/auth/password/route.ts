import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import {
  passwordSignIn,
  passwordSignUp,
  otpSend,
  SupabaseAuthError,
  verifyTurnstile,
  SB_OTP_COOKIE,
} from "@/lib/auth/supabase";
import { signInWithEmailIdentity, reqIp } from "@/lib/auth/identity";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/password { email, password, turnstileToken? } — v21,
 * ОСНОВНАЯ дверь входа (Supabase Auth):
 *
 *   1. Существующий аккаунт → password grant → сессия.
 *   2. Нет аккаунта → /auth/v1/signup → аккаунт создан, +100 EYE welcome
 *      начисляется в signInWithEmailIdentity (ensureAccount) сразу.
 *   3. В проекте включено подтверждение email (сессия не вернулась) →
 *      шлём 6-значный код (otpSend) → { ok:true, mode:"code" } — форма
 *      переключается на ввод кода (тот же verify, что у magic-входа).
 *
 * Грейсфоллбэк: Supabase не настроен/упал → 503 auth_unavailable,
 * НИКОГДА не 500-падение. Turnstile (если настроен) — fail-closed.
 * user_already_exists снаружи неотличим от неверного пароля (anti-enum).
 */
export async function POST(req: NextRequest) {
  const ip = reqIp(req);
  const rl = rateLimit(`auth:pw:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let email = "";
  let password = "";
  let turnstileToken: unknown = null;
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      turnstileToken?: unknown;
    };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
    turnstileToken = body.turnstileToken;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return NextResponse.json({ error: "captcha_failed" }, { status: 400 });
  }

  try {
    /* --- 1. вход существующего --- */
    try {
      const profile = await passwordSignIn(email, password);
      const outcome = await signInWithEmailIdentity(profile, req);
      const res = NextResponse.json({ ok: true, newAccount: outcome.newAccount });
      setSessionCookies(res, outcome.accountId);
      return res;
    } catch (e) {
      /* invalid_credentials → возможно, аккаунта ещё нет — пробуем signup;
         прочие ошибки — наверх */
      if (!(e instanceof SupabaseAuthError) || e.code !== "invalid_credentials") {
        throw e;
      }
    }

    /* --- 2. регистрация нового --- */
    const profile = await passwordSignUp(email, password);
    if (profile) {
      const outcome = await signInWithEmailIdentity(profile, req);
      const res = NextResponse.json({ ok: true, newAccount: outcome.newAccount });
      setSessionCookies(res, outcome.accountId);
      return res;
    }

    /* --- 3. подтверждение email включено: сессии нет — код на почту --- */
    await otpSend(email);
    const res = NextResponse.json({ ok: true, mode: "code" });
    res.cookies.set(
      SB_OTP_COOKIE,
      createHash("sha256").update(email).digest("hex").slice(0, 32),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1800,
        path: "/",
      }
    );
    return res;
  } catch (e) {
    if (e instanceof SupabaseAuthError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[auth/password] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}
