import "server-only";

/**
 * v14 — Раздача $NR (ТЗ §Раздача $NR).
 *
 * Base, фикс-саплай сезона, пресейла нет. Адрес — только на этом домене
 * после снапшота. Клейм merkle, один раз.
 *
 * ВЕС (только у ВЕРНОЙ ставки, тает по окну):
 *   - первые 5 секунд окна  → множитель 1;
 *   - середина окна         → множитель 0.4;
 *   - последние 5 секунд    → множитель 0;
 *   - неверный колл         → 0;
 *   - кеп ставки в весе — 50 EYE.
 *   weight = sum(stake × time_decay) по верным ставкам.
 *
 * ОГРАНИЧЕНИЯ:
 *   - верных раундов < 20        → вес аккаунта 0;
 *   - кеп аккаунта — 2% игровой пачки, выше сгорает;
 *   - раунд без верного колла сжигает свою долю;
 *   - пачки и revshare в вес НЕ входят (инвойс не пишет сезонный вес).
 *
 * ДОЛИ СНАПШОТА: 75% игрокам · 15% авторам клипов (банк к закрытию
 * не дальше 60/40) · 10% в следующий сезон.
 *
 * До клейма публичны ТОЛЬКО ранг и число ранних верных коллов —
 * не число монет.
 */

/** окно, внутри которого множитель ровно 1 (секунды от opensAt) */
export const EARLY_SEC = 5;
/** окно, внутри которого множитель 0 (последние N секунд) */
export const LATE_SEC = 5;
/** множитель середины окна */
export const MID_FACTOR = 0.4;
/** кеп ставки в весе, EYE */
export const STAKE_CAP = 50;
/** минимум верных раундов, иначе вес 0 */
export const MIN_CORRECT_ROUNDS = 20;
/** доля игроков / авторов / следующий сезон */
export const SHARE_PLAYERS = 0.75;
export const SHARE_AUTHORS = 0.15;
export const SHARE_NEXT_SEASON = 0.1;
/** кеп аккаунта от игровой пачки (превышение сгорает) */
export const ACCOUNT_CAP_PCT = 0.02;
/** доля банка раунда, дальше которой автор не получает долю (60/40) */
export const AUTHOR_MAX_IMBALANCE = 0.6;

/** фикс-саплай сезона (env NR_SEASON_SUPPLY перекрывает) */
export function seasonSupply(): number {
  const v = Number(process.env.NR_SEASON_SUPPLY);
  return Number.isFinite(v) && v >= 1000 ? Math.round(v) : 1_000_000;
}

/**
 * time_decay в тысячных (int, чтобы без float-дрожи):
 *   betSec < EARLY_SEC                → 1000
 *   betSec > windowSec - LATE_SEC     → 0     (последний колл = ноль)
 *   иначе                             → 400
 */
export function decayMilliFor(betSec: number, windowSec: number): number {
  if (!Number.isFinite(betSec) || betSec < 0) return 0;
  if (betSec < EARLY_SEC) return 1000;
  if (betSec > windowSec - LATE_SEC) return 0;
  return Math.round(MID_FACTOR * 1000);
}

/** вес одной верной ставки в милли-EYE: min(stake, STAKE_CAP) × decay */
export function betWeightMilli(stakeCents: number, betSec: number, windowSec: number): number {
  const capped = Math.min(Math.max(Math.round(stakeCents), 0), STAKE_CAP);
  return capped * decayMilliFor(betSec, windowSec);
}

export interface PlayerWeight {
  accountId: string;
  correctRounds: number;
  /** верных коллов, сделанных в первые 5 секунд (публичная цифра) */
  earlyCorrect: number;
  /** сумма betWeightMilli по верным ставкам, EYE (int через милли) */
  weightMilli: number;
  /* ---- v20 — крючковые множители (ТЗ §3: вес зависит от активности,
         стриков, рефералов и winrate). Опциональны: снапшот их доставляет. */
  /** эффективный daily-стрик (сгорает без входа; щит спасает) */
  streakDays?: number;
  /** активированные рефералы (сделавшие первую ставку) */
  activatedRefs?: number;
  /** winrate в процентах 0..100 (won/(won+lost)) */
  winratePct?: number;
}

