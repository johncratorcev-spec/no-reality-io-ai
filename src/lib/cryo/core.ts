/**
 * Cryo-Stop server core (task 41).
 *
 * Пари-мьютюэль (спека Block 9 / «париматуэль» из ТЗ):
 *   distributable = totalPool × (1 − fee)
 *   payout_i      = distributable × (bet_i / winningPool)
 * Коэффициент, показываемый ДО ставки (Block 4): при ставке $1 в пул исхода X
 *   oddsX = (totalPool + 1) × (1 − fee) / (poolX + 1)
 * — пересчитывается живьём по мере прихода ставок.
 *
 * Деградация: БД может быть недоступна (serverless холодный старт) —
 * view-функции возвращают конфиг-состояние с нулевыми пулами и db:false,
 * ставки в этом режиме клиент сохраняет локально (UX не ломается).
 */
import { db } from "@/lib/db";
import {
  CRYO,
  cryoMarketByCode,
  cryoOptionsOf,
  cryoUsdcEnabled,
  type CryoMarketConfigItem,
} from "./config";
import { normalizeUsdc } from "./odds";
import { verifyUsdcBet } from "./verify";
import { awardSeerBadge } from "@/lib/bonuses";

export type CryoSide = string; // ключ опции: "yes"|"no" или нарративный
export type CryoStatus = "live" | "expired" | "resolved";

/** витрина одной опции нарративного рынка (task 44, ТЗ §4) */
export interface CryoOptionView {
  key: string;
  label: string;
  pool: number;
  count: number;
  /** коэффициент пари-мьютюэля при ставке $1 (null — некорректные пулы) */
  odds: number | null;
  /** доля пула опции в процентах (для полосы толпы) */
  pct: number;
}

