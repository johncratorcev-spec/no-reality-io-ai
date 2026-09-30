import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/bet/events";
import { is2328PaymentConfigured, create2328Payment } from "@/lib/2328/payment";

/**
 * Внутренняя экономика v6 — аккаунт с нулевым порогом входа.
 *
 * ПОРОГ ВХОДА = 0: аккаунт создаётся лениво по httpOnly-cookie nr_uid на
 * первом действии (ставка/награда/пополнение). Ни формы, ни email, ни
 * кошелёк. Привязка кошелька (MetaMask/Phantom) открывает NR PASS.
 *
 * БАЛАНС: внутренняя валюта в центах. ЕДИНСТВЕННЫЙ источник истины —
 * LedgerTxn (двусторонний журнал). Каждое движение атомарно
 * (updateMany с guard'ом) и идемпотентно (refKey unique).
 *
 * КРИПТО-ПОПОЛНЕНИЕ: инвойс 2328.io (orderId dp-<id>) → подписанный
 * webhook → зачисление deposit:<paymentId>. Поллинг клиента деньгами
 * не управляет (то же правило, что у ставок rb-*).
 */

/* ------------------------------------------------------------------ */
/*  Конфиг экономики (env перекрывает дефолты)                         */
/* ------------------------------------------------------------------ */

function num(name: string, def: number, min: number, max: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v) || v < min || v > max) return def;
  return v;
}

export const ECON = {
  /** welcome-бонус новому аккаунту: +100 EYE за регистрацию (v11 — приказ) */
  welcomeBonusCents: Math.round(num("WELCOME_BONUS_CENTS", 100, 0, 100000)),
  /** daily-бонус NR PASS за UTC-день */
  dailyBonusCents: Math.round(num("DAILY_BONUS_CENTS", 50, 0, 100000)),
  /** награда за целевой клик (спецблоки/фичеред) */
  clickRewardCents: Math.round(num("CLICK_REWARD_CENTS", 5, 0, 1000)),
  /** капс наград за целевые клики в сутки на аккаунт */
  clickRewardDailyCap: Math.round(num("CLICK_REWARD_DAILY_CAP", 20, 1, 1000)),
  /** награда владельцу ссылки за уникальный UTM-переход */
  utmRewardCents: Math.round(num("UTM_REWARD_CENTS", 3, 0, 1000)),
  /** капс UTM-наград в сутки на аккаунт */
  utmRewardDailyCap: Math.round(num("UTM_REWARD_DAILY_CAP", 100, 1, 10000)),
  /** пресеты пополнения (крипто-инвойс) */
  depositPresetsCents: [500, 1000, 2000] as const,
  /**
   * v7 — бонус-мультипликатор монет за пакет пополнения (%, по индексам
   * пресетов): 500 монет → +0%, 1000 → +10%, 2000 → +25%. Начисляется тем
   * же подписанным вебхуком отдельной ledger-строкой deposit_bonus.
   */
  depositBonusPcts: parseBonusPcts(process.env.DEPOSIT_BONUS_PERCENTS),
  /**
   * v8 — награды за активность (замена Instagram-задания):
   *  - просмотр ленты: каждые N уникальных клипов за UTC-день → монеты,
   *    с дневным капсом (api/reward/watch);
   *  - угадывание: фиксированный бонус за каждую выигравшую ставку
   *    (resolveRound, refKey guess:<betId>);
   *  - добавление видео в ленту: куратору панели при публикации события
   *    (api/admin/events, refKey video:<clipCode>).
   */
  watchRewardCents: Math.round(num("WATCH_REWARD_CENTS", 10, 0, 1000)),
  watchRewardEveryClips: Math.round(num("WATCH_REWARD_EVERY_CLIPS", 3, 1, 100)),
  watchRewardDailyCapCents: Math.round(num("WATCH_REWARD_DAILY_CAP_CENTS", 100, 0, 100000)),
  guessRewardCents: Math.round(num("GUESS_REWARD_CENTS", 10, 0, 1000)),
  videoRewardCents: Math.round(num("VIDEO_REWARD_CENTS", 100, 0, 100000)),
  /** капс demo-пополнения в сутки (dev/sandbox без 2328-ключей) */
  depositDemoDailyCapCents: Math.round(num("DEPOSIT_DEMO_DAILY_CAP", 1000, 100, 100000)),
  /** минимальный интервал между наградами за клики одного аккаунта, мс */
  clickMinIntervalMs: Math.round(num("CLICK_MIN_INTERVAL_MS", 2000, 0, 60000)),
} as const;

