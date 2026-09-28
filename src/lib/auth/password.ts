import "server-only";

import { randomUUID, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureAccount } from "@/lib/account";
import { trackEvent } from "@/lib/bet/events";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * v8 — вход/регистрация через СВОЮ форму (email + пароль) на Supabase Postgres.
 *
 * ТЗ: «без подтверждения учётной записи — просто если есть аккаунт, зашёл;
 * если почта уникальная, то создаётся профиль». Подтверждение по письму
 * отсутствует как класс: почта НЕ проверяется, пароль — единственный ключ.
 *
 * БЕЗОПАСНОСТЬ:
 *  - пароли только хешами scrypt (node:crypto, N=16384, 64-байтный ключ),
 *    формат `scrypt$<saltHex>$<hashHex>`; соль случайная на аккаунт;
 *  - сверка через timingSafeEqual (нет утечки по времени);
 *  - email нормализуется в lowercase, длина ограничена 254;
 *  - перебор пароля режет rateLimit на роуте (5/мин на IP);
 *  - сессия — тот же httpOnly-cookie nr_uid, что у google/magic-входа;
 *  - гостевой nr_uid при регистрации связывается с email (баланс не теряется).
 */

export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 128;
export const EMAIL_MAX_LEN = 254;

export class PasswordAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code:
      | "bad_email"
      | "bad_password"
      | "wrong_password"
      | "auth_failed"
  ) {
    super(message);
  }
}

/** Нормализация email: trim + lowercase; null если не похоже на почту. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LEN) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** Политика пароля: 8..128 символов после trim. */
export function validatePassword(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const password = raw.trim();
  if (password.length < PASSWORD_MIN_LEN || password.length > PASSWORD_MAX_LEN) {
    return null;
  }
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomUUID().replace(/-/g, ""); // 32 hex-символа
  const hash = await scrypt(password, Buffer.from(salt, "hex"), 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hex] = parts;
  try {
    const expected = Buffer.from(hex, "hex");
    const actual = await scrypt(password, Buffer.from(salt, "hex"), expected.length);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

export interface PasswordAuthResult {
  accountId: string;
  isNew: boolean; // true — создан новый профиль
  linked: boolean; // true — email привязан к гостевому nr_uid
}

/**
 * Главная функция ТЗ v8: «если есть аккаунт — зашёл, если почта уникальная —
 * создаётся профиль».
 *
 *  1. Email найден в EmailAuth → сверяем пароль → вход в его Account.
 *  2. Email уникален → регистрация: привязываем email к гостевому
 *     nr_uid (если жив и без email), иначе создаём новый Account.
 *     passTier поднимается до 1 (NR PASS), welcome-бонус не задваивается
 *     (гостю начислялся ранее; новый аккаунт получает его через
 *     ensureAccount ровно один раз).
 */
export async function signInOrRegister(
  email: string,
  password: string,
  req: NextRequest
): Promise<PasswordAuthResult> {
  const existing = await db.emailAuth.findUnique({ where: { email } });
  if (existing) {
    const ok = await verifyPassword(password, existing.passwordHash);
    if (!ok) {
      throw new PasswordAuthError("wrong password", 401, "wrong_password");
    }
    if (!existing.accountId) {
      throw new PasswordAuthError("auth broken", 500, "auth_failed");
    }
    const acc = await db.account.findUnique({
      where: { id: existing.accountId },
      select: { passTier: true },
    });
    if (acc && !acc.passTier) {
      await db.account.updateMany({
        where: { id: existing.accountId, passTier: 0 },
        data: { passTier: 1 },
      });
    }
    void trackEvent("password_signin", { meta: { linked: true } });
    return { accountId: existing.accountId, isNew: false, linked: false };
  }

  /* ---- регистрация: почта уникальна ---- */

  // гостевой nr_uid — если жив и без email, входим в него (баланс сохраняется)
  const guestId = req.cookies.get("nr_uid")?.value;
  if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
    const guest = await db.account.findUnique({ where: { id: guestId } });
    if (guest && !guest.email) {
      try {
        // атомарно: и email на Account, и строка EmailAuth — вместе.
        // updateMany (а не update): фильтр по не-unique email: null в
        // update запрещён Prisma; гонку email закроет unique EmailAuth.
        const passwordHash = await hashPassword(password);
        await db.$transaction([
          db.account.updateMany({
            where: { id: guest.id, email: null },
            data: { email, passTier: 1 },
          }),
          db.emailAuth.create({
            data: { accountId: guest.id, email, passwordHash },
          }),
        ]);
        void trackEvent("password_signup", { meta: { linked: true } });
        return { accountId: guest.id, isNew: true, linked: true };
      } catch {
        // гонка (email заняли параллельно) — падаем в обычную регистрацию
      }
    }
  }

  // свежий аккаунт: форма = регистрация с порогом 0 (+welcome-бонус)
  const acc = await ensureAccount(randomId());
  try {
    const passwordHash = await hashPassword(password);
    await db.$transaction([
      db.account.update({ where: { id: acc.id }, data: { email, passTier: 1 } }),
      db.emailAuth.create({
        data: { accountId: acc.id, email, passwordHash },
      }),
    ]);
  } catch {
    // email успели занять между findUnique и create — честный отказ
    throw new PasswordAuthError("email taken", 409, "bad_email");
  }
  void trackEvent("password_signup", { meta: {} });
  return { accountId: acc.id, isNew: true, linked: false };
}

function randomId(): string {
  return randomUUID();
}
