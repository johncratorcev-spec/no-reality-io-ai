import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

/**
 * v7 — сессия панели резолва (+ белый ярлык для white-label iframe).
 *
 * МОДЕЛЬ БЕЗОПАСНОСТИ:
 *  - секретный код (ADMIN_SECRET) знает только куратор; он вводится ОДИН раз
 *    на /admin/resolution, дальше живёт httpOnly-cookie nr_admin (12 часов);
 *  - код сверяется через timingSafeEqual (нет утечки по времени сравнения);
 *  - cookie = HMAC-SHA256(payload, ADMIN_SESSION_SECRET) + payload:
 *    подделать куку без ключа нельзя; утечка ключа ≠ вход (это не код);
 *  - перебор кода: rateLimit 5/мин на IP + блок после 5 неудач (тоже окно);
 *  - SameSite=None; Secure — кука работает и внутри white-label iframe
 *    (кросс-сайтовый контекст), httpOnly не даёт читать её из JS;
 *  - легаси-доступ ?key=<ADMIN_SECRET> остаётся для скриптов/curl, но тоже
 *    timing-safe; новые UI-потоки ключ в URL больше не кладут.
 */

export const ADMIN_COOKIE = "nr_admin";
export const ADMIN_TTL_SEC = 12 * 60 * 60; // 12 часов

const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || "";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    /* длину тоже прячем: сравниваем с самим собой за то же время */
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Сверка секретного кода панели (timing-safe). */
export function adminCodeMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_SECRET || "";
  if (!expected || !candidate) return false;
  return safeEqual(candidate.trim(), expected);
}

/** Легаси-проверка ?key=… для curl/скриптов (timing-safe). */
export function legacyKeyMatches(candidate: string | null): boolean {
  if (!candidate) return false;
  return adminCodeMatches(candidate);
}

/* ------------------------------------------------------------------ */
/*  HMAC-токен сессии                                                  */
/* ------------------------------------------------------------------ */

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

/** Выпуск токена: `<exp>.<nonce>.<hmac(exp.nonce)>`. */
export function issueAdminToken(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ADMIN_TTL_SEC;
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = `${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/** Проверка токена: подпись живая и срок не вышел. */
export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || !SESSION_SECRET) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, mac] = parts;
  const payload = `${expRaw}.${nonce}`;
  if (!safeEqual(mac, sign(payload))) return false;
  const exp = Number.parseInt(expRaw, 10);
  return Number.isFinite(exp) && exp * 1000 > Date.now();
}

/** Текущая сессия запроса: cookie nr_admin (iframe-safe) или ?key= (легаси). */
export function hasAdminSession(req: NextRequest): boolean {
  if (verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return true;
  return legacyKeyMatches(req.nextUrl.searchParams.get("key"));
}

/** Кука сессии: SameSite=None + Secure — работает в white-label iframe. */
export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "none" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  };
}

/**
 * Production-guard: без настроенного секрета админ-эндпоинты мертвы
 * (дефолт "no-reality-secret" вырезан — это была дыра v6).
 */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}
