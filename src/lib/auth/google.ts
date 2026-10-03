import "server-only";

import { NextRequest } from "next/server";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile as GooglePassportProfile } from "passport-google-oauth20";
import { db } from "@/lib/db";
import { ensureAccount } from "@/lib/account";
import { trackEvent } from "@/lib/bet/events";

/**
 * v16 — Google OAuth через passport-google-oauth20 (ЕДИНСТВЕННЫЙ метод
 * входа; v12 Telegram-виджет, magic-link и парольная форма удалены).
 *
 * ПОРЯДОК (passport внутри, собственный state — снаружи):
 *  1. GET /api/auth/google/start — nonce в httpOnly-cookie nr_g_state +
 *     passport редиректит на consent Google (state передан в options).
 *  2. Google возвращает ?code&state на /api/auth/google/callback.
 *  3. Сверяем state (timing-safe) — CSRF-защита своя, passport-oauth2
 *     работает с NullStore (state:false), сессии passport не нужны.
 *  4. passport обменивает code на токены (client_secret → токен-эндпоинт
 *     по TLS) и тянет профиль с userinfo; email → связка с аккаунтом:
 *     есть Account с таким email — входим; email нов — привязываем к
 *     текущему nr_uid (мгновенный аккаунт) или заводим новый.
 *
 * БЕЗ КЛЮЧЕЙ (sandbox/preview): status.enabled = false, кнопка скрыта,
 * start отдаёт 503. Ключи: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * redirect_uri считается от PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL.
 * GOOGLE_AUTH_URL / GOOGLE_TOKEN_URL / GOOGLE_USERINFO_URL перекрываются
 * ТОЛЬКО в selftest (моки токена и userinfo).
 */

export const GOOGLE_STATE_COOKIE = "nr_g_state";

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function googleRedirectUri(): string {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://no-reality.fun";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

/** timing-safe сверка state из cookie. */
export function stateMatches(cookieState: string | null, urlState: string | null): boolean {
  if (!cookieState || !urlState || cookieState.length !== urlState.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < cookieState.length; i++) {
    diff |= cookieState.charCodeAt(i) ^ urlState.charCodeAt(i);
  }
  return diff === 0;
}

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** Токен-эндпоинт Google; GOOGLE_TOKEN_URL перекрывается только в selftest (мок). */
export function googleTokenUrl(): string {
  return process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
}

/* ================================================================
   passport-google-oauth20 — протокольный слой.
   ================================================================ */

let registeredStrategy: GoogleStrategy | null = null;

/** Профиль userinfo → наш GoogleProfile. Сырой _json приоритетнее
    маппинга библиотеки: email_verified у Google приходит всегда. */
function mapGoogleProfile(profile: GooglePassportProfile): GoogleProfile | null {
  const email = profile.emails?.find((e) => e && typeof e.value === "string")?.value;
  if (!email) return null;
  const raw = (profile as unknown as { _json?: { email_verified?: boolean } })._json ?? {};
  const verifiedFlag =
    profile.emails?.[0]?.verified ?? raw.email_verified ?? true;
  return {
    email: email.toLowerCase(),
    emailVerified: verifiedFlag !== false,
    name: profile.displayName || undefined,
    picture: profile.photos?.find((p) => typeof p?.value === "string")?.value || undefined,
  };
}

function googleStrategy(): GoogleStrategy {
  if (!registeredStrategy) {
    const s = new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "unset",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "unset",
        callbackURL: googleRedirectUri(),
        scope: ["openid", "email", "profile"],
        scopeSeparator: " ",
        /* state ведём СВОИМИ cookie (nr_g_state) — passport-сессии и
           его state-store не нужны (serverless, NullStore) */
        state: false,
        authorizationURL:
          process.env.GOOGLE_AUTH_URL ||
          "https://accounts.google.com/o/oauth2/v2/auth",
        tokenURL: googleTokenUrl(),
        userProfileURL:
          process.env.GOOGLE_USERINFO_URL ||
          "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      (accessToken, refreshToken, params, profile, done) => {
        const mapped = mapGoogleProfile(profile);
        if (!mapped) return done(null, false);
        done(null, mapped);
      }
    );
    /* oauth-библиотека по умолчанию несёт access_token в query-string;
       переключаем на Authorization: Bearer — канонический путь userinfo
       (_oauth2 — документированный «protected» хук стратегии) */
    (s as unknown as { _oauth2?: { useAuthorizationHeaderforGET: (v: boolean) => void } })
      ._oauth2?.useAuthorizationHeaderforGET(true);
    passport.use(s);
    registeredStrategy = s;
  }
  return registeredStrategy;
}

export interface PassportGoogleResult {
  /** start: URL, куда passport попросил редирект (consent Google). */
  location: string | null;
  /** callback: профиль от verify (или null). */
  profile: GoogleProfile | null;
  /** callback: стратегия вернула отказ (fail) — причина. */
  failure: string | null;
  /** внутренняя ошибка протокола/сети. */
  error: Error | null;
}

/**
 * Прогон passport.authenticate внутри App Router route handler.
 * Passport живёт в Connect-мире: собираем shim req (query/headers/url)
 * и res (statusCode/setHeader/end), ловим 302-location или результат
 * кастомного callback'а. Ничего не пишем в глобальный ответ.
 */
