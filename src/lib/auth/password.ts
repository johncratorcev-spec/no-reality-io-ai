import "server-only";

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

/**
 * v22 — ПАРОЛЬНАЯ АУТЕНТИФИКАЦИЯ ЧИСТО НА БД (без внешнего IdP).
 *
 * Формат хранения в EmailAuth.passwordHash: `scrypt$<saltHex>$<hashHex>`
 * (salt 16 байт, ключ 64 байта — параметры N=16384,r=8,p=1 по умолчанию
 * node's crypto.scrypt). verify — constant-time, длина ключа берётся из
 * сохранённого хеша (позволяет будущие апгрейды параметров без миграции).
 *
 * Регистрация/вход полностью в нашей БД: профиль пользователя создаёт
 * signInWithEmailIdentity (lib/auth/identity.ts) — тот же путь welcome
 * +100 EYE, усыновления гостя, рефералки и Early Bird, что и раньше.
 */

const KEYLEN = 64;

/** хеш пароля для EmailAuth.passwordHash */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** проверка пароля против сохранённого хеша (false — любой сбой) */
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  try {
    const parts = (stored || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const got = await scrypt(pw, salt, expected.length);
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  КЛЮЧ ДОСТУПА (v22): регистрация закрыта ключом, пока задан          */
/*  NR_ACCESS_KEY (список через запятую). Вход существующих — БЕЗ       */
/*  ключа. Ключ не задан → регистрация открыта.                         */
/* ------------------------------------------------------------------ */

function accessKeys(): string[] {
  return (process.env.NR_ACCESS_KEY || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** true — для регистрации нужен ключ (NR_ACCESS_KEY задан) */
export function accessKeyRequired(): boolean {
  return accessKeys().length > 0;
}

/** проверка ключа регистрации (constant-time против каждого из списка) */
export function accessKeyOk(key: unknown): boolean {
  const keys = accessKeys();
  if (keys.length === 0) return true; // ключ не настроен — регистрация открыта
  if (typeof key !== "string" || !key.trim()) return false;
  const given = Buffer.from(key.trim());
  return keys.some((k) => {
    const want = Buffer.from(k);
    return (
      given.length === want.length &&
      timingSafeEqual(given, want)
    );
  });
}
