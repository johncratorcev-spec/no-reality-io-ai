/**
 * In-memory rate limiter (sliding window) — защита /r/[code] и админ-роутов
 * от флуда и примитивного DDoS. Без внешних зависимостей, на один процесс.
 *
 * Не считать легитимный трафик злоупотреблением: лимиты щедрые
 * (30 редиректов/мин с одного IP), а жёсткие — на коды и админку.
 */

const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000; // защита самой карты от разрастания
const PRUNE_OLDER_MS = 10 * 60_000;

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();

  let hits = buckets.get(key);
  if (!hits) {
    if (buckets.size >= MAX_BUCKETS) prune(now);
    hits = [];
    buckets.set(key, hits);
  }

  // сдвигаем окно: выкидываем устаревшие отметки
  const cutoff = now - windowMs;
  let stale = 0;
  while (stale < hits.length && hits[stale] <= cutoff) stale++;
  if (stale > 0) hits.splice(0, stale);

  if (hits.length >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((hits[0] + windowMs - now) / 1000)
    );
    return { ok: false, retryAfterSec, remaining: 0 };
  }

  hits.push(now);

  // подчищаем совсем старые бакеты, когда карта подросла
  if (buckets.size > MAX_BUCKETS / 2 && buckets.size % 64 === 0) {
    prune(now);
  }

  return { ok: true, retryAfterSec: 0, remaining: limit - hits.length };
}

function prune(now: number) {
  const horizon = now - PRUNE_OLDER_MS;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] <= horizon) {
      buckets.delete(key);
    }
  }
}
