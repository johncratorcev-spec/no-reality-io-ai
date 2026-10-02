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
import { ipHashOf, passwordBudgetOk, recordAttempt } from "@/lib/auth/ipbudget";
import { db } from "@/lib/db";
import { setSessionCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/password — v12, вход/регистрация БЕЗ СЕКРЕТНЫХ КОДОВ:
 *
 *   { email, password }
 *
 *  - email уже есть в EmailAuth → сверяем пароль → вход (status login);
 *  - почта уникальна → аккаунт создан сразу (status registered), живой
 *    гость (cookie nr_uid без email) продолжает свой аккаунт — баланс и
 *    история сохраняются, welcome-бонус выдаётся ровно один раз;
 *  - неверный пароль → 401 wrong_password;
 *  - никакого промо, никакого листа ожидания — сайт открыт (приказ:
 *    «убрать секретные коды вообще»).
 *
 * АНТИ-БРУТФОРС (два уровня):
 *  1) in-memory rateLimit 30/мин/IP — дешёвый отсев флуда;
 *  2) БД-бюджет: 10 неверных паролей/час на sha256(ip+соль) → 429
 *     Retry-After (кросс-инстанс, см. lib/auth/ipbudget).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:password:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: unknown; password?: unknown; ref?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
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

  const ipHash = ipHashOf(req);

  try {
    /* бюджет неверных паролей (кросс-инстанс) — только для уже
       существующих email: регистрация новых не брутится */
    const existing = await db.emailAuth.findUnique({ where: { email } });
    if (existing) {
      const budget = await passwordBudgetOk(ipHash);
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "too_many_requests" },
          { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } }
        );
      }
    }

    /* вход ИЛИ открытая регистрация — единая логика lib/auth/password
       (усыновление гостя, welcome ровно раз, passTier) */
    const result = await signInOrRegister(email, password, req);
    void recordAttempt(ipHash, true, email);
    /* v14: ref из тела ИЛИ из cookie nr_ref (ловец ?ref= на клиенте) */
    const refRaw = body.ref ?? req.cookies.get("nr_ref")?.value;
    const fresh = await ensureAccount(result.accountId, refRaw);
    return setSessionCookies(
      NextResponse.json({
        ok: true,
        isNew: result.isNew,
        linked: result.linked,
        status: result.isNew ? ("registered" as const) : ("login" as const),
        account: accountView(fresh),
      }),
      result.accountId
    );
  } catch (e) {
    if (e instanceof PasswordAuthError) {
      /* неверный пароль → промах в БД-бюджет (кросс-инстанс) */
      if (e.code === "wrong_password") {
        void recordAttempt(ipHash, false, email);
      }
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: e.status }
      );
    }
    console.error("[auth/password] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
