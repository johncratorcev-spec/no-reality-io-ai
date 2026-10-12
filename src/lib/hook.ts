import "server-only";

import { db } from "@/lib/db";
import { applyLedger, ECON, EconError, effectiveDailyStreak } from "@/lib/account";
import { awardBadge, REF_BADGE_MILESTONES, type BadgeCode } from "@/lib/badges";
import { trackEvent } from "@/lib/bet/events";

/**
 * v20 — КРЮЧКОВАЯ ЭКОНОМИКА (ТЗ §3–§5): игроку всегда выгоднее делиться и
 * возвращаться, чем «вывести и уйти».
 *
 *   ЗАРАБОТОК EYE: регистрация (welcome + xref), шеринг (win/streak,
 *     раз в UTC-день), победы (pari-muttuel + guess), стрики (milestones),
 *     daily-вход, фрибет за @nick, первая ставка друга (рефереру).
 *   ТРАТА EYE: ставки (единственное назначение), шоп (косметика/щит).
 *   ВЫВОД EYE: НЕТ. Никакой API-дорожки из EYE в крипту/фиат не существует;
 *     попытки логируются в WithdrawAttempt. Единственный выход ценности —
 *     сезонный snapshot → $NR (вес зависит от активности/стриков/рефералов).
 */

export class HookError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/*  Шеринг за EYE (виральная воронка, ТЗ §4)                           */
/* ------------------------------------------------------------------ */

export type ShareKind = "win" | "streak" | "invite";

/** награда за шеринговый клик: один вид — один раз в UTC-день */
export async function claimShare(
  accountId: string,
  kind: ShareKind
): Promise<{ credited: boolean; amountCents: number; alreadyToday: boolean }> {
  const amount =
    kind === "win" ? ECON.shareWinCents : kind === "streak" ? ECON.shareStreakCents : 0;
  if (amount <= 0) return { credited: false, amountCents: 0, alreadyToday: false };

  const day = new Date().toISOString().slice(0, 10);
  const credited = await applyLedger(
    accountId,
    amount,
    "share_reward",
    `share:${kind}:${day}:${accountId}`,
    { kind, day }
  );
  if (credited) {
    void trackEvent("share_rewarded", { meta: { kind, amountCents: amount } });
  }
  return { credited, amountCents: credited ? amount : 0, alreadyToday: !credited };
}

/** что сегодня уже шарили (для UI-состояния кнопки) */
export async function shareStatusToday(accountId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db.ledgerTxn
    .findMany({
      where: {
        accountId,
        kind: "share_reward",
        refKey: { in: [
          `share:win:${day}:${accountId}`,
          `share:streak:${day}:${accountId}`,
        ] },
      },
      select: { refKey: true },
    })
    .catch(() => [] as Array<{ refKey: string }>);
  return {
    win: rows.some((r) => (r.refKey ?? "").includes("share:win:")),
    streak: rows.some((r) => (r.refKey ?? "").includes("share:streak:")),
  };
}

/* ------------------------------------------------------------------ */
/*  Реферальная квалификация (ТЗ §5): награда ТОЛЬКО после первой ставки */
/* ------------------------------------------------------------------ */

export interface RefAntifraudContext {
  refereeFp: string;
  refereeIpHash: string;
}

/**
 * Qualifying action друга — первая АКТИВНАЯ ставка. Вызывается из
 * placeBetBalance после успеха. Двусторонняя модель:
 *   referee получил xref-бонус при регистрации (ref_welcome),
 *   referrer получает refQualifyEyeCents ТОЛЬКО здесь и один раз.
 *
 * Антибот-защита (ТЗ §5):
 *   1. unique(refereeId) — квалификация одноразова по определению;
 *   2. один device (fp) или IP не может быть referrer'ом и referee
 *      одновременно;
 *   3. velocity: не более refQualifyDailyCap квалификаций у referrer'а в
 *      сутки (лишние → held, в ручную ревизию);
 *   4. самоприглашение исключено на этапе атрибуции (attributeReferral).
 * Возврат: {paid|held|skipped}.
 */
