import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { ensureAccount, accountView } from "@/lib/account";
import {
  PasswordAuthError,
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN,
  normalizeEmail,
  signInOrRegister,
  validatePassword,
} from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const YEAR = 60 * 60 * 24 * 365;

/**
 * POST /api/auth/password — v8, вход/регистрация через СВОЮ форму
 * на Supabase Postgres, БЕЗ подтверждения учётной записи:
 *
 *   { email, password }
 *
 *  - email уже есть в EmailAuth → сверяем пароль → вход (200);
 *  - почта уникальна → создаётся профиль, привязывается к гостевому
 *    nr_uid (или новый Account с welcome-бонусом) → 200, isNew=true;
 *  - пароль не подошёл → 401 wrong_password (перебор режет rate-limit).
 *
 * Сессия — httpOnly-cookie nr_uid (тот же идентификатор, что у
 * google/magic-входа): баланс, пасс и история сохраняются.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:password:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = (await req.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }
  const password = validatePassword(body.password);
  if (!password) {
    return NextResponse.json(
      {
        error: "bad_password",
        message: `password must be ${PASSWORD_MIN_LEN}..${PASSWORD_MAX_LEN} characters`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await signInOrRegister(email, password, req);
    const fresh = await ensureAccount(result.accountId);
    const res = NextResponse.json({
      ok: true,
      isNew: result.isNew,
      linked: result.linked,
      account: accountView(fresh),
    });
    res.cookies.set("nr_uid", result.accountId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
    return res;
  } catch (e) {
    if (e instanceof PasswordAuthError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status }
      );
    }
    console.error("[auth/password] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
