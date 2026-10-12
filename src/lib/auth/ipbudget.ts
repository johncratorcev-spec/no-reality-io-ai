import "server-only";

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * v12 — приватность + анти-брутфорс парольного входа (после удаления
 * секретных кодов). Промо-механика удалена; осталась только защита:
 *
 * - сырой IP не храним — только sha256(ip + соль);
 * - бюджет неверных паролей в БД (PromoAttempt как служебный журнал
 *   безопасности, kind="password") — кросс-инстансно, переживает ре-деплой;
 * - самоизоляция: сбой журнала не блокирует вход (in-memory rateLimit
 *   на роуте остаётся первой линией).
 */

/* Бюджеты (env перекрывают для тестов) */
function num(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v) || v < min || v > max) return def;
  return Math.round(v);
}

export const IP_BUDGET_LIMITS = {
  passwordFailPerHour: num("PASSWORD_FAIL_LIMIT_HOUR", 10, 1, 1000),
};

/** Хеш IP: sha256(ip + ADMIN_SECRET) — соль из существующего секрета. */
export function ipHashOf(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const salt = process.env.ADMIN_SECRET || "nr-default-salt";
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32);
}

/** Бюджет неверных паролей по ipHash (кросс-инстанс, по БД). */
export async function passwordBudgetOk(
  ipHash: string
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const hourAgo = new Date(Date.now() - 3_600_000);
  try {
    const fails = await db.promoAttempt.count({
      where: { ipHash, kind: "password", ok: false, createdAt: { gte: hourAgo } },
    });
    if (fails >= IP_BUDGET_LIMITS.passwordFailPerHour) {
      return { allowed: false, retryAfterSec: 3600 };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    /* журнал недоступен — не блокируем вход: первая линия (in-memory
       rateLimit на роуте) продолжает работать */
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Запись попытки входа (best-effort: сбой журнала не ломает сценарий). */
export async function recordAttempt(
  ipHash: string,
  ok: boolean,
  subject: string
): Promise<void> {
  try {
    await db.promoAttempt.create({
      data: { ipHash, kind: "password", ok, subject: subject.slice(0, 64) },
    });
  } catch {
    /* журнал не критичен для ответа */
  }
}