export async function qualifyReferral(
  refereeId: string,
  ctx: RefAntifraudContext
): Promise<"paid" | "held" | "skipped"> {
  if (ECON.refQualifyEyeCents <= 0) return "skipped";

  const referee = await db.account.findUnique({
    where: { id: refereeId },
    select: { referredById: true, createdAt: true },
  });
  if (!referee?.referredById) return "skipped";
  const referrerId = referee.referredById;
  if (referrerId === refereeId) return "skipped";

  /* 2а: тот же device — отказ (пишем held-строку для ревизии) */
  const referrer = await db.account.findUnique({
    where: { id: referrerId },
    select: { signupFp: true, signupIpHash: true },
  });
  const sameDevice =
    (referrer?.signupFp && referrer.signupFp === ctx.refereeFp) ||
    (referrer?.signupIpHash && referrer.signupIpHash === ctx.refereeIpHash);
  if (sameDevice) {
    await db.referralReward
      .create({
        data: {
          referrerId,
          refereeId,
          status: "held",
          reason: "same_device",
          eyeReferrer: 0,
          eyeReferee: 0,
          refereeFp: ctx.refereeFp,
          referrerFp: referrer?.signupFp ?? "",
          refereeIpHash: ctx.refereeIpHash,
          referrerIpHash: referrer?.signupIpHash ?? "",
        },
      })
      .catch(() => null);
    console.warn(
      `[money-op][hook] referral_held_same_device ${JSON.stringify({ referrerId: referrerId.slice(0, 8), refereeId: refereeId.slice(0, 8) })}`
    );
    return "held";
  }

  /* 3: velocity-лимит referrer'а в сутки */
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const todayPaid = await db.referralReward.count({
    where: { referrerId, createdAt: { gte: dayStart } },
  });
  const velocityExceeded = todayPaid >= ECON.refQualifyDailyCap;

  const eyeReferrer = velocityExceeded ? 0 : ECON.refQualifyEyeCents;

  /* 1: одноразовость — unique(refereeId) гасит гонку повторных ставок */
  const created = await db.referralReward
    .create({
      data: {
        referrerId,
        refereeId,
        status: velocityExceeded ? "held" : "paid",
        reason: "first_bet",
        eyeReferrer,
        eyeReferee: ECON.refWelcomeExtraCents,
        refereeFp: ctx.refereeFp,
        referrerFp: referrer?.signupFp ?? "",
        refereeIpHash: ctx.refereeIpHash,
        referrerIpHash: referrer?.signupIpHash ?? "",
      },
    })
    .catch(() => null);
  if (!created) return "skipped"; // уже квалифицирован (гонка ставок)

  if (!velocityExceeded && eyeReferrer > 0) {
    const paid = await applyLedger(
      referrerId,
      eyeReferrer,
      "ref_qualify",
      `refqual:${refereeId}`,
      { refereeId }
    );
    if (paid) {
      console.log(
        `[money-op][hook] ref_qualify_paid ${JSON.stringify({ referrerId: referrerId.slice(0, 8), refereeId: refereeId.slice(0, 8), eye: eyeReferrer })}`
      );
    }
  }

  /* милстоуны-бейджи refs_3/10/25/50 — по числу ОПЛАЧЕННЫХ квалификаций */
  const totalPaid = await db.referralReward.count({
    where: { referrerId, status: "paid" },
  });
  for (const m of REF_BADGE_MILESTONES) {
    if (totalPaid >= m.at) {
      await awardBadge(referrerId, m.code as BadgeCode, { refs: totalPaid });
    }
  }

  void trackEvent("ref_qualify", {
    meta: { held: velocityExceeded, eyeReferrer },
  });
  return velocityExceeded ? "held" : "paid";
}

/* ------------------------------------------------------------------ */
/*  Фрибет за Telegram-ник (ТЗ §9)                                     */
/* ------------------------------------------------------------------ */

const TG_USERNAME_RE = /^[a-zA-Z0-9_]{4,32}$/;

export function normalizeTgUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim().replace(/^@/, "").toLowerCase();
  return TG_USERNAME_RE.test(u) ? u : null;
}

/**
 * Фрибет: пользователь просто указывает @username → +freebetTelegramCents
 * один раз на аккаунт И один раз на ник (глобально). Без проверки владения
 * (ТЗ). EYE не выводим — «только на ставки» выполняется самой экономикой.
 */