export interface CryoMarketView {
  id: string | null;
  postCode: string;
  question: string;
  labelYes: string;
  labelNo: string;
  accent: string;
  status: CryoStatus;
  endsAt: string;
  result: CryoSide | null;
  yesPool: number;
  noPool: number;
  betsCount: number;
  /** коэффициент пари-мьютюэля при ставке $1 сейчас (null — пул исхода пуст) */
  oddsYes: number | null;
  oddsNo: number | null;
  /** нарративные опции рынка (task 44): 2–4 варианта, классика yes/no — тоже сюда */
  options: CryoOptionView[];
  /** режим ставки: usdc — прямой перевод на казначея, demo — симуляция */
  exchange: "demo" | "usdc";
  /** false — БД недоступна: пулы нулевые, ставки только локально */
  db: boolean;
  /** позиция текущего кошелька (если передан ?wallet=) */
  myBet?: CryoSide | null;
  myPayout?: string | null;
  myClaimed?: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function oddsFor(total: number, sidePool: number): number | null {
  // коэффициент ДЛЯ СТАВКИ $1 (базовая витрина; клиент пересчитывает под
  // выбранную сумму через cryoOdds из cryo/odds.ts)
  const payout = (total + 1) * (1 - CRYO.feePct) / (sidePool + 1);
  return round2(payout);
}

/** витрина опций конфиг-рынка без БД (деградация): пулы пустые */
function optionsViewOf(
  c: CryoMarketConfigItem,
  pools?: Map<string, { pool: number; count: number }>
): CryoOptionView[] {
  const opts = cryoOptionsOf(c);
  const total = [...(pools?.values() ?? [])].reduce((s, p) => s + p.pool, 0);
  return opts.map((o) => {
    const p = pools?.get(o.key) ?? { pool: 0, count: 0 };
    return {
      key: o.key,
      label: o.label,
      pool: round2(p.pool),
      count: p.count,
      odds: oddsFor(total, p.pool),
      pct: total > 0 ? Math.round((p.pool / total) * 100) : 0,
    };
  });
}

/** Конфиг-view без БД (деградация) */
function configView(c: CryoMarketConfigItem, dbOk: boolean): CryoMarketView {
  const endsAt = new Date(c.endsAtUtc);
  const status: CryoStatus = Date.now() >= endsAt.getTime() ? "expired" : "live";
  const options = optionsViewOf(c);
  const yesPool = options.find((o) => o.key === "yes")?.pool ?? 0;
  const noPool = options.find((o) => o.key === "no")?.pool ?? 0;
  return {
    id: null,
    postCode: c.postCode,
    question: c.question,
    labelYes: c.labelYes,
    labelNo: c.labelNo,
    accent: c.accent,
    status,
    endsAt: c.endsAtUtc,
    result: null,
    yesPool,
    noPool,
    betsCount: 0,
    oddsYes: oddsFor(0, 0),
    oddsNo: oddsFor(0, 0),
    options,
    exchange: cryoUsdcEnabled() ? "usdc" : "demo",
    db: dbOk,
  };
}

/**
 * Идемпотентное создание рынков из конфига. НЕ трогает существующие строки
 * (админские force-expire/resolution переживают пересоздание).
 * Авто-переход live→expired по времени — здесь же (лента читает часто).
 */
export async function ensureCryoMarkets(): Promise<boolean> {
  try {
    for (const c of CRYO.markets) {
      const endsAt = new Date(c.endsAtUtc);
      await db.cryoMarket.upsert({
        where: { postCode: c.postCode },
        create: {
          postCode: c.postCode,
          question: c.question,
          labelYes: c.labelYes,
          labelNo: c.labelNo,
          endsAt,
        },
        // presentation fields follow the config (labels are EN since task 43);
        // status/endsAt/result stay admin-owned — upsert never touches them
        update: { question: c.question, labelYes: c.labelYes, labelNo: c.labelNo },
      });

      // нарративные опции (task 44): идемпотентный upsert по (marketId, key);
      // порядок и подписи следуют конфигу, ставки не трогаются
      if (c.options) {
        const market = await db.cryoMarket.findUnique({
          where: { postCode: c.postCode },
          select: { id: true },
        });
        if (market) {
          for (let i = 0; i < c.options.length; i++) {
            const o = c.options[i];
            await db.cryoOption.upsert({
              where: { marketId_key: { marketId: market.id, key: o.key } },
              create: { marketId: market.id, key: o.key, label: o.label, idx: i },
              update: { label: o.label, idx: i },
            });
          }
        }
      }
    }
    // авто-expire: просроченные live-рынки закрываем на чтении
    await db.cryoMarket.updateMany({
      where: { status: "live", endsAt: { lte: new Date() } },
      data: { status: "expired" },
    });
    return true;
  } catch {
    return false;
  }
}

/** Публичный список рынков (+ позиция кошелька, если задан) */
export async function getCryoMarketViews(
  wallet?: string | null
): Promise<CryoMarketView[]> {
  const dbOk = await ensureCryoMarkets();
  if (!dbOk) {
    // деградация: конфиг-состояние без пулов
    return CRYO.markets.map((c) => configView(c, false));
  }

  const rows = await db.cryoMarket.findMany({
    where: { postCode: { in: CRYO.markets.map((m) => m.postCode) } },
    include: { bets: true, options: { orderBy: { idx: "asc" as const } } },
  });

  const mine = wallet
    ? await db.cryoBet.findMany({ where: { wallet: wallet.toLowerCase() } })
    : [];

  const mineByMarket = new Map(mine.map((b) => [b.marketId, b]));

  const byCode = new Map(rows.map((r) => [r.postCode, r]));
  const views: CryoMarketView[] = CRYO.markets.map((c) => {
    const row = byCode.get(c.postCode);
    if (!row) return configView(c, true); // upsert не дошёл — крайний случай

    // N-пульный пари-мьютюэль (task 44): пул/счётчик на КАЖДУЮ опцию
    const pools = new Map<string, { pool: number; count: number }>();
    for (const b of row.bets) {
      const amt = parseFloat(b.amount) || 0;
      const cur = pools.get(b.side) ?? { pool: 0, count: 0 };
      cur.pool += amt;
      cur.count += 1;
      pools.set(b.side, cur);
    }
    const total = [...pools.values()].reduce((s, p) => s + p.pool, 0);
    const betsCount = row.bets.length;

    // подписи опций: из БД (upsert синхронизирован с конфигом),
    // фолбэк — конфиг (деградация чтения опций)
    const options: CryoOptionView[] = (row.options.length > 0
      ? row.options.map((o) => ({ key: o.key, label: o.label }))
      : cryoOptionsOf(c).map((o) => ({ key: o.key, label: o.label }))
    ).map((o) => {
      const p = pools.get(o.key) ?? { pool: 0, count: 0 };
      return {
        ...o,
        pool: round2(p.pool),
        count: p.count,
        odds: oddsFor(total, p.pool),
        pct: total > 0 ? Math.round((p.pool / total) * 100) : 0,
      };
    });

    const mb = mineByMarket.get(row.id);

    // обратная совместимость: классические поля yes/no для старых потребителей
    const yesPool = round2(options.find((o) => o.key === "yes")?.pool ?? 0);
    const noPool = round2(options.find((o) => o.key === "no")?.pool ?? 0);

    return {
      id: row.id,
      postCode: row.postCode,
      question: row.question,
      labelYes: row.labelYes,
      labelNo: row.labelNo,
      accent: c.accent,
      status: row.status as CryoStatus,
      endsAt: row.endsAt.toISOString(),
      result: (row.result as CryoSide | null) ?? null,
      yesPool,
      noPool,
      betsCount,
      oddsYes: oddsFor(total, yesPool),
      oddsNo: oddsFor(total, noPool),
      options,
      exchange: cryoUsdcEnabled() ? "usdc" : "demo",
      db: true,
      myBet: mb ? mb.side : null,
      myPayout: mb?.payout ?? null,
      myClaimed: mb?.claimed ?? false,
    };
  });

  return views;
}

export interface PlaceBetResult {
  ok: boolean;
  status: number;
  error?: string;
  view?: CryoMarketView;
}

/**
 * Fix a position of ANY USDC amount (task 43): direct transfer to the
 * treasury, one position per wallet per market (unique(marketId, wallet)).
 *
 * phantom-mode: txSig is verified with a single RPC call (verify.ts) against
 * the STAKED amount; a hard fail (no money / failed tx) → 400, no position;
 * RPC unreachable → position stored with txSig (manual reconcile, UX intact).
 */
export async function placeCryoBet(args: {
  postCode: string;
  wallet: string;
  side: CryoSide; // ключ опции ("yes"/"no" или нарративный)
  amount: string; // USDC decimal string, validated below
  mode: "demo" | "phantom" | "bonus"; // bonus = free prediction (task 44)
  txSig?: string | null;
  betRef?: string | null;
}): Promise<PlaceBetResult> {
  const cfg = cryoMarketByCode(args.postCode);
  if (!cfg) return { ok: false, status: 404, error: "Unknown market" };
  // side — ключ одной из опций рынка (2–4 нарративных, включая yes/no)
  const optionKeys = cryoOptionsOf(cfg).map((o) => o.key);
  const side = (args.side ?? "").trim().toLowerCase();
  if (!optionKeys.includes(side)) {
    return { ok: false, status: 400, error: "Bad side" };
  }
  if (!args.wallet || args.wallet.length < 8 || args.wallet.length > 64) {
    return { ok: false, status: 400, error: "Bad wallet" };
  }
  // сумма: чистая decimal-строка в границах конфига (2 знака после точки)
  const amount = normalizeUsdc(args.amount ?? "");
  const min = parseFloat(CRYO.minBetUsdc);
  const max = parseFloat(CRYO.maxBetUsdc);
  if (!amount) {
    return { ok: false, status: 400, error: "Bad amount" };
  }
  const value = parseFloat(amount);
  if (!(value >= min - 1e-9 && value <= max + 1e-9)) {
    return {
      ok: false,
      status: 400,
      error: `Amount out of range — allowed $${CRYO.minBetUsdc}–$${CRYO.maxBetUsdc} USDC`,
    };
  }

  const dbOk = await ensureCryoMarkets();
  if (!dbOk) return { ok: false, status: 503, error: "DB unavailable" };

  try {
    const market = await db.cryoMarket.findUnique({
      where: { postCode: args.postCode },
    });
    if (!market) return { ok: false, status: 404, error: "Market not found" };
    if (market.status !== "live" || market.endsAt.getTime() <= Date.now()) {
      return { ok: false, status: 409, error: "Market is frozen shut" };
    }

    const dup = await db.cryoBet.findUnique({
      where: { marketId_wallet: { marketId: market.id, wallet: args.wallet.toLowerCase() } },
    });
    if (dup) return { ok: false, status: 409, error: "Position already fixed" };

    // phantom-режим без включённого USDC-канала или без транзакции — отклоняем
    if (args.mode === "phantom" && (!cryoUsdcEnabled() || !args.txSig)) {
      return { ok: false, status: 400, error: "Phantom payment unavailable" };
    }

    // USDC-верификация phantom-ставки (прямой перевод на сумму позиции)
    if (args.mode === "phantom" && args.txSig) {
      const v = await verifyUsdcBet({
        txSig: args.txSig,
        betRef: args.betRef ?? "",
        expectedUsdc: value,
      });
      if (!v.ok && v.reason === "tx") {
        return { ok: false, status: 400, error: "USDC transaction not verified" };
      }
      // reason === "rpc" → пишем позицию с txSig, разбор вручную
    }

    await db.cryoBet.create({
      data: {
        marketId: market.id,
        wallet: args.wallet.toLowerCase(),
        side,
        amount,
        mode: args.mode,
        txSig: args.txSig ?? null,
      },
    });

    // журналирование денежной операции (ТЗ §9: все денежные операции логировать)
    console.info(
      `[money-op] cryo bet fixed: market=${args.postCode} side=${side} amount=${amount} mode=${args.mode} wallet=${args.wallet.toLowerCase()} tx=${args.txSig ?? "-"}`
    );

    const views = await getCryoMarketViews(args.wallet);
    const view = views.find((v) => v.postCode === args.postCode);
    return { ok: true, status: 200, view };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return { ok: false, status: 409, error: "Position already fixed" };
    }
    return { ok: false, status: 503, error: "DB unavailable" };
  }
}

