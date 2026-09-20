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
import { CRYO, cryoMarketByCode, cryoUsdcEnabled, type CryoMarketConfigItem } from "./config";
import { verifyUsdcBet } from "./verify";

export type CryoSide = "yes" | "no";
export type CryoStatus = "live" | "expired" | "resolved";

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
  // ставка фикс $1: payout = (total+1)×(1−fee)×1/(pool+1)
  const payout = (total + 1) * (1 - CRYO.feePct) / (sidePool + 1);
  return round2(payout);
}

/** Конфиг-view без БД (деградация) */
function configView(c: CryoMarketConfigItem, dbOk: boolean): CryoMarketView {
  const endsAt = new Date(c.endsAtUtc);
  const status: CryoStatus = Date.now() >= endsAt.getTime() ? "expired" : "live";
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
    yesPool: 0,
    noPool: 0,
    betsCount: 0,
    oddsYes: oddsFor(0, 0),
    oddsNo: oddsFor(0, 0),
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
        update: {}, // существующий рынок не перезаписываем
      });
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
    include: { bets: true },
  });

  const mine = wallet
    ? await db.cryoBet.findMany({ where: { wallet: wallet.toLowerCase() } })
    : [];

  const mineByMarket = new Map(mine.map((b) => [b.marketId, b]));

  const byCode = new Map(rows.map((r) => [r.postCode, r]));
  const views: CryoMarketView[] = CRYO.markets.map((c) => {
    const row = byCode.get(c.postCode);
    if (!row) return configView(c, true); // upsert не дошёл — крайний случай

    let yes = 0;
    let no = 0;
    for (const b of row.bets) {
      const amt = parseFloat(b.amount) || 0;
      if (b.side === "yes") yes += amt;
      else no += amt;
    }
    const total = yes + no;
    const mb = mineByMarket.get(row.id);

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
      yesPool: round2(yes),
      noPool: round2(no),
      betsCount: row.bets.length,
      oddsYes: oddsFor(total, yes),
      oddsNo: oddsFor(total, no),
      exchange: cryoUsdcEnabled() ? "usdc" : "demo",
      db: true,
      myBet: mb ? (mb.side as CryoSide) : null,
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
 * Фикс позиции $1 USDC (Block 5, упрощённо: прямой перевод на казначея).
 * Одна позиция на кошелёк на рынок (unique(marketId, wallet)) — повторный
 * тап по кристаллу невозможен на уровне БД.
 *
 * phantom-режим: txSig верифицируется одним RPC-вызовом (verify.ts).
 *  - жёсткий провал проверки (нет денег/неуспешна) → 400, позиция НЕ пишется;
 *  - RPC недоступен → позиция пишется с txSig (ручной reconcile, UX не рвём).
 */
export async function placeCryoBet(args: {
  postCode: string;
  wallet: string;
  side: CryoSide;
  mode: "demo" | "phantom";
  txSig?: string | null;
  betRef?: string | null;
}): Promise<PlaceBetResult> {
  const cfg = cryoMarketByCode(args.postCode);
  if (!cfg) return { ok: false, status: 404, error: "Unknown market" };
  if (args.side !== "yes" && args.side !== "no") {
    return { ok: false, status: 400, error: "Bad side" };
  }
  if (!args.wallet || args.wallet.length < 8 || args.wallet.length > 64) {
    return { ok: false, status: 400, error: "Bad wallet" };
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

    // USDC-верификация phantom-ставки (упрощённый канал: прямой перевод)
    if (args.mode === "phantom" && args.txSig) {
      const v = await verifyUsdcBet({
        txSig: args.txSig,
        betRef: args.betRef ?? "",
        expectedUsdc: parseFloat(CRYO.betAmountUsdc),
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
        side: args.side,
        amount: CRYO.betAmountUsdc,
        mode: args.mode,
        txSig: args.txSig ?? null,
      },
    });

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
 * Вердикт оракула (Block 8 → Block 9): пари-мьютюэль расчистка.
 * Выигравшим ставкам проставляется payout, проигравшие остаются с null.
 */
export async function resolveCryoMarket(
  postCode: string,
  result: CryoSide
): Promise<ResolveResult> {
  if (result !== "yes" && result !== "no") {
    return { ok: false, status: 400, error: "Bad result" };
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

    const yes = market.bets.filter((b) => b.side === "yes");
    const no = market.bets.filter((b) => b.side === "no");
    const yesPool = yes.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const noPool = no.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const totalPool = round2(yesPool + noPool);
    const winningPool = result === "yes" ? yesPool : noPool;
    const distributable = totalPool * (1 - CRYO.feePct);

    await db.$transaction(async (tx) => {
      await tx.cryoMarket.update({
        where: { id: market.id },
        data: { status: "resolved", result, resolvedAt: new Date() },
      });
      const winners = result === "yes" ? yes : no;
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

    return { ok: true, status: 200, settled: market.bets.length, totalPool, winningPool };
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
      labelYes: m?.labelYes ?? cfg?.labelYes ?? "ДА",
      labelNo: m?.labelNo ?? cfg?.labelNo ?? "НЕТ",
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