export async function grantTelegramFreebet(
  accountId: string,
  username: string
): Promise<{ granted: boolean; amountCents: number; reason?: string }> {
  const u = normalizeTgUsername(username);
  if (!u) throw new HookError("@username looks wrong (4–32: letters, digits, _)", 400, "bad_username");
  if (ECON.freebetTelegramCents <= 0) return { granted: false, amountCents: 0, reason: "disabled" };

  /* один фрибет на аккаунт */
  const own = await db.freebet.findUnique({
    where: { accountId_source: { accountId, source: "telegram" } },
  }).catch(() => null);
  if (own) return { granted: false, amountCents: 0, reason: "already_claimed" };

  const created = await db.freebet
    .create({
      data: {
        accountId,
        source: "telegram",
        username: u,
        amountCents: ECON.freebetTelegramCents,
      },
    })
    .catch(() => null);
  if (!created) {
    /* ник уже занят другим аккаунтом (unique source+username) */
    return { granted: false, amountCents: 0, reason: "username_taken" };
  }

  const credited = await applyLedger(
    accountId,
    ECON.freebetTelegramCents,
    "freebet_telegram",
    `tgfree:${created.id}`,
    { username: u }
  );
  void trackEvent("freebet_telegram", { meta: { ok: credited } });
  return { granted: credited, amountCents: credited ? ECON.freebetTelegramCents : 0 };
}

/* ------------------------------------------------------------------ */
/*  Шоп за EYE (косметика + щит)                                       */
/* ------------------------------------------------------------------ */

export type ShopSku = "badge:pumpkin" | "streak_shield";

export interface ShopItem {
  sku: ShopSku;
  priceCents: number;
  kind: "badge" | "shield";
  badgeCode?: BadgeCode;
}

export function shopCatalog(): ShopItem[] {
  return [
    { sku: "badge:pumpkin", priceCents: ECON.shopBadgePumpkinCents, kind: "badge", badgeCode: "pumpkin" },
    { sku: "streak_shield", priceCents: ECON.shopStreakShieldCents, kind: "shield" },
  ];
}

/**
 * Покупка за EYE: атомарное списание (нет денег → 402) + товар.
 * pumpkin — бейдж-косметика; streak_shield — сутки защиты daily-стрика
 * (стрик не сгорит, даже если пропустить день).
 */
export async function shopBuy(
  accountId: string,
  sku: string
): Promise<{ bought: boolean; item: ShopItem; balanceCents: number }> {
  const item = shopCatalog().find((i) => i.sku === sku);
  if (!item) throw new HookError("unknown item", 400, "bad_sku");

  /* одноразовость товара: unique(accountId, sku) */
  const dup = await db.shopPurchase
    .findUnique({ where: { accountId_sku: { accountId, sku } } })
    .catch(() => null);
  if (dup) throw new HookError("already owned", 409, "already_owned");

  const purchase = await db.shopPurchase
    .create({ data: { accountId, sku, priceCents: item.priceCents } })
    .catch(() => null);
  if (!purchase) throw new HookError("already owned", 409, "already_owned");

  const paid = await applyLedger(
    accountId,
    -item.priceCents,
    "shop_buy",
    `shop:${purchase.id}`,
    { sku }
  );
  if (!paid) {
    /* денег нет — товар убираем (обратимо: строка покупки не нужна) */
    await db.shopPurchase.deleteMany({ where: { id: purchase.id } }).catch(() => null);
    throw new EconError("not enough balance", 402, "insufficient_balance");
  }

  if (item.kind === "badge" && item.badgeCode) {
    await awardBadge(accountId, item.badgeCode, { via: "shop" });
  }
  if (item.kind === "shield") {
    const until = new Date(Date.now() + 86_400_000); // сутки от покупки
    await db.account.update({
      where: { id: accountId },
      data: { streakShieldUntil: until },
    });
    return { bought: true, item, balanceCents: await balanceOf(accountId) };
  }

  void trackEvent("shop_bought", { meta: { sku } });
  return { bought: true, item, balanceCents: await balanceOf(accountId) };
}

