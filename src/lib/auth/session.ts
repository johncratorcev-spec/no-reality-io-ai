import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * v10 — ПОДПИСАННАЯ сессия (усиление узкого места v9).
 *
 * Раньше nr_auth был константой «1», а nr_uid — единственным ключом
 * аккаунта: прокси/перехват cookie позволял нести чужой nr_uid с ВАЛИДНЫМ
 * nr_auth и действовать от чужого баланса. Теперь nr_auth привязан к
 * nr_uid HMAC-подписью: nr_auth = "v1.<hmac(uid, secret)>". Подделка пары
 * cookie без секрета невозможна, утечка одного cookie не даёт сессии.
 *
 * Секрет: SESSION_SECRET → fallback ADMIN_SECRET (уже обязателен в проде)
 * → dev-дефолт. Ротация секрета инвалидирует все сессии (безопасный
 * «logout everywhere», пользователи просто входят заново).
 *
 * Легаси: nr_auth="1" (v9) больше не валиден — носитель считается гостем.
 * На проде это no-op (прод ещё на v6, v9-сессий нет), в dev — re-login.
 */

const YEAR = 60 * 60 * 24 * 365;
const UID_RE = /^[0-9a-f-]{36}$/i;

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_SECRET ||
    "no-reality-dev-session-secret"
  );
}

/** Подписанное значение nr_auth для аккаунта. */
export function authCookieValue(uid: string): string {
  const sig = createHmac("sha256", sessionSecret())
    .update(`nr-auth:${uid}`)
    .digest("base64url")
    .slice(0, 32);
  return `v1.${sig}`;
}

/** Проверка пары cookie (nr_uid + nr_auth) с constant-time сравнением. */
export function verifyAuthCookie(req: NextRequest, uid: string | null): boolean {
  if (!uid || !UID_RE.test(uid)) return false;
  const raw = req.cookies.get("nr_auth")?.value || "";
  if (!raw.startsWith("v1.")) return false;
  const expected = authCookieValue(uid);
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Аккаунт с валидной сессией — единственный субъект ставок/наград/пополнений.
 * null у гостя (в т.ч. у легаси nr_uid без подписи).
 */
export function authedAccountId(req: NextRequest): string | null {
  const uid = req.cookies.get("nr_uid")?.value || null;
  return verifyAuthCookie(req, uid) ? uid : null;
}

/**
 * Сессионные cookie входа (nr_uid + подписанный nr_auth).
 * Единственная точка: google-вход (passport-google-oauth20, v16).
 */
export function setSessionCookies(
  res: NextResponse,
  accountId: string
): NextResponse {
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  };
  res.cookies.set("nr_uid", accountId, base);
  res.cookies.set("nr_auth", authCookieValue(accountId), base);
  return res;
}
