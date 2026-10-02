import { db } from "@/lib/db";
import { truthOf, labelCommitOf } from "@/lib/clips";
import { BET } from "./config";
import { trackEvent } from "./events";
import { applyLedger, ECON, streakBonusFor } from "@/lib/account";
import { betWeightMilli, decayMilliFor } from "@/lib/nr";
import { winStreakOf } from "./stats";
import { ensureActiveSeason } from "@/lib/season";

/**
 * Ядро ставок REAL/SYNTH (v14 — ТЗ «Клипы»/«Авторезолв»). Пари-мьютюэль:
 *
 *   total  = poolReal + poolSynth            (только активные ставки)
 *   rake   = floor(total × RAKE_PCT)         платформе
 *   prize  = total − rake                    победившему пулу
 *   payoutᵢ = floor(prize × amountᵢ / winPool)
 *   Остатки (dust от floor) остаются платформе.
 *
 * ИНВАРИАНТЫ (v14):
 *  - метка клипа живёт ТОЛЬКО в таблице clips (server-only; RLS закрывает
 *    колонку label, клиент видит label_commit и раскрытие после резолва);
 *  - ЦИКЛ ИГРЫ ведёт планировщик: нет live — самый старый queued получает
 *    окно BET_WINDOW_SEC; по closes_at ОДНА транзакция: метка, банк, вес,
 *    reveal. Повтор идемпотентен. Ставок нет — резолв всё равно есть.
 *  - ручной override — ТОЛЬКО на void (метку вручную не ставим);
 *  - битая ссылка — void, ставки назад, метка не раскрывается;
 *  - «процент — не с выигрыша в очках»: рейк-доля рефереров УДАЛЕНА,
 *    реферерские деньги живут только в кассе (20% с пачек в USDT);
 *  - каждая денежная операция логируется [money-op][bet].
 */

export type BetSide = "real" | "synth";
export const SIDES: readonly BetSide[] = ["real", "synth"];

export class BetError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

function moneyLog(event: string, fields: Record<string, unknown>) {
  console.log(`[money-op][bet] ${event}`, JSON.stringify(fields));
}

/* ------------------------------------------------------------------ */
/*  Раунды                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Планировщик игры (v14): queued → live → resolved                    */
/* ------------------------------------------------------------------ */

/** живая проба видео: битая ссылка → void (ставки назад, метка не раскрывается) */
export async function checkVideoAlive(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

/**
 * Планировщик: если НЕТ live-раунда — берёт самый старый queued клип,
 * атомарно переводит queued → live (гонка двух процессов гасится guard'ом
 * по статусу) и открывает окно BET_WINDOW_SEC.
 * Битая ссылка → клип сразу void (ставок ещё нет — возвращать нечего) и
 * берём следующий; максимум 5 попыток за вызов.
 */
export async function promoteNextClip(): Promise<{ promoted: boolean; clipId: string | null }> {
  const now = new Date();
  const live = await db.round.findFirst({
    where: { status: "open", closesAt: { gt: now } },
    select: { id: true },
  });
  if (live) return { promoted: false, clipId: null };

  for (let attempt = 0; attempt < 5; attempt++) {
    const next = await db.clip.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
    });
    if (!next) return { promoted: false, clipId: null };

    /* битая ссылка → void до открытия окна (ставок нет) */
    const healthy = await checkVideoAlive(next.videoUrl);
    if (!healthy) {
      console.warn("[money-op][bet] clip_void_dead_link", JSON.stringify({ clip: next.id }));
      await db.clip.updateMany({
        where: { id: next.id, status: "queued" },
        data: { status: "void", resolvedAt: new Date() },
      });
      continue;
    }

    /* атомарный захват: ровно один процесс переводит queued → live */
    const closesAt = new Date(now.getTime() + BET.windowSec * 1000);
    const claimed = await db.clip.updateMany({
      where: { id: next.id, status: "queued" },
      data: { status: "live", opensAt: now, closesAt },
    });
    if (!claimed.count) continue;

    /* v13 (перенос): Daily Challenge — раунд клипа дня рождается с флагом */
    const today = now.toISOString().slice(0, 10);
    const isDaily = await db.dailyChallenge
      .findUnique({ where: { day: today }, select: { clipCode: true } })
      .then((d) => d?.clipCode === next.id)
      .catch(() => false);

    await db.round.create({
      data: {
        clipCode: next.id,
        opensAt: now,
        closesAt,
        status: "open",
        challenge: isDaily,
      },
    });
    moneyLog("clip_promoted", {
      clip: next.id,
      roundId: next.id,
      windowSec: BET.windowSec,
      closesAt: closesAt.toISOString(),
    });
    return { promoted: true, clipId: next.id };
  }
  return { promoted: false, clipId: null };
}