async function balanceOf(accountId: string): Promise<number> {
  const a = await db.account.findUnique({
    where: { id: accountId },
    select: { balanceCents: true },
  });
  return a?.balanceCents ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Попытки вывода (журнал; вывода НЕТ — ТЗ §3)                        */
/* ------------------------------------------------------------------ */

export async function logWithdrawAttempt(
  accountId: string,
  kind: string,
  ipHash: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  await db.withdrawAttempt
    .create({
      data: { accountId, kind, ipHash, meta: JSON.stringify(meta).slice(0, 500) },
    })
    .catch(() => null);
  void trackEvent("withdraw_attempt", { meta: { kind } });
  console.log(
    `[money-op][hook] withdraw_attempt_blocked ${JSON.stringify({ accountId: accountId.slice(0, 8), kind })}`
  );
}

/* ------------------------------------------------------------------ */
/*  Кабинет: сводка (ТЗ §7)                                            */
/* ------------------------------------------------------------------ */

export interface PnlBucket {
  stakeCents: number;
  payoutCents: number;
  bonusCents: number;
}

/** PnL: ставки/выплаты/бонусы из леджера (день UTC / сезон = всё время до снапшота) */
export async function pnlOf(accountId: string): Promise<{ day: PnlBucket; season: PnlBucket }> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const rows = await db.ledgerTxn
    .findMany({
      where: { accountId, createdAt: { gte: dayStart } },
      select: { delta: true, kind: true },
    })
    .catch(() => [] as Array<{ delta: number; kind: string }>);
  const allRows = rows.length
    ? rows
    : await db.ledgerTxn
        .findMany({ where: { accountId }, select: { delta: true, kind: true, createdAt: true } })
        .catch(() => []);

  const bucket = (list: Array<{ delta: number; kind: string }>): PnlBucket => {
    let stake = 0;
    let payout = 0;
    let bonus = 0;
    for (const r of list) {
      if (r.kind === "bet_stake") stake += -r.delta;
      else if (r.kind === "bet_payout" || r.kind === "bet_refund") payout += r.delta;
      else if (r.delta > 0) bonus += r.delta;
      else if (r.delta < 0 && r.kind === "shop_buy") bonus += r.delta; // трата — в минус PnL бонусов
    }
    return { stakeCents: stake, payoutCents: payout, bonusCents: bonus };
  };

  const dayRows = rows;
  const seasonRows = allRows;
  return { day: bucket(dayRows), season: bucket(seasonRows) };
}

/** winrate + вин-стрик по ставкам (для кабинета) */
export async function winStatsOf(accountId: string) {
  const rows = await db.bet.groupBy({
    by: ["status"],
    where: { accountId, status: { in: ["won", "lost"] } },
    _count: { _all: true },
  }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>);
  const won = rows.find((r) => r.status === "won")?._count._all ?? 0;
  const lost = rows.find((r) => r.status === "lost")?._count._all ?? 0;
  const total = won + lost;
  return {
    won,
    lost,
    total,
    winrate: total > 0 ? Math.round((won / total) * 100) : 0,
  };
}

/** сколько друзей привёл / активировал / EYE с рефералов (кабинет) */
export async function referralSummaryOf(accountId: string) {
  const [invited, activated, eyeRows, code] = await Promise.all([
    db.account.count({ where: { referredById: accountId } }).catch(() => 0),
    db.referralReward.count({ where: { referrerId: accountId, status: "paid" } }).catch(() => 0),
    db.ledgerTxn
      .aggregate({
        where: { accountId, kind: { in: ["ref_qualify"] } },
        _sum: { delta: true },
      })
      .then((r) => r._sum.delta ?? 0)
      .catch(() => 0),
    db.account
      .findUnique({ where: { id: accountId }, select: { refCode: true } })
      .then((r) => r?.refCode ?? null)
      .catch(() => null),
  ]);
  return { invited, activated, eyeFromRefs: eyeRows, refCode: code };
}

/** эффективный стрик для кабинета */
export async function dailyStreakOf(accountId: string) {
  const a = await db.account
    .findUnique({
      where: { id: accountId },
      select: { streakDays: true, lastDailyAt: true, streakShieldUntil: true },
    })
    .catch(() => null);
  if (!a) return { streakDays: 0, shieldActive: false };
  return {
    streakDays: effectiveDailyStreak(a),
    shieldActive: Boolean(a.streakShieldUntil && a.streakShieldUntil.getTime() > Date.now()),
  };
}
