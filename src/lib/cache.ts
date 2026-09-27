import "server-only";

/**
 * v7 (п.10 ТЗ) — кэш-слой приложения: «кэширование желательно в Vercel
 * и задел на кэширование на Supabase».
 *
 * Vercel: страницы/статика кэшируются header'ами (next.config.ts:
 * s-maxage + stale-while-revalidate на /api/posts и immutable на статику);
 * edge-CDN сам держит кэш — этому модулю там делать почти нечего.
 *
 * Здесь — серверный TTL-кэш для горячих ЧТЕНИЙ (списки постов, сводки,
 * рейтинги): memory-backend по умолчанию, и ЗАДЕЛ на Supabase: при
 * заданных SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_CACHE_TABLE
 * включается REST-адаптер (PostgREST) — кэш переживает рестарты инстансов
 * и шарится между регионами. Для активации достаточно завести таблицу:
 *
 *   create table cache (
 *     key text primary key,
 *     value jsonb not null,
 *     expires_at timestamptz not null
 *   );
 *
 * API — единый и синхронный для memory, асинхронный для Supabase:
 *   cacheGet<T>(key), cacheSet(key, value, ttlSec), cacheWrap(key, ttlSec, fn)
 * В supabase-режиме cacheWrap асинхронен (как и есть), в memory — мгновенен.
 */

export type CacheBackend = "memory" | "supabase";

const MEM_MAX = 500;
const mem = new Map<string, { v: unknown; exp: number }>();

function now(): number {
  return Date.now();
}

function memGet<T>(key: string): T | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp <= now()) {
    mem.delete(key);
    return null;
  }
  /* LRU-подход: освежаем позицию */
  mem.delete(key);
  mem.set(key, hit);
  return hit.v as T;
}

function memSet(key: string, value: unknown, ttlSec: number): void {
  if (mem.size >= MEM_MAX) {
    /* выкидываем самый старый (первый по Map-порядку) */
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(key, { v: value, exp: now() + ttlSec * 1000 });
}

/* ------------------------------------------------------------------ */
/*  Supabase-адаптер (задел): REST-only, без новых зависимостей        */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_CACHE_TABLE || "cache";

export function cacheBackend(): CacheBackend {
  return SUPABASE_URL && SUPABASE_KEY ? "supabase" : "memory";
}

async function sbGet<T>(key: string): Promise<T | null> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=value,expires_at&key=eq.${encodeURIComponent(key)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ value: T; expires_at: string }>;
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= now()) return null;
    return row.value;
  } catch {
    return null; /* Supabase недоступен — деградация в miss */
  }
}

async function sbSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    const expires_at = new Date(now() + ttlSec * 1000).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify([{ key, value, expires_at }]),
    });
  } catch {
    /* запись в кэш никогда не роняет запрос */
  }
}

/* ------------------------------------------------------------------ */
/*  Публичный API                                                      */
/* ------------------------------------------------------------------ */

export async function cacheGet<T>(key: string): Promise<T | null> {
  return cacheBackend() === "supabase" ? sbGet<T>(key) : memGet<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (cacheBackend() === "supabase") return sbSet(key, value, ttlSec);
  memSet(key, value, ttlSec);
  return;
}

/** Чтение-через-кэш: miss → fn() → запись. Ошибка fn() наружу, кэш не роняет. */
export async function cacheWrap<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await fn();
  await cacheSet(key, fresh, ttlSec);
  return fresh;
}

/** Инвалидация одной записи (memory; Supabase — DELETE-задел). */
export async function cacheDel(key: string): Promise<void> {
  mem.delete(key);
  if (cacheBackend() === "supabase") {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?key=eq.${encodeURIComponent(key)}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
    } catch {
      /* best-effort */
    }
  }
}
