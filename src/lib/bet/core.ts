import { db } from "@/lib/db";
import { getPostByCode } from "@/lib/csv";
import { BET, betDemoEnabled } from "./config";
import { trackEvent } from "./events";
import { is2328PaymentConfigured, create2328Payment } from "@/lib/2328/payment";

/**
 * Ядро ставок REAL/SYNTH (ТЗ v2 §4.1–4.3). Пари-мьютюэль:
 *
 *   total  = poolReal + poolSynth            (только активные ставки)
 *   rake   = floor(total × RAKE_PCT)         платформе
 *   prize  = total − rake                    победившему пулу
 *   payoutᵢ = floor(prize × amountᵢ / winPool)
 *   authorShare = floor(rake × AUTHOR_SHARE_OF_RAKE)
 *   refCutᵢ     = floor(rake × REF_RATE_PCT × amountᵢ/total)  → по refCode
 *   Остатки (dust от floor) остаются платформе.
 *
 * ИНВАРИАНТЫ:
 *  - truth клипа живёт ТОЛЬКО в posts.csv (сервер); до резолва она не
 *    возвращается ни одним API и не лежит в RSC-пейлоаде;
 *  - резолв идемпотентен: гейт updateMany open|locked → resolved;
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

/** кураторский вердикт клипа (server-only, из CSV) */
export function truthOf(clipCode: string): BetSide | undefined {
  const t = getPostByCode(clipCode)?.truth;
  return t === "real" || t === "synth" ? t : undefined;
}

/* ------------------------------------------------------------------ */
/*  Раунды                                                             */
/* ------------------------------------------------------------------ */

/**
 * Открытый раунд клипа: берём живой (closesAt в будущем), иначе создаём новый.
 * Один клип = много раундов за жизнь («шов есть — иди снова»).
 * Гонка двух параллельных create даёт второй раунд, который просто останется
 * незанятым — не деньги, не страшно.
 */
export async function ensureOpenRound(clipCode: string) {
  if (!truthOf(clipCode)) {
    throw new BetError("clip is not bettable", 404, "not_bettable");
  }
  const now = new Date();
  const live = await db.round.findFirst({
    where: { clipCode, status: "open", closesAt: { gt: now } },
    orderBy: { closesAt: "desc" },
  });
  if (live) return live;

  return db.round.create({
    data: {
      clipCode,
      opensAt: now,
      closesAt: new Date(now.getTime() + BET.windowSec * 1000),
      status: "open",
    },
  });
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
  status: "open" | "locked" | "resolved";
  opensAt: string;
  closesAt: string;
  serverNow: string;
  windowSec: number;
  poolRealCents: number;
  poolSynthCents: number;
  poolTotalCents: number;
  myBet: RoundBetView | null;
  /** только после резолва — до этого truth не покидает сервер */
  resolvedAs?: BetSide;
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
    resolvedAs: string | null;
    rakeCents: number | null;
  },
  myBet?: {
    side: string;
    amountCents: number;
    status: string;
    payoutCents: number | null;
  } | null
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
    }
  }
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
}

export interface PlaceBetResult {
  betId: string;
  status: "active" | "pending";
  mode: "demo" | "crypto";
  payUrl?: string;
}

/**
 * Ставка: демо — мгновенно активна и в пуле; crypto — инвойс 2328.io,
 * в пуле появится только после подписанного webhook'а.
 */
export async function placeBet(input: PlaceBetInput): Promise<PlaceBetResult> {
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

  /* анти-фрод (§4.3.9): одна ставка на раунд с одного bettorId
     (пока она не failed) и одна активная с одного fingerprint */
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

  const cryptoReady = is2328PaymentConfigured();
  const useCrypto = cryptoReady && !betDemoEnabled();

  if (!useCrypto) {
    /* ---- demo: сразу активна, пул растёт транзакционно ---- */
    const bet = await db.$transaction(async (tx) => {
      const b = await tx.bet.create({
        data: {
          roundId: round.id,
          clipCode: round.clipCode,
          side,
          amountCents: amount,
          bettorId: input.bettorId,
          fingerprint: input.fingerprint,
          refCode: input.refCode ?? null,
          mode: "demo",
          status: "active",
        },
      });
      await tx.round.update({
        where: { id: round.id },
        data:
          side === "real"
            ? { poolRealCents: { increment: amount } }
            : { poolSynthCents: { increment: amount } },
      });
      return b;
    });

    moneyLog("bet_placed_demo", {
      betId: bet.id,
      roundId: round.id,
      clip: round.clipCode,
      side,
      amountCents: amount,
      ref: input.refCode ?? null,
    });
    void trackEvent("bet_placed", {
      clipCode: round.clipCode,
      visitorHash: input.fingerprint,
      meta: { mode: "demo", side, amountCents: amount, ref: input.refCode ?? null },
    });
    if (input.refCode) {
      void trackEvent("ref_converted", {
        clipCode: round.clipCode,
        meta: { ref: input.refCode, betId: bet.id },
      });
    }
    return { betId: bet.id, status: "active", mode: "demo" };
  }

  /* ---- crypto: инвойс 2328.io, ставка ждёт webhook ---- */
  const bet = await db.bet.create({
    data: {
      roundId: round.id,
      clipCode: round.clipCode,
      side,
      amountCents: amount,
      bettorId: input.bettorId,
      fingerprint: input.fingerprint,
      refCode: input.refCode ?? null,
      mode: "crypto",
      status: "pending",
    },
  });

  /* атрибуция в orderId (§4.3.3): rb-<betId>[-<ref>] — переживает падение БД */
  const refSuffix = input.refCode ? `-${input.refCode}` : "";
  const orderId = `rb-${bet.id}${refSuffix}`;
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://no-reality.fun";
  let payUrl = "";
  try {
    const inv = await create2328Payment({
      amountUsdt: (amount / 100).toFixed(2),
      orderId,
      urlCallback: `${base}/api/webhooks/2328`,
      urlReturn: `${base}/v/${round.clipCode}?bet=1`,
      description: `no reality. bet ${side} ${round.clipCode}`,
      ttlSeconds: 600,
    });
    payUrl = inv.payUrl;
    await db.bet.update({
      where: { id: bet.id },
      data: { orderId, paymentId: inv.uuid || null },
    });
  } catch (e) {
    await db.bet.updateMany({
      where: { id: bet.id, status: "pending" },
      data: { status: "failed" },
    });
    moneyLog("bet_invoice_failed", { betId: bet.id, error: e instanceof Error ? e.message : e });
    throw new BetError("payment provider unavailable", 502, "invoice_failed");
  }

  moneyLog("bet_invoice_created", {
    betId: bet.id,
    roundId: round.id,
    clip: round.clipCode,
    side,
    amountCents: amount,
    orderId,
    ref: input.refCode ?? null,
  });
  void trackEvent("bet_placed", {
    clipCode: round.clipCode,
    visitorHash: input.fingerprint,
    meta: { mode: "crypto", side, amountCents: amount, ref: input.refCode ?? null },
  });

  return { betId: bet.id, status: "pending", mode: "crypto", payUrl };
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
  resolvedAs: BetSide;
  totalCents: number;
  rakeCents: number;
  authorShareCents: number;
  refShareCents: number;
  winners: number;
  losers: number;
}

