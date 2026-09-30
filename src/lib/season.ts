import "server-only";

import { db } from "@/lib/db";

/**
 * v11 — Season 1: 7-дневный игровой цикл (приказ «заморозить контур»).
 *
 * Один активный сезон (code="s1"). Старт — 12:00 UTC дня создания,
 * конец — 12:00 UTC T+7. Снапшот снимается админом в любой момент
 * после endsAt (GET /api/admin/snapshot?key=…), затем сезон архивируется.
 *
 * ПРАВИЛА СЕЗОНА (объявлены в день старта, менять на неделе запрещено):
 *   - EYE — очки за игру, не продаются (платежи выключены приказом);
 *   - в срез попадают аккаунты с eye и ≥ 5 settled (won|lost) ставками;
 *   - аккаунты «только welcome, 0 ставок» и дубли (telegramId unique)
 *     в срез не попадают;
 *   - вес фиксируется формулой weight = eye * min(1, valid_bets / 10);
 *   - токен на Base — merkle claim ПОСЛЕ снапшота (адреса с дня 5).
 */

const DAY_MS = 86_400_000;
export const SEASON_CODE = "s1";
export const SEASON_NAME = "Season 1";
export const SEASON_DAYS = 7;
/** час среза по UTC (объявленное правило) */
export const SNAPSHOT_HOUR_UTC = 12;
/** минимум валидных ставок для попадания в срез */
export const SNAPSHOT_MIN_BETS = 5;
/** знаменатель формулы веса */
export const SNAPSHOT_BETS_NORM = 10;

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

export interface SnapshotRow {
  userId: string;
  telegramId: string;
  displayName: string;
  eye: number;
  score: number;
  bets: number;
  correct: number;
  weight: number;
}

/**
 * Строки снапшота сезона: settled (won|lost) ставки в окне сезона,
 * группировка по аккаунту, отсев < SNAPSHOT_MIN_BETS валидных ставок.
 * eye — текущий баланс (истина — LedgerTxn), score — чистый игровой
 * результат (выплаты − ставки), weight — формула сезона.
 */
export async function snapshotRows(season: SeasonRow): Promise<SnapshotRow[]> {
  const window = { gte: season.startsAt, lt: season.endsAt };

  const settled = await db.bet.groupBy({
    by: ["accountId"],
    where: { createdAt: window, status: { in: ["won", "lost"] }, accountId: { not: null } },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
  const won = await db.bet.groupBy({
    by: ["accountId"],
    where: { createdAt: window, status: "won", accountId: { not: null } },
    _count: { _all: true },
    _sum: { payoutCents: true },
  });
  const wonByAcc = new Map(won.map((w) => [w.accountId!, w]));

  const ids = settled.map((s) => s.accountId!);
  if (ids.length === 0) return [];
  const accounts = await db.account.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      telegramId: true,
      displayName: true,
      tgUsername: true,
      balanceCents: true,
      createdAt: true,
    },
  });
  const accById = new Map(accounts.map((a) => [a.id, a]));

  const rows: SnapshotRow[] = [];
  for (const s of settled) {
    const bets = s._count._all;
    if (bets < SNAPSHOT_MIN_BETS) continue; /* отсев: недостаточно игры */
    const acc = accById.get(s.accountId!);
    if (!acc) continue;
    const w = wonByAcc.get(acc.id);
    const staked = s._sum.amountCents ?? 0;
    const paid = w?._sum.payoutCents ?? 0;
    rows.push({
      userId: acc.id,
      telegramId: acc.telegramId ?? "",
      displayName: acc.displayName || (acc.tgUsername ? `@${acc.tgUsername}` : ""),
      eye: acc.balanceCents,
      score: paid - staked,
      bets,
      correct: w?._count._all ?? 0,
      weight: Math.round(acc.balanceCents * Math.min(1, bets / SNAPSHOT_BETS_NORM)),
    });
  }
  /* сильнее — выше: вес убывает, при равенстве раньше созданный */
  rows.sort((a, b) => b.weight - a.weight || a.userId.localeCompare(b.userId));
  return rows;
}

/** CSV снапшота (артефакт для партнёров). */
export function snapshotCsv(rows: SnapshotRow[]): string {
  const head = "userId,telegramId,eye,score,bets,correct,weight,displayName";
  const body = rows
    .map((r) =>
      [
        r.userId,
        r.telegramId,
        r.eye,
        r.score,
        r.bets,
        r.correct,
        r.weight,
        r.displayName.replace(/[\r\n,"]/g, " ").trim(),
      ]
        .map((v) => `"${String(v)}"`)
        .join(",")
    )
    .join("\n");
  return `${head}\n${body}\n`;
}
