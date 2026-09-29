import "server-only";

import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * v9 — промокоды закрытого запуска + анти-брутфорс на БД.
 *
 * ПОЧЕМУ НЕ В ПАМЯТИ: у Vercel много изолятов, in-memory rateLimit видит
 * только свой процесс — атакующий растечкается по инстансам. Бюджеты
 * попыток считаем в Supabase (PromoAttempt), это кросс-инстансно и
 * переживает ре-деплой.
 *
 * ПРИВАТНОСТЬ: сырой IP не храним — только sha256(ip + соль).
 *
 * ФОРМАТ КОДА: NR-XXXX-XXXX-XXXX, алфавит 31 символ (без 0/O/1/I/L —
 * не путаются глазами и не дают «дешёвых» коллизий при вводе).
 * 31^12 ≈ 7.9e17 — при 3000 активных кодов шанс угадать ≈ 4e-15.
 * Плюс бюджет: 8 промахов/час и 20/сутки на ipHash → перебор невозможен.
 */

export const PROMO_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PROMO_PREFIX = "NR";
export const PROMO_GROUP = 4;
export const PROMO_GROUPS = 3;

/* Бюджеты анти-брутфорса (env перекрывают для тестов) */
function num(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v) || v < min || v > max) return def;
  return Math.round(v);
}

export const PROMO_LIMITS = {
  invalidPerHour: num("PROMO_FAIL_LIMIT_HOUR", 8, 1, 1000),
  invalidPerDay: num("PROMO_FAIL_LIMIT_DAY", 20, 1, 10000),
  passwordFailPerHour: num("PASSWORD_FAIL_LIMIT_HOUR", 10, 1, 1000),
};

/** Хеш IP для бюджетов: sha256(ip + ADMIN_SECRET) — соль из существующего секрета. */
export function ipHashOf(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const salt = process.env.ADMIN_SECRET || "nr-default-salt";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32);
}

/**
 * Нормализация ввода: trim, верхний регистр, дефисы/пробелы вгрызаются.
 * Возвращает null, если ввод не похож на код нашей геометрии
 * (длина/алфавит) — ДО обращения к БД, мусор не долбит базу.
 */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s\-_]/g, "");
  if (!cleaned.startsWith(PROMO_PREFIX)) return null;
  const body = cleaned.slice(PROMO_PREFIX.length);
  if (body.length !== PROMO_GROUP * PROMO_GROUPS) return null;
  for (const ch of body) {
    if (!PROMO_ALPHABET.includes(ch)) return null;
  }
  return `${PROMO_PREFIX}${body}`;
}

/** Красивый формат с дефисами для выдачи/писем: NR-XXXX-XXXX-XXXX. */
export function formatPromoCode(flat: string): string {
  const body = flat.slice(PROMO_PREFIX.length);
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += PROMO_GROUP) groups.push(body.slice(i, i + PROMO_GROUP));
  return `${PROMO_PREFIX}-${groups.join("-")}`;
}

/**
 * Бюджет промахов по ipHash (кросс-инстанс, по БД).
 * ok=true не тратит бюджет (не считается промахом).
 * Возвращает {allowed, retryAfterSec}.
 */
export async function promoBudgetOk(
  ipHash: string,
  kind: "promo" | "password"
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const now = Date.now();
  const hourAgo = new Date(now - 3_600_000);
  const dayAgo = new Date(now - 86_400_000);

  try {
    if (kind === "password") {
      const fails = await db.promoAttempt.count({
        where: { ipHash, kind, ok: false, createdAt: { gte: hourAgo } },
      });
      if (fails >= PROMO_LIMITS.passwordFailPerHour) {
        return { allowed: false, retryAfterSec: 3600 };
      }
      return { allowed: true, retryAfterSec: 0 };
    }

    const [hour, day] = await Promise.all([
      db.promoAttempt.count({
        where: { ipHash, kind, ok: false, createdAt: { gte: hourAgo } },
      }),
      db.promoAttempt.count({
        where: { ipHash, kind, ok: false, createdAt: { gte: dayAgo } },
      }),
    ]);
    if (hour >= PROMO_LIMITS.invalidPerHour) return { allowed: false, retryAfterSec: 3600 };
    if (day >= PROMO_LIMITS.invalidPerDay) {
      const tillMidnight = 86_400 - Math.floor((now / 1000) % 86_400);
      return { allowed: false, retryAfterSec: Math.max(tillMidnight, 60) };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    /* БД бюджетной таблицы недоступна — не блокируем регистрацию целиком:
       первая линия (in-memory rateLimit на роуте) продолжает работать */
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Запись попытки (best-effort: сбой журнала не ломает основной сценарий). */
export async function recordAttempt(
  ipHash: string,
  kind: "promo" | "password",
  ok: boolean,
  subject: string
): Promise<void> {
  try {
    await db.promoAttempt.create({
      data: { ipHash, kind, ok, subject: subject.slice(0, 64) },
    });
  } catch {
    /* журнал не критичен для ответа */
  }
}

export type PromoClaimResult =
  | { outcome: "claimed"; promoId: string }
  | { outcome: "not_found" }
  | { outcome: "used" };

/**
 * АТОМАРНЫЙ выкуп кода: updateMany с guard'ом usedBy=null.
 * Гонка двух регистраций с одним кодом даёт ровно одного победителя
 * (count===1), второй получает used → лист ожидания.
 */
export async function claimPromo(
  flatCode: string,
  accountId: string
): Promise<PromoClaimResult> {
  const existing = await db.promoCode.findUnique({ where: { code: flatCode } });
  if (!existing) return { outcome: "not_found" };
  const moved = await db.promoCode.updateMany({
    where: { code: flatCode, usedBy: null },
    data: { usedBy: accountId, usedAt: new Date() },
  });
  if (moved.count === 1) return { outcome: "claimed", promoId: existing.id };
  return { outcome: "used" };
}

/** Апрув листа ожидания после успешной регистрации с промо. */
export async function approveWaitlist(email: string, accountId: string): Promise<void> {
  try {
    await db.waitlistEntry.updateMany({
      where: { email, approvedAt: null },
      data: { approvedAt: new Date(), convertedAccountId: accountId },
    });
  } catch {
    /* лист ожидания не критичен для входа */
  }
}

/** Новый случайный код в плоском виде (без дефисов): NR…XXXXXXXXXXXX. */
export function generateFlatCode(rand: () => number = Math.random): string {
  let body = "";
  for (let i = 0; i < PROMO_GROUP * PROMO_GROUPS; i++) {
    body += PROMO_ALPHABET[Math.floor(rand() * PROMO_ALPHABET.length)];
  }
  return `${PROMO_PREFIX}${body}`;
}

/** UUID для новых аккаунтов (паритет с auth/password). */
export function newAccountId(): string {
  return randomUUID();
}