/**
 * Резолв раунда по кураторскому truth. Идемпотентен: гейт — перевод
 * open|locked → resolved через updateMany; повторный вызов вернёт null.
 * Вызывать только после closesAt (ленивый cron в /api/round + внешний cron).
 */
export async function resolveRound(roundId: string): Promise<ResolveSummary | null> {
  const round = await db.round.findUnique({ where: { id: roundId } });
  if (!round || round.status === "resolved") return null;
  if (round.closesAt.getTime() > Date.now()) return null; // ещё открыт

  const truth = truthOf(round.clipCode);
  if (!truth) {
    console.error(
      "[money-op][bet] resolve_blocked_no_truth",
      JSON.stringify({ roundId: round.id, clip: round.clipCode })
    );
    return null; // куратор снял truth у живого раунда — разбор вручную
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

  let paid = 0;
  const refRake = new Map<string, number>();
  const refCut = new Map<string, number>();
  let winners = 0;
  let losers = 0;

  for (const b of bets) {
    const won = b.side === truth;
    const payout = won && winPool > 0 ? Math.floor((prize * b.amountCents) / winPool) : 0;
    paid += payout;
    if (won) winners++; else losers++;

    await db.bet.updateMany({
      where: { id: b.id, status: "active" },
      data: { status: won ? "won" : "lost", payoutCents: payout },
    });

    void trackEvent(won ? "bet_won" : "bet_lost", {
      clipCode: round.clipCode,
      visitorHash: b.fingerprint,
      meta: { betId: b.id, side: b.side, amountCents: b.amountCents, payoutCents: payout },
    });

    if (b.refCode && total > 0) {
      refRake.set(b.refCode, (refRake.get(b.refCode) ?? 0) + b.amountCents);
      refCut.set(
        b.refCode,
        (refCut.get(b.refCode) ?? 0) +
          Math.floor(rake * BET.refRatePct * (b.amountCents / total))
      );
    }
  }

  const authorShare = Math.floor(rake * BET.authorShareOfRake);
  const refShareTotal = [...refCut.values()].reduce((s, v) => s + v, 0);

  await db.round.update({
    where: { id: round.id },
    data: {
      status: "resolved",
      resolvedAs: truth,
      rakeCents: rake,
      authorShareCents: authorShare,
      refShareCents: refShareTotal,
      resolvedAt: new Date(),
    },
  });

  /* реестр выплат реферерам — та же таблица, что и продажи (единый /api/admin/referrals) */
  for (const [code, cut] of refCut) {
    if (cut <= 0) continue;
    try {
      await db.referralEvent.upsert({
        where: { orderId: `rr-${round.id}-${code}` },
        create: {
          orderId: `rr-${round.id}-${code}`,
          refCode: code,
          kind: "bet_rake",
          amountUsdt: (((refRake.get(code) ?? 0) * BET.rakePct) / 100).toFixed(2),
          payoutUsdt: (cut / 100).toFixed(2),
        },
        update: {},
      });
    } catch {
      /* best-effort: атрибуция есть в Bet.refCode — пересчитать можно всегда */
    }
  }

  moneyLog("round_resolved", {
    roundId: round.id,
    clip: round.clipCode,
    resolvedAs: truth,
    totalCents: total,
    rakeCents: rake,
    authorShareCents: authorShare,
    refShareCents: refShareTotal,
    prizePaidCents: paid,
    dustCents: prize - paid,
    winners,
    losers,
    bets: bets.length,
  });

  return {
    roundId: round.id,
    clipCode: round.clipCode,
    resolvedAs: truth,
    totalCents: total,
    rakeCents: rake,
    authorShareCents: authorShare,
    refShareCents: refShareTotal,
    winners,
    losers,
  };
}

/** ленивый cron (§4.3.5): резолвим всё просроченное; вызывается из /api/round */
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