function runPassportGoogle(
  req: NextRequest,
  options: Record<string, unknown>
): Promise<PassportGoogleResult> {
  return new Promise((resolve) => {
    const strategy = googleStrategy();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (r: PassportGoogleResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(r);
    };
    /* страховка от зависания в serverless */
    timer = setTimeout(
      () => settle({ location: null, profile: null, failure: null, error: new Error("google strategy timeout") }),
      15_000
    );

    /* --- passport.authenticate с кастомным callback (без session) --- */
    const middleware = passport.authenticate(strategy, options, (err, user, info) => {
      if (err) {
        return settle({ location: null, profile: null, failure: null, error: err instanceof Error ? err : new Error(String(err)) });
      }
      if (!user) {
        const reason =
          info && typeof info === "object" && "message" in info
            ? String((info as { message?: unknown }).message)
            : String(info ?? "failed");
        return settle({ location: null, profile: null, failure: reason, error: null });
      }
      settle({ location: null, profile: user as GoogleProfile, failure: null, error: null });
    });

    /* --- shim res: passport редиректит через statusCode/setHeader/end --- */
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[String(name).toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      removeHeader(name: string) {
        delete this.headers[String(name).toLowerCase()];
      },
      write() {},
      end() {
        const location = this.headers["location"];
        settle({
          location: typeof location === "string" ? location : null,
          profile: null,
          failure: null,
          error: null,
        });
      },
    };

    /* --- shim req: Connect-style query/headers/url --- */
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const query: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    const shimReq = {
      url: req.nextUrl.pathname + req.nextUrl.search,
      method: req.method,
      httpVersion: "1.1",
      headers,
      query,
      body: undefined,
      /* state:false — passport-сессия не нужна; объект на всякий случай */
      session: {},
      connection: { encrypted: true },
    };

    try {
      (middleware as (r: unknown, res: unknown, next: (err?: unknown) => void) => void)(
        shimReq,
        res,
        () => {
          /* passport зовёт next() только без решения (skip) */
          settle({ location: null, profile: null, failure: "skipped", error: null });
        }
      );
    } catch (e) {
      settle({
        location: null,
        profile: null,
        failure: null,
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  });
}

/** start: passport строит consent-URL (state попадает в query). */
export async function authenticateGoogleStart(
  req: NextRequest,
  state: string
): Promise<string | null> {
  const r = await runPassportGoogle(req, {
    session: false,
    state,
    /* passport-google-oauth20 2.0.0 ждёт camelCase (accessType) */
    accessType: "online",
    prompt: "select_account",
  });
  return r.location;
}

/** callback: обмен code → профиль. */
export async function authenticateGoogleCallback(
  req: NextRequest
): Promise<PassportGoogleResult> {
  return runPassportGoogle(req, { session: false });
}

/**
 * Вход/регистрация по email: находим Account по email или привязываем
 * email к текущему мгновенному аккаунту. Возвращает accountId сессии.
 * Гостевой nr_uid при наличии связывается (баланс не теряется).
 */
export async function signInWithGoogle(
  profile: GoogleProfile,
  req: NextRequest
): Promise<{ accountId: string; linked: boolean; newAccount: boolean }> {
  const byEmail = await db.account.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (!byEmail.passTier) {
      await db.account.updateMany({
        where: { id: byEmail.id, passTier: 0 },
        data: { passTier: 1 },
      });
    }
    /* v14: поздняя атрибуция (если аккаунт ещё без пригласившего) */
    const refRaw = req.cookies.get("nr_ref")?.value;
    if (refRaw) {
      const { attributeReferral } = await import("@/lib/referral");
      await attributeReferral(byEmail.id, refRaw).catch(() => null);
    }
    void trackEvent("google_signin", { meta: { linked: true } });
    return { accountId: byEmail.id, linked: false, newAccount: false };
  }

  /* гостевой аккаунт из cookie nr_uid — если жив, входим в него */
  const guestId = req.cookies.get("nr_uid")?.value;
  if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
    const guest = await db.account.findUnique({ where: { id: guestId } });
    if (guest && !guest.email) {
      const linked = await db.account
        .update({ where: { id: guest.id }, data: { email: profile.email, passTier: 1 } })
        .then(() => true)
        .catch(() => false);
      if (linked) {
        await ensureAccount(guest.id);
        /* v14: атрибуция усыновлённого гостя по ?ref (cookie nr_ref) */
        const refRaw = req.cookies.get("nr_ref")?.value;
        if (refRaw) {
          const { attributeReferral } = await import("@/lib/referral");
          await attributeReferral(guest.id, refRaw).catch(() => null);
        }
        void trackEvent("google_signin", { meta: { linked: true } });
        return { accountId: guest.id, linked: true, newAccount: false };
      }
    }
  }

  /* свежий аккаунт: google = регистрация с порогом 0 (+ ?ref атрибуция) */
  const refRaw = req.cookies.get("nr_ref")?.value;
  const acc = await ensureAccount(randomId(), refRaw);
  await db.account.update({
    where: { id: acc.id },
    data: { email: profile.email, passTier: 1 },
  });
  void trackEvent("google_signup", { meta: {} });
  return { accountId: acc.id, linked: false, newAccount: true };
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}