/** "0,10,25" → [0,10,25]; выравнивание по числу пресетов депозитов (3) */
function parseBonusPcts(raw: string | undefined): number[] {
  const fallback = [0, 10, 25];
  const arr = (raw || "")
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .map((n) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0));
  const out: number[] = [];
  for (let i = 0; i < 3; i++) out.push(arr[i] ?? fallback[i] ?? 0);
  return out;
}

export type LedgerKind =
  | "signup_bonus"
  | "daily_bonus"
  | "click_reward"
  | "utm_reward"
  | "watch_view" // v8: отметка просмотра клипа (delta=0, дедуп за UTC-день)
  | "watch_reward" // v8: монеты за каждые N уникальных просмотров
  | "guess_reward" // v8: бонус за верное предсказание (won-ставка)
  | "video_reward" // v8: бонус куратору за добавление видео в ленту
  | "bet_stake"
  | "bet_payout"
  | "deposit"
  | "deposit_bonus"
  | "deposit_demo";

function econLog(event: string, fields: Record<string, unknown>) {
  console.log(`[money-op][econ] ${event}`, JSON.stringify(fields));
}

/* ------------------------------------------------------------------ */
/*  Cookie-идентификация (тот же паттерн, что bet/identity + buyer)    */
/* ------------------------------------------------------------------ */

const ACCOUNT_COOKIE = "nr_uid";
const YEAR = 60 * 60 * 24 * 365;

export interface AccountRef {
  id: string;
  isNew: boolean;
}