/**
 * Тик игры: резолв просроченных + (если нет live) продвижение очереди.
 * Вызывается лениво из каждого запроса игры и внешним кроном /api/cron/tick.
 */
export async function tickGame(): Promise<{ resolved: number; promoted: boolean; clipId: string | null }> {
  const resolved = await resolveExpiredRounds(10);
  const p = await promoteNextClip();
  return { resolved, promoted: p.promoted, clipId: p.clipId };
}

export interface RoundBetView {
  side: BetSide;
  amountCents: number;
  status: string;
  payoutCents: number | null;
}

export interface RoundView {
  id: string;
  clipCode: string;
  status: "open" | "locked" | "resolved" | "void";
  opensAt: string;
  closesAt: string;
  serverNow: string;
  windowSec: number;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  /** v13: Daily Challenge раунда дня — бейдж + бонус победителям */
  challenge?: boolean;
  myBet: RoundBetView | null;
  /** v14: label_commit публичен ВСЕГДА (это commit, не метка) */
  labelCommit?: string;
  /** только после резолва — до этого метка не покидает сервер */
  resolvedAs?: BetSide;
  /** v14: сервер сверил sha256(label:id:pepper) с label_commit (карточка) */
  hashMatched?: boolean;
  /** v14: секунда верного колла (своя — для карточки результата) */
  myBetSec?: number | null;
  /** v14: самая ранняя секунда верного колла в раунде */
  firstCorrectSec?: number | null;
  myResult?: "won" | "lost" | null;
  myPayoutCents?: number | null;
  rakeCents?: number;
}

/** клиентский срез раунда: никаких truth до резолва */
export function roundView(
  round: {
    id: string;
    clipCode: string;
    status: string;
    opensAt: Date;
    closesAt: Date;
    poolRealCents: number;
    poolSynthCents: number;
    challenge?: boolean;
    resolvedAs: string | null;
    rakeCents: number | null;
  },
  myBet?: {
    side: string;
    amountCents: number;
    status: string;
    payoutCents: number | null;
    betSec?: number | null;
  } | null,
  labelCommit?: string | null,
  firstCorrectSec?: number | null,
  hashMatched?: boolean
): RoundView {
  const resolved = round.status === "resolved";
  const view: RoundView = {
    id: round.id,
    clipCode: round.clipCode,
    status: round.status as RoundView["status"],
    opensAt: round.opensAt.toISOString(),
    closesAt: round.closesAt.toISOString(),
    serverNow: new Date().toISOString(),
    windowSec: BET.windowSec,
    poolRealCents: round.poolRealCents,
    poolSynthCents: round.poolSynthCents,
    poolTotalCents: round.poolRealCents + round.poolSynthCents,
    challenge: round.challenge ?? false,
    myBet: myBet
      ? {
          side: myBet.side as BetSide,
          amountCents: myBet.amountCents,
          status: myBet.status,
          payoutCents: myBet.payoutCents,
        }
      : null,
  };
  if (resolved && round.resolvedAs) {
    view.resolvedAs = round.resolvedAs as BetSide;
    view.rakeCents = round.rakeCents ?? 0;
    if (myBet && (myBet.status === "won" || myBet.status === "lost")) {
      view.myResult = myBet.status === "won" ? "won" : "lost";
      view.myPayoutCents = myBet.payoutCents ?? 0;
      view.myBetSec = myBet.betSec ?? null;
    }
    if (firstCorrectSec != null) view.firstCorrectSec = firstCorrectSec;
    if (hashMatched != null) view.hashMatched = hashMatched;
  }
  if (labelCommit) view.labelCommit = labelCommit;
  return view;
}

