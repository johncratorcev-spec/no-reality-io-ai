import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  GOOGLE_STATE_COOKIE,
  exchangeCode,
  googleConfigured,
  signInWithGoogleGated,
  stateMatches,
} from "@/lib/auth/google";
import { PROMO_PENDING_COOKIE } from "@/lib/auth/promoPending";
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

export const dynamic = "force-dynamic";

const YEAR = 60 * 60 * 24 * 365;

/**
 * GET /api/auth/google/callback — шаг 2 OAuth:
 * сверка state → обмен code → профиль Google → v9-гейт:
 *
 *   - google-email уже с аккаунтом → вход (nr_uid + nr_auth) → ?next;
 *   - google-email новый + промокод из /auth (cookie nr_promo_pending)
 *     погашен атомарно → аккаунт (nr_uid + nr_auth) → ?next;
 *   - новый БЕЗ промо / код не выкупился → строка в WaitlistEntry →
 *     редирект на /auth?waitlisted=1&reason=… (экран «лист ожидания»).
 *
 * Ошибки OAuth — редирект на /auth?auth=… (экран входа, не /bet:
 * с закрытым запуском гость всё равно не пройдёт мимо гейта).
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

  const profile = await exchangeCode(code);
  if (!profile || !profile.emailVerified) return fail("google_profile");

  try {
    const ipHash = ipHashOf(req);
    const pendingRaw = req.cookies.get(PROMO_PENDING_COOKIE)?.value || null;
    const pending = pendingRaw ? normalizePromoCode(pendingRaw) : null;

    const outcome = await signInWithGoogleGated(profile, req, pending, ipHash, {
      budgetOk: async (h, kind) => promoBudgetOk(h, kind),
      record: (h, kind, ok, subject) => void recordAttempt(h, kind, ok, subject),
      claim: (flat, accountId) => claimPromo(flat, accountId),
      waitlist: async (email, source) => {
        await db.waitlistEntry.upsert({
          where: { email },
          create: { email, passwordHash: "", source },
          update: { source, approvedAt: null, convertedAccountId: null },
        });
      },
      newId: () => newAccountId(),
    });

    if (outcome.kind === "rate_limited") {
      return NextResponse.redirect(`${origin}/auth?auth=rate_limited`, 303);
    }

    if (outcome.kind === "waitlisted") {
      return NextResponse.redirect(
        `${origin}/auth?waitlisted=1&reason=${outcome.reason}`,
        303
      );
    }

    /* зарегистрирован через промо — гасим его заявку в листе ожидания,
       если такая была (await: след читается сразу после ответа) */
    if (outcome.kind === "registered") {
      await approveWaitlist(profile.email, outcome.accountId);
    }

    const next = sanitizeNext(req.nextUrl.searchParams.get("next"));
    const res = NextResponse.redirect(`${origin}${next}`, 303);
    res.cookies.set("nr_uid", outcome.accountId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
    /* v9: маркер «полноправного члена» для middleware-гейта */
    res.cookies.set("nr_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    res.cookies.set(PROMO_PENDING_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
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
