import "server-only";

import { db } from "@/lib/db";

/**
 * v11 — Season 1: 7-дневный игровой цикл (приказ «заморозить контур»).
 *
 * Один активный сезон (code="s1"). Старт — 12:00 UTC дня создания,
 * конец — 12:00 UTC T+7. Снапшот снимается админом в любой момент
 * после endsAt (GET /api/admin/snapshot?key=…), затем сезон архивируется.
 *
 * ПРАВИЛА СЕЗОНА (v14, ТЗ §Раздача $NR):
 *   - EYE — очки пари-мьютюэля; докупаются ТОЛЬКО пачками (касса);
 *   - $NR докупить нельзя: инвойс не минтит $NR и не пишет сезонный вес;
 *   - вес сезона = sum(stake × time_decay) по ВЕРНЫМ ставкам
 *     (1/0.4/0 по окну, кеп ставки 50 EYE), ноль при < 20 верных раундов,
 *     кеп аккаунта 2% игровой пачки; доли 75/15/10;
 *   - расчёт веса: src/lib/nr-snapshot.ts; прежняя формула «баланс ×
 *     нормированное число ставок» УДАЛЕНА из кода и с сайта (ТЗ);
 *   - токен на Base — merkle claim ПОСЛЕ снапшота, один раз.
 */

const DAY_MS = 86_400_000;
export const SEASON_CODE = "s1";
export const SEASON_NAME = "Season 1";
export const SEASON_DAYS = 7;
/** час среза по UTC (объявленное правило) */
export const SNAPSHOT_HOUR_UTC = 12;
/* v14: формулы среза переехали в nr-snapshot.ts (weight = stake×decay
   верных коллов, кепы 50 EYE / <20 раундов / 2% пачки). Ниже — публичные
   константы правил сезона. */
export const SNAPSHOT_MIN_CORRECT_ROUNDS = 20;
export const SNAPSHOT_STAKE_CAP_EYE = 50;
export const SNAPSHOT_ACCOUNT_CAP_PCT = 0.02;

export interface SeasonRow {
  id: string;
  code: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

/** Приводим конец сезона к 12:00 UTC объявленного дня (T+7). */
export function seasonEndFor(startsAt: Date): Date {
  const end = new Date(startsAt.getTime() + SEASON_DAYS * DAY_MS);
  end.setUTCHours(SNAPSHOT_HOUR_UTC, 0, 0, 0);
  return end;
}

/**
 * Активный сезон, идемпотентно: если активного нет — создаём s1.
 * Старт — 00:00 UTC СЕГОДНЯШНЕГО дня (всё, что поставлено сегодня,
 * попадает в срез), конец — 12:00 UTC T+7. Гонка двух параллельных
 * созданий гасится unique(code) с перечитыванием.
 */
export async function ensureActiveSeason(): Promise<SeasonRow | null> {
  const existing = await db.season.findFirst({
    where: { status: "active" },
    orderBy: { startsAt: "desc" },
  });
  if (existing) return existing;

  const startsAt = new Date();
  startsAt.setUTCHours(0, 0, 0, 0);
  const created = await db.season
    .create({
      data: {
        code: SEASON_CODE,
        name: SEASON_NAME,
        startsAt,
        endsAt: seasonEndFor(startsAt),
      },
    })
    .catch(async () =>
      db.season.findUnique({ where: { code: SEASON_CODE } })
    );
  return created && created.status === "active"
    ? created
    : await db.season.findFirst({ where: { status: "active" } });
}

export interface SeasonInfo {
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** сколько полных суток осталось до среза (может быть 0 в день среза) */
  daysLeft: number;
  /** дата среза для UI: "2026-10-07" */
  snapshotDate: string;
  /** человекочитаемая дата среза: "Oct 7, 12:00 UTC" */
  snapshotLabel: string;
  archived: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function seasonView(s: SeasonRow): SeasonInfo {
  const msLeft = Math.max(0, s.endsAt.getTime() - Date.now());
  const daysLeft = Math.floor(msLeft / DAY_MS);
  const d = s.endsAt;
  return {
    code: s.code,
    name: s.name,
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    daysLeft,
    snapshotDate: s.endsAt.toISOString().slice(0, 10),
    snapshotLabel: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(SNAPSHOT_HOUR_UTC).padStart(2, "0")}:00 UTC`,
    archived: s.status !== "active",
  };
}

/** Публичный срез-статус для лендинга/профиля (создаёт сезон при первом визите). */
export async function seasonInfo(): Promise<SeasonInfo | null> {
  const s = await ensureActiveSeason();
  return s ? seasonView(s) : null;
}