/* ------------------------------------------------------------------ */
/*  Ставка                                                             */
/* ------------------------------------------------------------------ */

export interface PlaceBetInput {
  roundId: string;
  side: unknown;
  amountCents: unknown;
  bettorId: string;
  fingerprint: string;
  refCode?: string | null;
  /** кошелёк из сессии (v5): заполняется всегда, когда игрок подключён —
     нужна Best Eyes Leaderboard */
  wallet?: string | null;
}

export interface PlaceBetResult {
  betId: string;
  status: "active" | "pending";
  mode: "demo" | "crypto" | "balance";
  payUrl?: string;
  balanceCents?: number;
}

/**
 * v6 — ставка с внутреннего баланса (источник истины — LedgerTxn).
 * Списание атомарно внутри транзакции создания ставки: нет денег →
 * insufficient_balance (402) и никакого следа в пуле. Ставка активна
 * мгновенно — депонирование уже случилось ранее (крипто-инвойс → webhook).
 */
export async function placeBetBalance(input: {
  roundId: string;
  side: unknown;
  amountCents: unknown;
  bettorId: string;
  accountId: string;
  fingerprint: string;
  refCode?: string | null;
  wallet?: string | null;
}): Promise<PlaceBetResult> {
  const side = input.side === "real" || input.side === "synth" ? input.side : null;
  if (!side) throw new BetError("side must be real|synth", 400, "bad_side");

  const amount = Number(input.amountCents);
  if (!Number.isInteger(amount) || amount < BET.minBetCents || amount > BET.maxBetCents) {
    throw new BetError(
      `amount_cents must be ${BET.minBetCents}..${BET.maxBetCents}`,
      400,
      "bad_amount"
    );
  }

  const round = await db.round.findUnique({ where: { id: input.roundId } });
  if (!round) throw new BetError("round not found", 404, "round_not_found");
  if (!truthOf(round.clipCode)) {
    throw new BetError("clip is not bettable", 409, "not_bettable");
  }
  if (round.status !== "open" || round.closesAt.getTime() <= Date.now()) {
    throw new BetError("round is closed", 409, "round_closed");
  }

  /* анти-фрод: одна ставка на раунд с одного bettorId/fingerprint */
  const dupBettor = await db.bet.findFirst({
    where: {
      roundId: round.id,
      bettorId: input.bettorId,
      status: { in: ["pending", "active", "won", "lost"] },
    },
    select: { id: true },
  });
  if (dupBettor) {
    throw new BetError("already bet this round", 409, "already_bet");
  }
  const dupFp = await db.bet.findFirst({
    where: {
      roundId: round.id,
      fingerprint: input.fingerprint,
      status: { in: ["pending", "active"] },
    },
    select: { id: true },
  });
  if (dupFp) {
    throw new BetError("fingerprint already active this round", 409, "fingerprint_bet");
  }

  const wallet =
    typeof input.wallet === "string" && input.wallet.length >= 20
      ? input.wallet.toLowerCase().slice(0, 64)
      : null;

  const { bet, balanceCents } = await db.$transaction(async (tx) => {
    const b = await tx.bet.create({
      data: {
        roundId: round.id,
        clipCode: round.clipCode,
        side,
        amountCents: amount,
        bettorId: input.bettorId,
        accountId: input.accountId,
        fingerprint: input.fingerprint,
        refCode: input.refCode ?? null,
        wallet,
        mode: "balance",
        status: "active",
        /* v14: секунда ставки от opensAt — вход в формулу веса $NR */
        betSec: Math.max(
          0,
          Math.round((Date.now() - round.opensAt.getTime()) / 1000)
        ),
      },
    });
    /* списание с баланса внутри той же транзакции: нет денег → откат всего */
    const debited = await applyLedger(
      input.accountId,
      -amount,
      "bet_stake",
      `bet:${b.id}`,
      { betId: b.id, clip: round.clipCode, side },
      tx
    );
    if (!debited) {
      throw new BetError("not enough balance", 402, "insufficient_balance");
    }
    await tx.round.update({
      where: { id: round.id },
      data:
        side === "real"
          ? { poolRealCents: { increment: amount } }
          : { poolSynthCents: { increment: amount } },
    });
    const acc = await tx.account.findUniqueOrThrow({
      where: { id: input.accountId },
      select: { balanceCents: true },
    });
    return { bet: b, balanceCents: acc.balanceCents };
  });

  moneyLog("bet_placed_balance", {
    betId: bet.id,
    roundId: round.id,
    clip: round.clipCode,
    side,
    amountCents: amount,
    balanceCents,
    ref: input.refCode ?? null,
  });
  void trackEvent("bet_placed", {
    clipCode: round.clipCode,
    visitorHash: input.fingerprint,
    meta: { mode: "balance", side, amountCents: amount, ref: input.refCode ?? null },
  });
  if (input.refCode) {
    void trackEvent("ref_converted", {
      clipCode: round.clipCode,
      meta: { ref: input.refCode, betId: bet.id },
    });
  }

  return { betId: bet.id, status: "active", mode: "balance", balanceCents };
}

