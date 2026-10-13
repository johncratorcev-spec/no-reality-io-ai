import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, accessKeyOk, accessKeyRequired } from "@/lib/auth/password";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { signInWithEmailIdentity, reqIp } from "@/lib/auth/identity";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/password { email, password, key?, turnstileToken? } — v22,
 * ЕДИНСТВЕННАЯ дверь входа: ЧИСТАЯ ЛОГИКА БД, без внешнего IdP.
 *
 *   1. Email найден в EmailAuth → scrypt-проверка пароля → сессия
 *      (cookie nr_uid + подписанный nr_auth, lib/auth/session).
 *   2. Emailа нет → РЕГИСТРАЦИЯ: профиль создаёт signInWithEmailIdentity
 *      (welcome +100 EYE, усыновление гостя, ?ref-рефералка, Early Bird),
 *      поверх — строка EmailAuth с scrypt-хешем. Пока задан NR_ACCESS_KEY,
 *      регистрация требует КЛЮЧ (вход существующих — без ключа).
 *
 * Анти-enum: неверный пароль и «нет такого email» внешне неотличимы
 * (invalid_credentials). Грейсфолбэк: БД недоступна → 503
 * auth_unavailable, НИКОГДА не 500-падение. Turnstile (если настроен) —
 * fail-closed.
 */
export async function POST(req: NextRequest) {
  const ip = reqIp(req);
  const rl = rateLimit(`auth:pw:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let email = "";
  let password = "";
  let key: unknown = null;
  let turnstileToken: unknown = null;
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      key?: unknown;
      turnstileToken?: unknown;
    };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
    key = body.key;
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
    /* --- 1. вход существующего (EmailAuth — парольная таблица БД) --- */
    const auth = await db.emailAuth.findUnique({
      where: { email },
      include: { account: { select: { id: true } } },
    });
    if (auth) {
      if (!(await verifyPassword(password, auth.passwordHash))) {
        return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      }
      const outcome = await signInWithEmailIdentity(
        { email, emailVerified: true },
        req
      );
      const res = NextResponse.json({ ok: true, newAccount: outcome.newAccount });
      setSessionCookies(res, outcome.accountId);
      return res;
    }

    /* --- 2. регистрация нового: ключ доступа (пока включён) --- */
    if (accessKeyRequired() && !accessKeyOk(key)) {
      return NextResponse.json({ error: "bad_key" }, { status: 403 });
    }

    const outcome = await signInWithEmailIdentity({ email, emailVerified: true }, req);
    try {
      await db.emailAuth.create({
        data: {
          accountId: outcome.accountId,
          email,
          passwordHash: await hashPassword(password),
        },
      });
    } catch (e) {
      /* гонка двух регистраций одного email (unique) — снаружи
         неотличимо от неверного пароля (анти-enum) */
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      }
      throw e;
    }

    const res = NextResponse.json({ ok: true, newAccount: outcome.newAccount });
    setSessionCookies(res, outcome.accountId);
    return res;
  } catch (e) {
    console.error("[auth/password] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_unavailable" }, { status: 503 });
  }
}
