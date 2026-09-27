import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/**
 * v7 — антифрод Instagram-задания (подписка на @mmayrday).
 *
 * Полная верификация подписки без Instagram Graph API невозможна, поэтому
 * защита строится на идемпотентности и экономике:
 *  - награда ОДИН раз на аккаунт (refKey ig:<accountId>, unique в ledger);
 *  - заявка требует подписанной open-куки: игрок должен реально открыть
 *    ссылку на Instagram через /api/reward/instagram?open=1, кука живёт
 *    2 часа, claim возможен не раньше IG_MIN_DELAY_SEC (25с) — «мгновенно
 *    закрыть окно» не проходит;
 *  - rate limit по IP на claim; перечислить вручную/отменить — админ
 *    по [money-op][ig] логам.
 */

export const IG_OPEN_COOKIE = "nr_ig_open";
/** минимальная задержка open → claim (сек): честное время на переход */
export const IG_MIN_DELAY_SEC = 25;
/** срок жизни open-куки (сек) */
export const IG_OPEN_TTL_SEC = 2 * 60 * 60;

function igKey(): string {
  return `ig-open:${process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || "no-reality-ig"}`;
}

function sign(payload: string): string {
  return createHmac("sha256", igKey()).update(payload).digest("base64url");
}

/** подписанный токен открытия: `<ts>.<hmac>` */
export function issueOpenToken(now = Date.now()): string {
  const payload = String(Math.floor(now / 1000));
  return `${payload}.${sign(payload)}`;
}

/** проверка open-куки: подпись живая, возраст в [minDelay, ttl] */
export function verifyOpenToken(
  token: string | undefined | null,
  now = Date.now()
): { ok: boolean; reason?: "missing" | "bad" | "too_fast" | "expired" } {
  if (!token) return { ok: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad" };
  const [tsRaw, mac] = parts;
  const expected = sign(tsRaw);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad" };
  }
  const ts = Number.parseInt(tsRaw, 10) * 1000;
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad" };
  const age = Math.floor((now - ts) / 1000);
  if (age < IG_MIN_DELAY_SEC) return { ok: false, reason: "too_fast" };
  if (age > IG_OPEN_TTL_SEC) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** URL Instagram-аккаунта задания (mmayrday) */
export function instagramUrl(): string {
  const handle = process.env.INSTAGRAM_HANDLE || "mmayrday";
  return `https://www.instagram.com/${handle.replace(/^@/, "")}/`;
}