/**
 * Подтверждение ставки из webhook 2328 (подписанный payload).
 * Если раунд уже resolved — ставка late (возврат, ручной разбор).
 */
export async function confirmBetPayment(paymentUuid: string, orderId: string) {
  const bet = await db.bet.findFirst({
    where: { OR: [{ paymentId: paymentUuid }, { orderId }] },
  });
  if (!bet) return null;

  const round = await db.round.findUnique({ where: { id: bet.roundId } });
  if (!round) return bet;

  if (round.status === "resolved" || round.closesAt.getTime() <= Date.now()) {
    const late = await db.bet.updateMany({
      where: { id: bet.id, status: "pending" },
      data: { status: "late" },
    });
    if (late.count) {
      moneyLog("bet_late_payment", { betId: bet.id, roundId: round.id, orderId });
    }
    return bet;
  }

  const moved = await db.$transaction(async (tx) => {
    const m = await tx.bet.updateMany({
      where: { id: bet.id, status: "pending" },
      data: { status: "active" },
    });
    if (m.count) {
      await tx.round.update({
        where: { id: round.id },
        data:
          bet.side === "real"
            ? { poolRealCents: { increment: bet.amountCents } }
            : { poolSynthCents: { increment: bet.amountCents } },
      });
    }
    return m;
  });

  if (moved.count) {
    moneyLog("bet_paid", {
      betId: bet.id,
      roundId: round.id,
      clip: bet.clipCode,
      side: bet.side,
      amountCents: bet.amountCents,
      orderId,
    });
  }
  return bet;
}

/** финальный провал инвойса (cancel/underpaid) */
export async function failBetPayment(paymentUuid: string, orderId: string) {
  const bet = await db.bet.findFirst({
    where: { OR: [{ paymentId: paymentUuid }, { orderId }] },
  });
  if (!bet) return;
  const moved = await db.bet.updateMany({
    where: { id: bet.id, status: "pending" },
    data: { status: "failed" },
  });
  if (moved.count) {
    moneyLog("bet_failed", { betId: bet.id, orderId, reason: "invoice_failed" });
  }
}

/* ------------------------------------------------------------------ */
/*  Резолв                                                             */
/* ------------------------------------------------------------------ */