export interface ResolveResult {
  ok: boolean;
  status: number;
  error?: string;
  settled?: number;
  totalPool?: number;
  winningPool?: number;
}

/**
 * Вердикт оракула (Block 8 → Block 9): пари-мьютюэль расчистка на N пулов.
 * result — КЛЮЧ ОПЦИИ ("yes"/"no" или нарративный); выигравшим ставкам
 * (side === result) проставляется payout, остальные остаются с null.
 */
export async function resolveCryoMarket(
  postCode: string,
  result: CryoSide
): Promise<ResolveResult> {
  const cfg = cryoMarketByCode(postCode);
  if (!cfg) return { ok: false, status: 404, error: "Unknown market" };
  const optionKeys = cryoOptionsOf(cfg).map((o) => o.key);
  if (!optionKeys.includes(result)) {
    return { ok: false, status: 400, error: "Bad result — unknown option" };
  }
  const dbOk = await ensureCryoMarkets();
  if (!dbOk) return { ok: false, status: 503, error: "DB unavailable" };

  try {
    const market = await db.cryoMarket.findUnique({
      where: { postCode },
      include: { bets: true },
    });
    if (!market) return { ok: false, status: 404, error: "Market not found" };
    if (market.status === "resolved") {
      return { ok: false, status: 409, error: "Already resolved" };
    }

    const totalPool = round2(
      market.bets.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0)
    );
    const winningPool = market.bets
      .filter((b) => b.side === result)
      .reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const distributable = totalPool * (1 - CRYO.feePct);
    const winners = market.bets.filter((b) => b.side === result);

    await db.$transaction(async (tx) => {
      await tx.cryoMarket.update({
        where: { id: market.id },
        data: { status: "resolved", result, resolvedAt: new Date() },
      });
      for (const b of winners) {
        const share =
          winningPool > 0
            ? round2((distributable * (parseFloat(b.amount) || 0)) / winningPool)
            : 0;
        await tx.cryoBet.update({
          where: { id: b.id },
          data: { payout: share.toFixed(2) },
        });
      }
    });

    // журналирование расчистки (все денежные операции — в лог)
    console.info(
      `[money-op] cryo resolved: market=${postCode} result=${result} pool=${totalPool} winners=${winners.length} distributable=${distributable.toFixed(2)}`
    );

    // бейдж «seer» победителям за серию верных прогнозов (best-effort, task 44 §6)
    for (const b of winners) {
      await awardSeerBadge(b.wallet);
    }

    return { ok: true, status: 200, settled: market.bets.length, totalPool, winningPool: round2(winningPool) };
  } catch (e) {
    return { ok: false, status: 503, error: e instanceof Error ? e.message : "DB error" };
  }
}

