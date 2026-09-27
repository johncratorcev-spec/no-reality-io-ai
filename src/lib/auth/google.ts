import "server-only";

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureAccount } from "@/lib/account";
import { trackEvent } from "@/lib/bet/events";

/**
 * v7 — Google Sign-In (регистрация и вход одним Google-аккаунтом).
 *
 * ПОРЯДОК:
 *  1. GET /api/auth/google/start — выдаём state (случайная строка) в
 *     httpOnly-cookie + редирект на consent-экран Google.
 *  2. Google возвращает ?code&state на /api/auth/google/callback.
 *  3. Сверяем state (timing-safe), обмениваем code на токены у Google
 *     (запрос идёт с client_secret напрямую к Google по TLS — ответу
 *     доверяем; отдельная JWKS-проверка не нужна: токен получен НЕ из
 *     недоверенного канала).
 *  4. email из id_token → связка с аккаунтом: если у Account уже есть
 *     такой email (magic-link) — входим в него; если email нов —
 *     привязываем к текущему nr_uid (мгновенный аккаунт), поднимая NR PASS.
 *
 * БЕЗ КЛЮЧЕЙ (sandbox/preview): status.enabled = false, кнопка скрыта,
 * start отдаёт 503. Ключи: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * redirect_uri считается от PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL.
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

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
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

/** Обмен code → id_token → профиль (запрос к Google с client_secret). */
export async function exchangeCode(code: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;
  const payloadB64 = data.id_token.split(".")[1];
  if (!payloadB64) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    ) as {
      email?: string;
      email_verified?: boolean;
      aud?: string;
      name?: string;
      picture?: string;
    };
    if (!json.email || json.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    return {
      email: json.email.toLowerCase(),
      emailVerified: json.email_verified !== false,
      name: json.name,
      picture: json.picture,
    };
  } catch {
    return null;
  }
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
        void trackEvent("google_signin", { meta: { linked: true } });
        return { accountId: guest.id, linked: true, newAccount: false };
      }
    }
  }

  /* свежий аккаунт: google = регистрация с порогом 0 */
  const acc = await ensureAccount(randomId());
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
