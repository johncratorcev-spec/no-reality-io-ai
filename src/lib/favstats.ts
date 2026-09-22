import { db } from "@/lib/db";

/* ================================================================
   Счётчик избранного (task 44, ТЗ §3): «X авторизованных пользователей
   добавили в избранное» на карточке видео.

   Хранилище: агрегат-таблица FavoriteStats (поддерживается транзакционно
   в api/favorites на каждом POST/DELETE) → чтение = один findMany.
   Поверх — in-memory кэш на 30с: лента может опрашивать счётчики
   часто, SQLite это не почувствует. При недоступности агрегата —
   добор точным groupBy по Favorite (самовосстановление после сбоев).

   KV здесь сознательно не нужен: значение живёт в памяти процесса,
   промахи дешевле сетевого хопа до KV.
   ================================================================ */

export type FavCounts = Record<string, number>;

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  at: number;
  key: string;
  data: FavCounts;
}

let cache: CacheEntry | null = null;

/** Инвалидация после записи (POST/DELETE favorites) — кэш честный */
export function invalidateFavoriteCounts(): void {
  cache = null;
}

/** Показывать счётчик, только когда есть кого показывать */
export function favCountLabel(n: number): string | null {
  if (n <= 0) return null;
  if (n === 1) return "1 member saved this";
  return `${n} members saved this`;
}

/**
 * Счётчики по списку кодов постов. Ошибки БД → {} (счётчик просто
 * не рендерится — UX не ломается, как и в остальном трекинге).
 */
export async function getFavoriteCounts(codes: string[]): Promise<FavCounts> {
  const wanted = [...new Set(codes.filter(Boolean))];
  if (wanted.length === 0) return {};
  const key = wanted.slice().sort().join(",");
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const map: FavCounts = {};

    // 1) быстрый путь: агрегат
    const agg = await db.favoriteStats.findMany({
      where: { postCode: { in: wanted } },
    });
    for (const a of agg) map[a.postCode] = a.count;

    // 2) самовосстановление: добор точным подсчётом, где агрегата нет
    const missing = wanted.filter((c) => !(c in map));
    if (missing.length > 0) {
      const grouped = await db.favorite.groupBy({
        by: ["postCode"],
        _count: { postCode: true },
        where: { postCode: { in: missing } },
      });
      for (const row of grouped) {
        map[row.postCode] = row._count.postCode;
        // ленивый backfill агрегата (best-effort)
        void db.favoriteStats
          .upsert({
            where: { postCode: row.postCode },
            create: { postCode: row.postCode, count: row._count.postCode },
            update: { count: row._count.postCode },
          })
          .catch(() => {});
      }
    }

    cache = { at: Date.now(), key, data: map };
    return map;
  } catch {
    return {};
  }
}