/* ---- v20 — параметры крючковых множителей (env перекрывает) ---- */
function pctNum(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : def;
}
export const HOOK_MULT = {
  /** +1% веса за каждый день daily-стрика, максимум 30 дней */
  streakStep: pctNum("HOOK_STREAK_STEP", 0.01),
  streakCapDays: 30,
  /** +0.4% веса за каждого активированного реферала, максимум 50 */
  refStep: pctNum("HOOK_REF_STEP", 0.004),
  refCap: 50,
  /** +0.5% веса за каждый % winrate выше 50, максимум +25% */
  winrateStep: pctNum("HOOK_WINRATE_STEP", 0.005),
  winrateBasePct: 50,
  /** суммарный потолок множителя */
  totalCap: 2.0,
} as const;

/** суммарный крючковый множитель (1.0..HOOK_MULT.totalCap) */
export function hookMultiplierOf(p: Pick<PlayerWeight, "streakDays" | "activatedRefs" | "winratePct">): number {
  const streakMult =
    1 + Math.min(Math.max(p.streakDays ?? 0, 0), HOOK_MULT.streakCapDays) * HOOK_MULT.streakStep;
  const refMult =
    1 + Math.min(Math.max(p.activatedRefs ?? 0, 0), HOOK_MULT.refCap) * HOOK_MULT.refStep;
  const wr = Math.min(Math.max(p.winratePct ?? 0, 0), 100);
  const wrMult =
    1 + Math.max(0, wr - HOOK_MULT.winrateBasePct) * HOOK_MULT.winrateStep;
  return Math.min(streakMult * refMult * wrMult, HOOK_MULT.totalCap);
}

/**
 * Итоговый вес игрока: ноль при < MIN_CORRECT_ROUNDS верных раундов.
 * Ввод — агрегаты по won-ставкам сезона. v20: умножается на крючковый
 * множитель (стрики/рефералы/winrate — ТЗ §3), потолок ×2.0.
 */
export function finalWeightMilli(p: PlayerWeight): number {
  if (p.correctRounds < MIN_CORRECT_ROUNDS) return 0;
  const mult =
    p.streakDays === undefined && p.activatedRefs === undefined && p.winratePct === undefined
      ? 1
      : hookMultiplierOf(p);
  return Math.max(0, Math.round(p.weightMilli * mult));
}

export interface SnapshotParams {
  supply: number;
  gamePack: number;
  authorsPack: number;
  nextSeasonCarry: number;
  accountCap: number;
}

/** параметры сезона: 75/15/10 + кеп аккаунта 2% игровой пачки */
export function snapshotParams(supply = seasonSupply()): SnapshotParams {
  const gamePack = Math.floor(supply * SHARE_PLAYERS);
  return {
    supply,
    gamePack,
    authorsPack: Math.floor(supply * SHARE_AUTHORS),
    nextSeasonCarry: supply - gamePack - Math.floor(supply * SHARE_AUTHORS),
    accountCap: Math.floor(gamePack * ACCOUNT_CAP_PCT),
  };
}

/**
 * Распределение игровой пачки по весу. Возвращает сумму $NR на аккаунт
 * (уже с кепом 2%; всё, что выше кепа, сгорает — «выше сгорает»).
 * weightMilli < MIN_CORRECT_ROUNDS-правило уже применено (finalWeightMilli).
 */
export function distributeGamePack(
  players: Array<PlayerWeight & { finalMilli: number }>,
  gamePack: number,
  accountCap: number
): Map<string, number> {
  const total = players.reduce((s, p) => s + p.finalMilli, 0);
  const out = new Map<string, number>();
  if (total <= 0) return out;
  for (const p of players) {
    const raw = Math.floor(gamePack * (p.finalMilli / total));
    out.set(p.accountId, Math.min(raw, accountCap));
  }
  return out;
}

/**
 * Правило авторов: банк к закрытию «не дальше 60/40» — меньшая сторона
 * ≥ 40% общего банка. Раунды без верного колла (void/пустые) долю авторов
 * не дают — их банк сгорает.
 */
export function authorQualifies(poolReal: number, poolSynth: number): boolean {
  const total = poolReal + poolSynth;
  if (total <= 0) return false;
  const min = Math.min(poolReal, poolSynth);
  return min / total >= 1 - AUTHOR_MAX_IMBALANCE;
}