export function readAccount(req: NextRequest): AccountRef {
  const existing = req.cookies.get(ACCOUNT_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

/** JSON-ответ, который гарантирует доставку cookie нового аккаунта. */
export function accountResponse(
  account: AccountRef,
  body: unknown,
  status = 200
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (account.isNew) {
    res.cookies.set(ACCOUNT_COOKIE, account.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/*  Ledger — единый источник истины баланса                            */
/* ------------------------------------------------------------------ */

export class EconError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

/**
 * Атомарное движение по журналу. Для списаний guard balanceCents >= |delta|
 * (нельзя уйти в минус); для refKey — идемпотентность (повтор = no-op).
 * Возвращает true, если движение реально произошло.
 */
export async function applyLedger(
  accountId: string,
  delta: number,
  kind: LedgerKind,
  refKey?: string | null,
  meta: Record<string, unknown> = {},
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  if (delta === 0) return false;
  const client = tx ?? db;
  const data = {
    accountId,
    delta,
    kind,
    refKey: refKey ?? null,
    meta: JSON.stringify(meta).slice(0, 1000),
  };
  try {
    if (delta > 0) {
      /* refKey unique: повторный webhook/клик бросит здесь → уже учтено */
      await client.ledgerTxn.create({ data });
      await client.account.update({
        where: { id: accountId },
        data: { balanceCents: { increment: delta } },
      });
      return true;
    }
    /* списание: атомарный guard от ухода в минус */
    const moved = await client.account.updateMany({
      where: { id: accountId, balanceCents: { gte: -delta } },
      data: { balanceCents: { decrement: -delta } },
    });
    if (moved.count === 0) return false;
    await client.ledgerTxn.create({ data });
    return true;
  } catch {
    return false;
  }
}

/** Списание под ставку: бросает insufficient_balance, если денег нет. */
export async function debitBetStake(
  accountId: string,
  amountCents: number,
  betId: string
): Promise<void> {
  const credited = await applyLedger(
    accountId,
    -amountCents,
    "bet_stake",
    `bet:${betId}`,
    { betId }
  );
  if (!credited) {
    throw new EconError("not enough balance", 402, "insufficient_balance");
  }
}

/* ------------------------------------------------------------------ */
/*  Аккаунт: ensure / view / pass                                      */
/* ------------------------------------------------------------------ */

/**
 * Ленивое создание аккаунта + welcome-бонус (идемпотентно).
 * Новый аккаунт = ноль форм: регистрация случается сама.
 */
export async function ensureAccount(id: string) {
  let account = await db.account.findUnique({ where: { id } });
  if (account) return account;

  account = await db.account.create({ data: { id } }).catch(async () => {
    /* гонка двух параллельных ensure — просто перечитаем */
    return db.account.findUnique({ where: { id } });
  });
  if (!account) throw new EconError("account unavailable", 500, "account_failed");

  if (ECON.welcomeBonusCents > 0) {
    const credited = await applyLedger(
      account.id,
      ECON.welcomeBonusCents,
      "signup_bonus",
      `signup:${account.id}`
    );
    if (credited) {
      econLog("signup_bonus", { accountId: account.id, cents: ECON.welcomeBonusCents });
      void trackEvent("welcome_granted", { meta: { cents: ECON.welcomeBonusCents } });
    }
  }
  return (await db.account.findUnique({ where: { id } }))!;
}

export interface AccountView {
  accountId: string;
  balanceCents: number;
  passTier: number;
  isPass: boolean;
  /** v7.1: email google/magic-сессии — null у мгновенного гостя */
  email: string | null;
  /** v11: имя Telegram-аккаунта (displayName/@username) — для чипа в шапке */
  name: string | null;
  streakDays: number;
  dailyAvailable: boolean;
}

export function accountView(a: {
  id: string;
  balanceCents: number;
  passTier: number;
  email?: string | null;
  displayName?: string | null;
  tgUsername?: string | null;
  streakDays: number;
  lastDailyAt: Date | null;
}): AccountView {
  return {
    accountId: a.id,
    balanceCents: a.balanceCents,
    passTier: a.passTier,
    isPass: a.passTier > 0,
    email: a.email ?? null,
    name: a.displayName || (a.tgUsername ? `@${a.tgUsername}` : null),
    streakDays: a.streakDays,
    dailyAvailable: a.passTier > 0 && !sameUtcDay(a.lastDailyAt, new Date()),
  };
}

function sameUtcDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/* ------------------------------------------------------------------ */
/*  NR PASS — пасс авторизованного пользователя                        */
/*  v7.1: пасс выдаётся google/magic-входом (signInWithGoogle и        */
/*  magic-link); крипто-привязка кошелька удалена с сайта.             */
/* ------------------------------------------------------------------ */

/** Daily-бонус NR PASS: раз в UTC-день, streak растёт при непрерывности. */
export async function claimDailyBonus(accountId: string): Promise<{
  credited: boolean;
  amountCents: number;
  streakDays: number;
}> {
  const me = await ensureAccount(accountId);
  if (me.passTier === 0) {
    throw new EconError("NR PASS required", 403, "pass_required");
  }
  if (ECON.dailyBonusCents <= 0) {
    return { credited: false, amountCents: 0, streakDays: me.streakDays };
  }
  if (sameUtcDay(me.lastDailyAt, new Date())) {
    return { credited: false, amountCents: 0, streakDays: me.streakDays };
  }

  const yesterday = new Date(Date.now() - 86_400_000);
  const continues = sameUtcDay(me.lastDailyAt, yesterday);
  const streakDays = continues ? me.streakDays + 1 : 1;

  const credited = await applyLedger(
    me.id,
    ECON.dailyBonusCents,
    "daily_bonus",
    `daily:${me.id}:${new Date().toISOString().slice(0, 10)}`,
    { streakDays }
  );
  if (credited) {
    await db.account.update({
      where: { id: me.id },
      data: { lastDailyAt: new Date(), streakDays },
    });
    econLog("daily_bonus", { accountId: me.id, cents: ECON.dailyBonusCents, streakDays });
    void trackEvent("daily_claimed", { meta: { streakDays } });
  }
  return { credited, amountCents: credited ? ECON.dailyBonusCents : 0, streakDays };
}

/* ------------------------------------------------------------------ */
/*  Крипто-пополнение баланса (2328.io → webhook → ledger)             */
/* ------------------------------------------------------------------ */

const base = () =>
  process.env.PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://no-reality.fun";

/**
 * Создание инвойса пополнения. Идемпотентно по pending-инвойсу аккаунта:
 * повторный вызов с тем же accountId вернёт существующий заказ.
 * v7: пакет несёт бонус-мультипликатор монет (0/10/25%) — начислим его
 * из подписанного вебхука (и в demo — мгновенно).
 * Без 2328-ключей (dev/demo) — мгновенное demo-пополнение с дневным капсом.
 */
export async function createDeposit(
  accountId: string,
  amountCents: number
): Promise<{
  orderId: string;
  payUrl: string | null;
  mode: "crypto" | "demo";
  bonusCents: number;
  bonusPct: number;
  balanceCents: number;
}> {
  const presetIdx = ECON.depositPresetsCents.indexOf(amountCents as never);
  if (presetIdx < 0) {
    throw new EconError(
      `amount must be one of ${ECON.depositPresetsCents.join(", ")}`,
      400,
      "bad_amount"
    );
  }
  const bonusPct = ECON.depositBonusPcts[presetIdx] ?? 0;
  const bonusCents = Math.floor((amountCents * bonusPct) / 100);
  const me = await ensureAccount(accountId);

  /* переиспользуем живой pending-инвойс той же суммы (анти-спам 2328) */
  const pending = await db.depositOrder.findFirst({
    where: { accountId: me.id, status: "pending", amountCents, mode: "crypto" },
    orderBy: { createdAt: "desc" },
  });
  if (pending) {
    return {
      orderId: pending.orderId,
      payUrl: null,
      mode: "crypto",
      bonusCents: pending.bonusCents,
      bonusPct,
      balanceCents: me.balanceCents,
    };
  }

  if (!is2328PaymentConfigured()) {
    /* demo: зачисляем сразу (сумма + бонус), но не больше дневного капса */
    const dayKey = new Date().toISOString().slice(0, 10);
    const credited = await applyLedger(
      me.id,
      amountCents,
      "deposit_demo",
      `deposit_demo:${me.id}:${dayKey}:${amountCents}`,
      { demo: true }
    );
    if (!credited) {
      throw new EconError("demo top-up cap reached for today", 429, "demo_cap");
    }
    if (bonusCents > 0) {
      /* бонус мультипликатора работает и в demo — флоу одинаков в sandbox */
      await applyLedger(me.id, bonusCents, "deposit_bonus", `deposit_bonus:demo:${me.id}:${dayKey}:${amountCents}`, {
        demo: true,
        pct: bonusPct,
      });
    }
    econLog("deposit_demo", { accountId: me.id, cents: amountCents, bonusCents });
    const fresh = await db.account.findUniqueOrThrow({ where: { id: me.id } });
    return {
      orderId: `demo-${dayKey}`,
      payUrl: null,
      mode: "demo",
      bonusCents,
      bonusPct,
      balanceCents: fresh.balanceCents,
    };
  }

  const order = await db.depositOrder.create({
    data: {
      accountId: me.id,
      orderId: `dp-${randomUUID()}`,
      amountCents,
      bonusCents,
      mode: "crypto",
    },
  });
  try {
    const inv = await create2328Payment({
      amountUsdt: (amountCents / 100).toFixed(2),
      orderId: order.orderId,
      urlCallback: `${base()}/api/webhooks/2328`,
      urlReturn: `${base()}/bet`,
      description: "no reality. balance top-up",
      ttlSeconds: 1800,
    });
    await db.depositOrder.update({
      where: { id: order.id },
      data: { paymentId: inv.uuid || null },
    });
    econLog("deposit_invoice_created", {
      accountId: me.id,
      orderId: order.orderId,
      cents: amountCents,
      bonusCents,
    });
    return {
      orderId: order.orderId,
      payUrl: inv.payUrl,
      mode: "crypto",
      bonusCents,
      bonusPct,
      balanceCents: me.balanceCents,
    };
  } catch (e) {
    await db.depositOrder.updateMany({
      where: { id: order.id, status: "pending" },
      data: { status: "failed" },
    });
    econLog("deposit_invoice_failed", {
      accountId: me.id,
      error: e instanceof Error ? e.message : e,
    });
    throw new EconError("payment provider unavailable", 502, "invoice_failed");
  }
}

/** Статус пополнения для клиентского поллинга (деньгами не управляет). */
export async function depositStatus(accountId: string, orderId: string) {
  const dep = await db.depositOrder.findFirst({
    where: { orderId, accountId },
    select: { status: true, amountCents: true },
  });
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { balanceCents: true },
  });
  return {
    status: dep?.status ?? "unknown",
    amountCents: dep?.amountCents ?? 0,
    balanceCents: account?.balanceCents ?? 0,
  };
}

/**
 * Подтверждение пополнения из подписанного webhook'а (идемпотентно).
 * v7: помимо суммы зачисляем бонус-мультипликатор пакета отдельной
 * ledger-строкой deposit_bonus:<paymentUuid> — та же идемпотентность.
 */
export async function confirmDepositPayment(
  paymentUuid: string,
  orderId: string,
  txid: string | null
): Promise<{ amountCents: number; bonusCents: number; accountId: string } | null> {
  const dep = await db.depositOrder.findFirst({
    where: { OR: [{ paymentId: paymentUuid }, { orderId }] },
  });
  if (!dep) return null;

  const moved = await db.depositOrder.updateMany({
    where: { id: dep.id, status: "pending" },
    data: { status: "paid", paidAt: new Date(), txid },
  });
  if (moved.count === 0) return null; /* повторный webhook — уже зачислено */

  const credited = await applyLedger(
    dep.accountId,
    dep.amountCents,
    "deposit",
    `deposit:${paymentUuid}`,
    { orderId: dep.orderId, txid }
  );
  if (!credited) {
    /* деньги подтверждены провайдером, но ledger отказал — не теряем:
       заказ помечен paid, разбор вручную по [money-op][econ] логам */
    econLog("deposit_credit_conflict", { orderId: dep.orderId, accountId: dep.accountId });
    return null;
  }
  /* бонус-мультипликатор монет (v7) — идемпотентно по paymentUuid */
  let bonusCents = 0;
  if (dep.bonusCents > 0) {
    bonusCents = (await applyLedger(
      dep.accountId,
      dep.bonusCents,
      "deposit_bonus",
      `deposit_bonus:${paymentUuid}`,
      { orderId: dep.orderId }
    ))
      ? dep.bonusCents
      : 0;
    if (!bonusCents) {
      econLog("deposit_bonus_conflict", { orderId: dep.orderId, accountId: dep.accountId });
    }
  }

  econLog("deposit_credited", {
    accountId: dep.accountId,
    orderId: dep.orderId,
    cents: dep.amountCents,
    bonusCents,
    txid,
  });
  return { amountCents: dep.amountCents, bonusCents, accountId: dep.accountId };
}

/** Финальный провал инвойса пополнения (cancel/underpaid). */
export async function failDepositOrder(paymentUuid: string, orderId: string) {
  const dep = await db.depositOrder.findFirst({
    where: { OR: [{ paymentId: paymentUuid }, { orderId }] },
  });
  if (!dep) return;
  const moved = await db.depositOrder.updateMany({
    where: { id: dep.id, status: "pending" },
    data: { status: "failed" },
  });
  if (moved.count) {
    econLog("deposit_failed", { orderId: dep.orderId, accountId: dep.accountId });
  }
}
