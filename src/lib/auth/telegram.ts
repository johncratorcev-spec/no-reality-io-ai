import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * v11 — Telegram Login Widget: серверная проверка подписи (официальная спека).
 *
 * Клиент (виджет на /auth) отдаёт нам ровно те поля, что подписал Telegram:
 *   id, first_name, last_name, username, photo_url, auth_date, hash.
 * Проверка:
 *   data_check_string = поля (кроме hash), отсортированные по имени,
 *                       склеенные "\n" в виде key=value;
 *   secret_key        = SHA256(bot_token);
 *   hash              = HMAC-SHA256(data_check_string, secret_key) hex.
 * Дополнительно: auth_date не старше 24ч и не из будущего (replay-защита),
 * id — числовая строка 2..20 знаков. Подделка без bot_token невозможна.
 */

export interface TelegramLoginPayload {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

/** Поля в алфавитном порядке — порядок data_check_string. */
const SIGNED_FIELDS = ["auth_date", "first_name", "id", "last_name", "photo_url", "username"] as const;

/** 24 часа: виджет на iPhone может висеть открытым — окно щедрое, но не вечное. */
const MAX_AGE_SEC = 86_400;

export function telegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

export function verifyTelegramPayload(
  p: TelegramLoginPayload,
  botToken: string,
  nowSec = Math.floor(Date.now() / 1000)
): { ok: boolean; reason?: string } {
  if (!botToken) return { ok: false, reason: "not_configured" };
  if (!/^\d{2,20}$/.test(p.id || "")) return { ok: false, reason: "bad_id" };
  const authDate = Number(p.auth_date);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: "bad_auth_date" };
  if (nowSec - authDate > MAX_AGE_SEC) return { ok: false, reason: "expired" };
  if (authDate - nowSec > 300) return { ok: false, reason: "future_date" };
  if (!/^[a-f0-9]{64}$/.test(p.hash || "")) return { ok: false, reason: "bad_hash" };

  const bag = p as unknown as Record<string, string | undefined>;
  const checkString = SIGNED_FIELDS.filter((f) => {
    const v = bag[f];
    return typeof v === "string" && v.length > 0;
  })
    .map((f) => `${f}=${bag[f]}`)
    .join("\n");

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.hash);
  const same = a.length === b.length && timingSafeEqual(a, b);
  return same ? { ok: true } : { ok: false, reason: "bad_hash" };
}

/** Человекочитаемое имя: first_name + last_name, иначе @username. */
export function telegramDisplayName(p: TelegramLoginPayload): string {
  const name = [p.first_name, p.last_name]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 64);
  if (name) return name;
  return p.username ? `@${p.username.slice(0, 32)}` : "";
}
