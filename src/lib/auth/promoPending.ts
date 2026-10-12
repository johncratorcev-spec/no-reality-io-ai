import "server-only";

import { PROMO_PREFIX, PROMO_ALPHABET, PROMO_GROUP, PROMO_GROUPS } from "@/lib/promo";

/**
 * v9 — промокод, введённый на /auth перед кликом Google.
 * Живёт в httpOnly-cookie nr_promo_pending 10 минут (между start и
 * callback OAuth). Храним ТОЛЬКО код, прошедший проверку геометрии —
 * никакой инъекции в callback: там код всё равно выкупается атомарно
 * с guard'ом usedBy=null и БД-бюджетом промахов.
 */
export const PROMO_PENDING_COOKIE = "nr_promo_pending";

/** Нормализация с проверкой геометрии; null — не наш код. */
export function sanitizePromoPending(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s\-_]/g, "");
  if (!cleaned.startsWith(PROMO_PREFIX)) return null;
  const body = cleaned.slice(PROMO_PREFIX.length);
  if (body.length !== PROMO_GROUP * PROMO_GROUPS) return null;
  for (const ch of body) {
    if (!PROMO_ALPHABET.includes(ch)) return null;
  }
  return `${PROMO_PREFIX}${body}`;
}