export interface ResolveSummary {
  roundId: string;
  clipCode: string;
  /** null для void (метка не раскрывается) */
  resolvedAs: BetSide | null;
  totalCents: number;
  rakeCents: number;
  authorShareCents: number;
  winners: number;
  losers: number;
  /** раунд закрылся void (битая ссылка) — метка не раскрывается, ставки назад */
  voided?: boolean;
}

/**
 * Резолв раунда. ОДНА транзакция (ТЗ): метка, банк, вес, reveal.
 * Идемпотентен: гейт — перевод open|locked → locked через updateMany;
 * повторный вызов вернёт null. Вызывать после closesAt (tickGame).
 *
 * v14: ручного вердикта больше НЕТ (override только на void → voidRound).
 * Метка берётся из таблицы clips; вес верных ставок считается по
 * betSec (decay 1 / 0.4 / 0, кеп 50 EYE) и пишется в Bet.weightMilli.
 * Реферерская доля с рейка удалена («процент — не с выигрыша в очках»).
 */
export async function resolveRound(roundId: string): Promise<ResolveSummary | null> {
  const round = await db.round.findUnique({ where: { id: roundId } });
  if (!round || round.status === "resolved" || round.status === "void") return null;
  if (round.closesAt.getTime() > Date.now()) return null; // ещё открыт

  const clip = await db.clip.findUnique({ where: { id: round.clipCode } });
  if (!clip) return null;

  /* битая ссылка → void: ставки назад, метка не раскрывается */
  if (clip.status === "void" || !(await checkVideoAlive(clip.videoUrl))) {
    return voidRound(round.id, "dead_link");
  }

  const truth: BetSide | null =
    clip.label === "real" ? "real" : clip.label === "synth" ? "synth" : null;
  if (!truth) {
    console.error(
      "[money-op][bet] resolve_blocked_no_label",
      JSON.stringify({ roundId: round.id, clip: round.clipCode })
    );
    return null; // метки нет — разбор вручную (void решит админ)
  }

  /* гейт идемпотентности: ровно один вызов проходит дальше */
  const locked = await db.round.updateMany({
    where: { id: round.id, status: { in: ["open", "locked"] } },
    data: { status: "locked" },
  });
  if (locked.count === 0) return null;

  const bets = await db.bet.findMany({
    where: { roundId: round.id, status: "active" },
  });

  const total = round.poolRealCents + round.poolSynthCents;
  const rake = Math.floor(total * BET.rakePct);
  const prize = total - rake;
  const winPool = truth === "real" ? round.poolRealCents : round.poolSynthCents;

  const season = await ensureActiveSeason().catch(() => null);
  const seasonCode = season?.code ?? "s";

  let paid = 0;
  let winners = 0;
  let losers = 0;
  let weightSumMilli = 0;

  /* ---- v14 FIX: БЕЗ длинной интерактивной транзакции ----
     Supavisor (transaction mode :6543) перевыдаёт server-коннект, если
     транзакция живёт дольше idle-окна (каждый запрос к Supabase в dev —
     3–6с; транзакция на 15–20 запросов = «Transaction not found» и
     застрявший locked-раунд). Каждый шаг ниже АТОМАРЕН и ИДЕМПОТЕНТЕН
     сам по себе, гейт round=locked гарантирует единственного
     исполнителя, а повторный тик дотягивает недописанное:
       • bet.updateMany (id, status=active) — второй прогон видит 0 строк;
       • applyLedger — refKey unique (дубль не запишется);
       • round.update (status in open|locked → resolved) — гейт;
       • clip.updateMany (status in live|queued → resolved) — гейт. */
  for (const b of bets) {
    const won = b.side === truth;
    const payout = won && winPool > 0 ? Math.floor((prize * b.amountCents) / winPool) : 0;
    paid += payout;
    if (won) winners++;
    else losers++;

    /* вес верной ставки: betSec от opensAt, кеп 50 EYE, decay 1/0.4/0 */
    const betSec =
      b.betSec ??
      Math.max(
        0,
        Math.round((b.createdAt.getTime() - round.opensAt.getTime()) / 1000)
      );
    const wMilli = won ? betWeightMilli(b.amountCents, betSec, BET.windowSec) : 0;
    if (won) weightSumMilli += wMilli;

    await db.bet.updateMany({
      where: { id: b.id, status: "active" },
      data: {
        status: won ? "won" : "lost",
        payoutCents: payout,
        betSec,
        weightMilli: wMilli,
        decayMilli: won ? decayMilliFor(betSec, BET.windowSec) : 0,
      },
    });

    /* выигрыш balance-ставки на внутренний баланс (идемпотентно betpay:<id>) */
    if (won && b.mode === "balance" && b.accountId && payout > 0) {
      const credited = await applyLedger(
        b.accountId,
        payout,
        "bet_payout",
        `betpay:${b.id}`,
        { betId: b.id, roundId: round.id, clip: round.clipCode }
      );
      if (credited) {
        moneyLog("bet_payout_balance", {
          betId: b.id,
          accountId: b.accountId,
          payoutCents: payout,
        });
      }
    }

    /* v8: награда за УГАДЫВАНИЕ (идемпотентно guess:<betId>) */
    if (won && ECON.guessRewardCents > 0 && b.accountId) {
      const g = await applyLedger(
        b.accountId,
        ECON.guessRewardCents,
        "guess_reward",
        `guess:${b.id}`,
        { betId: b.id, roundId: round.id, clip: round.clipCode, side: b.side }
      );
      if (g) {
        moneyLog("guess_reward", { betId: b.id, accountId: b.accountId, cents: ECON.guessRewardCents });
      }
    }

    /* v13: Daily Challenge — бонус победителям раунда дня (dcb:<betId>) */
    if (won && round.challenge && ECON.dailyChallengeBonusCents > 0 && b.accountId) {
      const dcb = await applyLedger(
        b.accountId,
        ECON.dailyChallengeBonusCents,
        "daily_challenge_bonus",
        `dcb:${b.id}`,
        { betId: b.id, roundId: round.id, clip: round.clipCode }
      );
      if (dcb) {
        moneyLog("daily_challenge_bonus", { betId: b.id, accountId: b.accountId, cents: ECON.dailyChallengeBonusCents });
      }
    }

    /* v13: вехи серии верных коллов 3/5/7/10 (раз за сезон на веху) */
    if (won && b.accountId) {
      const streak = await winStreakOf(b.accountId).catch(() => 0);
      const bonus = streakBonusFor(streak);
      if (bonus > 0 && season) {
        const sb = await applyLedger(
          b.accountId,
          bonus,
          "streak_bonus",
          `streak:${streak}:${seasonCode}:${b.accountId}`,
          { betId: b.id, roundId: round.id, streak }
        );
        if (sb) {
          moneyLog("streak_bonus", { betId: b.id, accountId: b.accountId, streak, cents: bonus });
        }
      }
    }

    void trackEvent(won ? "bet_won" : "bet_lost", {
      clipCode: round.clipCode,
      visitorHash: b.fingerprint,
      meta: { betId: b.id, side: b.side, amountCents: b.amountCents, payoutCents: payout },
    });
  }

  const authorShare = Math.floor(rake * BET.authorShareOfRake);

  /* reveal: раунд resolved + клип resolved (метка/хеш открываются) */
  await db.round.updateMany({
    where: { id: round.id, status: { in: ["open", "locked"] } },
    data: {
      status: "resolved",
      resolvedAs: truth,
      rakeCents: rake,
      authorShareCents: authorShare,
      refShareCents: 0, // v14: реферерских денег из рейка больше нет
      resolvedAt: new Date(),
    },
  });
  await db.clip.updateMany({
    where: { id: round.clipCode, status: { in: ["live", "queued"] } },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  moneyLog("round_resolved", {
    roundId: round.id,
    clip: round.clipCode,
    resolvedAs: truth,
    totalCents: total,
    rakeCents: rake,
    authorShareCents: authorShare,
    prizePaidCents: paid,
    dustCents: prize - paid,
    winners,
    losers,
    bets: bets.length,
    weightMilli: weightSumMilli,
  });

  return {
    roundId: round.id,
    clipCode: round.clipCode,
    resolvedAs: truth,
    totalCents: total,
    rakeCents: rake,
    authorShareCents: Math.floor(rake * BET.authorShareOfRake),
    winners,
    losers,
  };
}

/**
 * Ручной override — ТОЛЬКО на void (ТЗ): метка не раскрывается, активные
 * ставки возвращаются (balance — ledger refund, demo — статус void),
 * идемпотентен (гейт open|locked → void).
 */
export async function voidRound(
  roundId: string,
  reason: string
): Promise<ResolveSummary | null> {
  const round = await db.round.findUnique({ where: { id: roundId } });
  if (!round || round.status === "resolved" || round.status === "void") return null;

  const gated = await db.round.updateMany({
    where: { id: round.id, status: { in: ["open", "locked"] } },
    data: { status: "void" },
  });
  if (gated.count === 0) return null;

  const bets = await db.bet.findMany({
    where: { roundId: round.id, status: "active" },
  });

  /* v14 FIX: без интерактивной транзакции (pgbouncer перевыдаёт коннект
     на длинных транзакциях — см. resolveRound). Каждый шаг атомарен и
     идемпотентен: bet.updateMany по status=active, ledger по unique
     refKey `betrefund:<betId>`, клип по status-guard'у. */
  for (const b of bets) {
    const moved = await db.bet.updateMany({
      where: { id: b.id, status: "active" },
      data: { status: "void" },
    });
    if (moved.count && b.mode === "balance" && b.accountId) {
      /* ставки назад: возврат списания ровно тем же суммам */
      const refunded = await applyLedger(
        b.accountId,
        b.amountCents,
        "bet_refund",
        `betrefund:${b.id}`,
        { betId: b.id, roundId: round.id, reason }
      );
      if (refunded) {
        moneyLog("bet_refunded_void", {
          betId: b.id,
          accountId: b.accountId,
          amountCents: b.amountCents,
        });
      }
    }
  }
  await db.clip.updateMany({
    where: { id: round.clipCode, status: { in: ["live", "queued"] } },
    data: { status: "void", resolvedAt: new Date() },
  });
  moneyLog("round_voided", {
    roundId: round.id,
    clip: round.clipCode,
    reason,
    bets: bets.length,
  });

  void trackEvent("round_void", {
    clipCode: round.clipCode,
    meta: { roundId: round.id, reason },
  });

  return {
    roundId: round.id,
    clipCode: round.clipCode,
    resolvedAs: null,
    totalCents: 0,
    rakeCents: 0,
    authorShareCents: 0,
    winners: 0,
    losers: 0,
    voided: true,
  };
}

/** ленивый cron: резолвим всё просроченное; вызывается из tickGame */
export async function resolveExpiredRounds(limit = 8): Promise<number> {
  const expired = await db.round.findMany({
    where: { status: { in: ["open", "locked"] }, closesAt: { lte: new Date() } },
    orderBy: { closesAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let n = 0;
  for (const r of expired) {
    const res = await resolveRound(r.id);
    if (res) n++;
  }
  return n;
}

/**
 * Открытый раунд игры (для UI): live-раунд с его публичным клипом.
 * Раунды создаёт ТОЛЬКО планировщик — ленивого открытия здесь нет.
 */
export async function currentLiveRound() {
  const now = new Date();
  const round = await db.round.findFirst({
    where: { status: "open", closesAt: { gt: now } },
    orderBy: { closesAt: "desc" },
  });
  if (!round) return null;
  const clip = await db.clip.findUnique({ where: { id: round.clipCode } });
  if (!clip) return null;
  return { round, clip };
}

/** подпись раскрытия: label_commit раунда (публичен всегда — это commit) */
export function commitFor(clipId: string, label: string): string {
  return labelCommitOf(clipId, label);
}
