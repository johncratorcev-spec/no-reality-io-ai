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
import {
  ipHashOf,
  normalizePromoCode,
  promoBudgetOk,
  recordAttempt,
  claimPromo,
  approveWaitlist,
  newAccountId,
} from "@/lib/promo";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { trackEvent } from "@/lib/bet/events";

export const dynamic = "force-dynamic";

const YEAR = 60 * 60 * 24 * 365;

function sessionCookies(
  res: NextResponse,
  accountId: string
): NextResponse {
  res.cookies.set("nr_uid", accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
  /* v9: маркер «полноправного члена» для middleware-гейта (гость его
     не имеет → неавторизованных перекидывает на /auth) */
  res.cookies.set("nr_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
  return res;
}

/**
 * POST /api/auth/password — v9, вход/регистрация через СВОЮ форму
 * на Supabase Postgres, БЕЗ подтверждения учётной записи + ЗАКРЫТЫЙ ЗАПУСК:
 *
 *   { email, password, promo? }
 *
 *  - email уже есть в EmailAuth → сверяем пароль → вход (200, status login);
 *  - почта уникальна + валидный неиспользованный промокод → аккаунт
 *    создан, код погашен атомарно (200, status registered);
 *  - без промо / код не существует / код уже погашен → ЛИСТ ОЖИДАНИЯ
 *    (200, status waitlisted) — сессия НЕ выдаётся;
 *  - неверный пароль → 401 wrong_password.
 *
 * АНТИ-БРУТФОРС (двух уровней):
 *  1) in-memory rateLimit 30/мин/IP — дешёвый отсев флуда;
 *  2) БД-бюджеты (кросс-инстанс): 10 неверных паролей/час и 8 промахов
 *     промокода/час (20/сутки) на sha256(ip+соль) → 429 Retry-After.
 * Код: алфавит 31 символ без 0/O/1/I/L, 12 знаков → 31^12 ≈ 7.9e17.
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

  let body: { email?: unknown; password?: unknown; promo?: unknown } = {};
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

  /* промокод: нормализация ДО БД (мусор не долбит базу и не тратит
     бюджет: не-геометрия отсекается бесплатно) */
  const hasPromoInput = body.promo !== undefined && body.promo !== null && body.promo !== "";
  const promoFlat = hasPromoInput ? normalizePromoCode(body.promo) : null;

  try {
    const existing = await db.emailAuth.findUnique({ where: { email } });

    /* ---------- ВХОД: email уже с паролем ---------- */
    if (existing) {
      const budget = await promoBudgetOk(ipHash, "password");
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "too_many_requests" },
          { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } }
        );
      }
      const result = await signInOrRegister(email, password, req);
      void recordAttempt(ipHash, "password", true, email);
      const fresh = await ensureAccount(result.accountId);
      return sessionCookies(
        NextResponse.json({
          ok: true,
          isNew: result.isNew,
          linked: result.linked,
          status: "login" as const,
          account: accountView(fresh),
        }),
        result.accountId
      );
    }

    /* ---------- РЕГИСТРАЦИЯ: почта уникальна ---------- */

    /* БЕЗ промо → лист ожидания (анти-спам: upsert по email) */
    if (!hasPromoInput) {
      const passwordHash = await hashPassword(password);
      await db.waitlistEntry.upsert({
        where: { email },
        create: { email, passwordHash, source: "form" },
        update: { passwordHash, source: "form", approvedAt: null, convertedAccountId: null },
      });
      void trackEvent("waitlist_signup", { meta: { reason: "no_code" } });
      return NextResponse.json({
        ok: true,
        status: "waitlisted" as const,
        reason: "no_code" as const,
        message: "you are on the waiting list",
      });
    }

    /* промо введено, но геометрия не та → промах, лист ожидания */
    if (!promoFlat) {
      const budget = await promoBudgetOk(ipHash, "promo");
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "too_many_requests" },
          { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } }
        );
      }
      await recordAttempt(ipHash, "promo", false, String(body.promo).slice(0, 64));
      await waitlistOnly(email, password);
      return NextResponse.json({
        ok: true,
        status: "waitlisted" as const,
        reason: "invalid_code" as const,
        message: "promo code is not valid — you are on the waiting list",
      });
    }

    /* бюджет промахов промокода (кросс-инстанс, до БД-запросов кода) */
    const budget = await promoBudgetOk(ipHash, "promo");
    if (!budget.allowed) {
      return NextResponse.json(
        { error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(budget.retryAfterSec) } }
      );
    }

    /* аккаунт под будущего члена: ЖИВОЙ гость без email продолжает свой
       аккаунт (баланс/история сохраняются — linked), иначе новый
       (welcome-бонус по ensureAccount — ровно раз) */
    const guestId = req.cookies.get("nr_uid")?.value;
    let accountId = newAccountId();
    let linked = false;
    if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
      const guest = await db.account.findUnique({ where: { id: guestId } });
      if (guest && !guest.email) {
        accountId = guest.id;
        linked = true;
      }
    }
    await ensureAccount(accountId);

    /* атомарный выкуп кода: ровно один победитель на код */
    const claim = await claimPromo(promoFlat, accountId);
    if (claim.outcome !== "claimed") {
      await recordAttempt(ipHash, "promo", false, promoFlat);
      await waitlistOnly(email, password);
      return NextResponse.json({
        ok: true,
        status: "waitlisted" as const,
        reason: claim.outcome === "used" ? "promo_used" : "invalid_code",
        message:
          claim.outcome === "used"
            ? "promo code already used — you are on the waiting list"
            : "promo code is not valid — you are on the waiting list",
      });
    }

    /* код наш: аккаунт + пароль одной транзакцией (guard от гонки email) */
    try {
      const passwordHash = await hashPassword(password);
      await db.$transaction([
        db.account.updateMany({
          where: { id: accountId, email: null },
          data: { email, passTier: 1 },
        }),
        db.emailAuth.create({ data: { accountId, email, passwordHash } }),
      ]);
    } catch {
      /* email заняли параллельно (или google-аккаунт уже с такой почтой) —
         освобождаем код, чтобы его можно было использовать повторно */
      await db.promoCode.updateMany({
        where: { code: promoFlat, usedBy: accountId },
        data: { usedBy: null, usedAt: null },
      });
      return NextResponse.json(
        { error: "bad_email", message: "email already has an account — sign in" },
        { status: 409 }
      );
    }

    void recordAttempt(ipHash, "promo", true, promoFlat);
    /* await: детерминированность (selftest/клиент читают след сразу после ответа) */
    await approveWaitlist(email, accountId);
    void trackEvent("promo_redeemed", { meta: { code: promoFlat.slice(0, 5) } });
    const fresh = await ensureAccount(accountId);
    return sessionCookies(
      NextResponse.json({
        ok: true,
        isNew: true,
        linked,
        status: "registered" as const,
        account: accountView(fresh),
      }),
      accountId
    );
  } catch (e) {
    if (e instanceof PasswordAuthError) {
      /* неверный пароль → промах в БД-бюджет (кросс-инстанс) */
      if (e.code === "wrong_password") {
        void recordAttempt(ipHash, "password", false, email);
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

/** Лист ожидания без промо-истории (upsert по email, анти-спам). */
async function waitlistOnly(email: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.waitlistEntry.upsert({
    where: { email },
    create: { email, passwordHash, source: "form" },
    update: { passwordHash, source: "form", approvedAt: null, convertedAccountId: null },
  });
}
