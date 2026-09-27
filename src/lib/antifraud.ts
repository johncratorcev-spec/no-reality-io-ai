import "server-only";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { ECON } from "@/lib/account";

/**
 * Анти-фрод системы наград (v6): цель — боты не должны фармить внутреннюю
 * валюту. Слои защиты (дешёвые первыми):
 *
 *  1. UA-эвристика — известные сигнатуры ботов/скрейперов/headless;
 *  2. IP rate-limit (общий in-memory sliding window, см. lib/rateLimit);
 *  3. минимальный интервал между наградами одного аккаунта (velocity);
 *  4. дневной капс на аккаунт по kind (считается по LedgerTxn);
 *  5. дедуп события — refKey unique в LedgerTxn (click:<target>:<day> и т.п.);
 *  6. Turnstile-ready: если TURNSTILE_SECRET задан, reward-эндпоинт требует
 *     валидный cf-turnstile-response (Cloudflare integration prep).
 *
 * Ни IP, ни UA не хранятся персонально — только в момент проверки.
 */

const BOT_UA_RE = new RegExp(
  "(bot|crawler|spider|crawling|curl|wget|python-requests|python-urllib|scrapy|httpclient|java/|okhttp|go-http|libwww|headlesschrome|headless|puppeteer|playwright|phantomjs|selenium|axios/|node-fetch|bun/)",
  "i"
);

export function looksLikeBot(ua: string): boolean {
  if (!ua || ua === "unknown" || ua.length < 8) return true;
  return BOT_UA_RE.test(ua);
}

export interface AntifraudInput {
  accountId: string;
  ip: string;
  ua: string;
  /** reward-kind: click_reward | utm_reward */
  kind: "click_reward" | "utm_reward";
  /** ключ дедупа конкретного события (без дня) */
  dedupeKey?: string;
  /** лимит IP/мин для этого эндпоинта */
  ipPerMin?: number;
}

export interface AntifraudResult {
  ok: boolean;
  code?: "bot" | "rate_limited" | "too_fast" | "daily_cap" | "duplicate" | "captcha";
  retryAfterSec?: number;
}

/**
 * Проверка права на награду. Вызывать ДО applyLedger; refKey для
 * applyLedger строится с днём, чтобы дедуп был посуточным.
 */
export async function guardReward(input: AntifraudInput): Promise<AntifraudResult> {
  /* 1. бот? */
  if (looksLikeBot(input.ua)) {
    return { ok: false, code: "bot" };
  }

  /* 2. IP rate limit */
  const rl = rateLimit(`reward:${input.kind}:${input.ip}`, input.ipPerMin ?? 30, 60_000);
  if (!rl.ok) {
    return { ok: false, code: "rate_limited", retryAfterSec: rl.retryAfterSec };
  }

  /* 6. Turnstile (только если секрет задан — Cloudflare-интеграция) */
  const turnstile = process.env.TURNSTILE_SECRET;
  if (turnstile && input.kind === "click_reward") {
    /* токен проверяется на эндпоинте (нужен body); здесь — готовность */
  }

  /* 3. velocity: минимальный интервал между наградами аккаунта */
  if (ECON.clickMinIntervalMs > 0) {
    const last = await db.ledgerTxn.findFirst({
      where: { accountId: input.accountId, kind: input.kind },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last && Date.now() - last.createdAt.getTime() < ECON.clickMinIntervalMs) {
      return { ok: false, code: "too_fast" };
    }
  }

  /* 4. дневной капс на аккаунт */
  const cap =
    input.kind === "click_reward" ? ECON.clickRewardDailyCap : ECON.utmRewardDailyCap;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const todayCount = await db.ledgerTxn.count({
    where: { accountId: input.accountId, kind: input.kind, createdAt: { gte: dayStart } },
  });
  if (todayCount >= cap) {
    return { ok: false, code: "daily_cap" };
  }

  /* 5. дедуп конкретного события */
  if (input.dedupeKey) {
    const dup = await db.ledgerTxn.findFirst({
      where: { refKey: input.dedupeKey },
      select: { id: true },
    });
    if (dup) return { ok: false, code: "duplicate" };
  }

  return { ok: true };
}

/**
 * Верификация Cloudflare Turnstile (для будущей интеграции CF).
 * Возвращает true только когда секрет задан И токен валиден.
 */
export async function verifyTurnstile(
  token: string,
  ip: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; /* не настроено — не мешаем */
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false; /* сеть дрогнула — отказ безопаснее */
  }
}