/** Админ: досрочное замораживание терминала (Block 7, для теста и кураторства) */
export async function expireCryoMarket(
  postCode: string,
  inSec = 0
): Promise<ResolveResult> {
  const dbOk = await ensureCryoMarkets();
  if (!dbOk) return { ok: false, status: 503, error: "DB unavailable" };
  try {
    const market = await db.cryoMarket.findUnique({ where: { postCode } });
    if (!market) return { ok: false, status: 404, error: "Market not found" };
    if (market.status === "resolved") {
      return { ok: false, status: 409, error: "Already resolved" };
    }
    await db.cryoMarket.update({
      where: { id: market.id },
      data: { endsAt: new Date(Date.now() + inSec * 1000) },
    });
    return { ok: true, status: 200 };
  } catch (e) {
    return { ok: false, status: 503, error: e instanceof Error ? e.message : "DB error" };
  }
}

export interface ClaimResult {
  ok: boolean;
  status: number;
  error?: string;
  payout?: string;
}

/** Экстракция награды (Block 9): выплата по позиции победителя */
export async function claimCryoBet(
  postCode: string,
  wallet: string
): Promise<ClaimResult> {
  const dbOk = await ensureCryoMarkets();
  if (!dbOk) return { ok: false, status: 503, error: "DB unavailable" };
  try {
    const market = await db.cryoMarket.findUnique({ where: { postCode } });
    if (!market || market.status !== "resolved") {
      return { ok: false, status: 409, error: "Market is not resolved" };
    }
    const bet = await db.cryoBet.findUnique({
      where: { marketId_wallet: { marketId: market.id, wallet: wallet.toLowerCase() } },
    });
    if (!bet) return { ok: false, status: 404, error: "No position" };
    if (bet.claimed) return { ok: false, status: 409, error: "Already extracted" };
    const payout = parseFloat(bet.payout || "0");
    if (!(payout > 0)) return { ok: false, status: 409, error: "Position dissolved" };

    await db.cryoBet.update({
      where: { id: bet.id },
      data: { claimed: true, claimedAt: new Date() },
    });
    return { ok: true, status: 200, payout: payout.toFixed(2) };
  } catch (e) {
    return { ok: false, status: 503, error: e instanceof Error ? e.message : "DB error" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PnL кошелька (task 42, пункт 8): все позиции кошелька + итоги.
   Читается страницей /pnl; claim идёт через существующий claimCryoBet.
   ═══════════════════════════════════════════════════════════════════ */

export interface CryoPnlItem {
  postCode: string;
  question: string;
  labelYes: string;
  labelNo: string;
  /** подпись исхода по ключу опции (task 44: нарративные рынки) */
  optionLabel: string;
  accent: string;
  side: CryoSide;
  amount: string;
  /** live | expired | resolved */
  status: CryoStatus;
  result: CryoSide | null;
  payout: string | null;
  claimed: boolean;
  mode: string;
  createdAt: string;
  endsAt: string;
}

export interface CryoPnlSummary {
  wallet: string;
  staked: number;
  positions: number;
  open: number;
  won: number;
  lost: number;
  claimable: number;
  claimed: number;
  /** claimed + claimable − staked (по всем позициям кошелька) */
  net: number;
  items: CryoPnlItem[];
}

export async function getCryoPnl(
  wallet: string
): Promise<CryoPnlSummary | null> {
  const w = wallet.trim().toLowerCase();
  if (!w) return null;
  const dbOk = await ensureCryoMarkets();
  if (!dbOk) return null;

  const bets = await db.cryoBet.findMany({
    where: { wallet: w },
    orderBy: { createdAt: "desc" },
  });
  const markets = await db.cryoMarket.findMany({
    where: { postCode: { in: CRYO.markets.map((m) => m.postCode) } },
    include: { options: { orderBy: { idx: "asc" as const } } },
  });
  const byId = new Map(markets.map((m) => [m.id, m]));

  const items: CryoPnlItem[] = [];
  let staked = 0;
  let claimable = 0;
  let claimedSum = 0;
  let open = 0;
  let won = 0;
  let lost = 0;

  for (const b of bets) {
    const m = byId.get(b.marketId);
    const cfg = m ? cryoMarketByCode(m.postCode) : undefined;
    const amount = parseFloat(b.amount) || 0;
    const payout = parseFloat(b.payout || "0") || 0;
    staked += amount;
    const resolvedWithResult = m?.status === "resolved" && m.result;
    if (resolvedWithResult) {
      if (payout > 0) won += 1;
      else lost += 1;
      if (payout > 0 && !b.claimed) claimable += payout;
      if (payout > 0 && b.claimed) claimedSum += payout;
    } else {
      open += 1;
    }
    items.push({
      postCode: m?.postCode ?? b.marketId,
      question: m?.question ?? cfg?.question ?? "—",
      labelYes: m?.labelYes ?? cfg?.labelYes ?? "YES",
      labelNo: m?.labelNo ?? cfg?.labelNo ?? "NO",
      // подпись исхода: нарративная опция по ключу; фолбэк — классика yes/no
      optionLabel:
        (cfg
          ? cryoOptionsOf(cfg).find((o) => o.key === b.side)?.label
          : undefined) ??
        m?.options.find((o) => o.key === b.side)?.label ??
        (b.side === "yes"
          ? m?.labelYes ?? cfg?.labelYes ?? "YES"
          : b.side === "no"
            ? m?.labelNo ?? cfg?.labelNo ?? "NO"
            : b.side),
      accent: cfg?.accent ?? "#5b9bd5",
      side: b.side as CryoSide,
      amount: b.amount,
      status: (m?.status as CryoStatus | undefined) ?? "live",
      result: (m?.result as CryoSide | null) ?? null,
      payout: b.payout,
      claimed: b.claimed,
      mode: b.mode,
      createdAt: b.createdAt.toISOString(),
      endsAt: (m?.endsAt ?? new Date()).toISOString(),
    });
  }

  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    wallet: w,
    staked: round2(staked),
    positions: bets.length,
    open,
    won,
    lost,
    claimable: round2(claimable),
    claimed: round2(claimedSum),
    net: round2(claimedSum + claimable - staked),
    items,
  };
}
