import "server-only";

import { db } from "@/lib/db";
import { trackEvent } from "@/lib/bet/events";

/**
 * v20 — бейджи игрока (ТЗ §Бейджи): автоматическая выдача по триггерам.
 * Идемпотентность — unique(accountId, code): повторный awardBadge — no-op.
 *
 * Каталог (code → метаданные для UI):
 *   first_win    — первая победа (won-ставка с payout>0)
 *   winstreak_3/5/7/10 — серии верных коллов
 *   refs_3/10/25/50    — пригласил N активных друзей (первая ставка друга)
 *   early_bird   — Season 1, первые 1000 аккаунтов
 *   top_season   — топ-10 веса сезона (снапшот)
 *   god_eye      — №1 веса сезона (снапшот)
 *   pumpkin      — косметика из шопа за EYE
 */

export type BadgeCode =
  | "first_win"
  | "winstreak_3"
  | "winstreak_5"
  | "winstreak_7"
  | "winstreak_10"
  | "refs_3"
  | "refs_10"
  | "refs_25"
  | "refs_50"
  | "early_bird"
  | "top_season"
  | "god_eye"
  | "pumpkin";

export interface BadgeMeta {
  label: string;
  hint: string;
  /** показывать в лидерборде рядом с именем */
  leaderboard: boolean;
  icon: string;
}

export const BADGE_CATALOG: Record<BadgeCode, BadgeMeta> = {
  first_win: { label: "first blood", hint: "first correct call — the bank paid you", leaderboard: true, icon: "🩸" },
  winstreak_3: { label: "triple eye", hint: "3 correct calls in a row", leaderboard: true, icon: "👁" },
  winstreak_5: { label: "seer", hint: "5 correct calls in a row", leaderboard: true, icon: "🔮" },
  winstreak_7: { label: "oracle", hint: "7 correct calls in a row", leaderboard: true, icon: "⚡" },
  winstreak_10: { label: "god eye", hint: "10 correct calls in a row", leaderboard: true, icon: "🌟" },
  refs_3: { label: "recruiter", hint: "3 friends made their first bet", leaderboard: false, icon: "🕸" },
  refs_10: { label: "cult leader", hint: "10 friends made their first bet", leaderboard: true, icon: "🎭" },
  refs_25: { label: "puppet master", hint: "25 friends made their first bet", leaderboard: true, icon: "🧿" },
  refs_50: { label: "the swarm", hint: "50 friends made their first bet", leaderboard: true, icon: "🦇" },
  early_bird: { label: "early bird", hint: "season 1 — first 1000 accounts", leaderboard: true, icon: "🐦" },
  top_season: { label: "top of season", hint: "top-10 season weight", leaderboard: true, icon: "🏆" },
  god_eye: { label: "god eye", hint: "#1 season weight — the eye of gods", leaderboard: true, icon: "👑" },
  pumpkin: { label: "pumpkin", hint: "halloween cosmetic — from the EYE shop", leaderboard: true, icon: "🎃" },
};

export function badgeMetaOf(code: string): BadgeMeta | null {
  return (BADGE_CATALOG as Record<string, BadgeMeta>)[code] ?? null;
}

/**
 * Выдача бейджа (идемпотентно). Возвращает true, если бейдж выдан сейчас.
 * Никогда не бросает: бейдж — побочный эффект, не критический путь
 * (ставка/резолв не должны падать из-за косметики).
 */
export async function awardBadge(
  accountId: string,
  code: BadgeCode,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const created = await db.badge.create({
      data: { accountId, code, meta: JSON.stringify(meta).slice(0, 500) },
    });
    void trackEvent("badge_awarded", { meta: { code, accountId: accountId.slice(0, 8) } });
    console.log(`[badges] awarded ${code} → ${accountId.slice(0, 8)} (${created.id.slice(0, 8)})`);
    return true;
  } catch {
    /* unique conflict = уже выдан; БД недоступна = пропускаем */
    return false;
  }
}

/** все бейджи аккаунта (коды + когда выданы) */
export async function badgesOf(accountId: string): Promise<Array<{ code: string; awardedAt: Date }>> {
  try {
    const rows = await db.badge.findMany({
      where: { accountId },
      select: { code: true, awardedAt: true },
      orderBy: { awardedAt: "desc" },
    });
    return rows;
  } catch {
    return [];
  }
}

/** милстоуны рефералки: сколько друзей АКТИВИРОВАНО → какой бейдж выдать */
export const REF_BADGE_MILESTONES: Array<{ at: number; code: BadgeCode }> = [
  { at: 3, code: "refs_3" },
  { at: 10, code: "refs_10" },
  { at: 25, code: "refs_25" },
  { at: 50, code: "refs_50" },
];

/** вехи вин-стрика → бейджи */
export const WINSTREAK_BADGE_MILESTONES: Array<{ at: number; code: BadgeCode }> = [
  { at: 3, code: "winstreak_3" },
  { at: 5, code: "winstreak_5" },
  { at: 7, code: "winstreak_7" },
  { at: 10, code: "winstreak_10" },
];

/** всего аккаунтов (для окна Early Bird) */
export async function countAccounts(): Promise<number> {
  return db.account.count();
}

/**
 * Сезонные бейджи (god_eye/top_season) — вызывает построитель снапшота:
 * rank 1 → god_eye, rank ≤10 → top_season (идемпотентно по unique).
 */
export async function awardSeasonBadges(
  ranked: Array<{ accountId: string; rank: number }>
): Promise<number> {
  let n = 0;
  for (const p of ranked) {
    if (p.rank === 1 && (await awardBadge(p.accountId, "god_eye", { rank: 1 }))) n++;
    else if (p.rank <= 10 && (await awardBadge(p.accountId, "top_season", { rank: p.rank }))) n++;
  }
  return n;
}
