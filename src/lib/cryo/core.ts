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
import { CRYO, cryoMarketByCode, type CryoMarketConfigItem } from "./config";

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
  /** режим обмена Block 5: jupiter — реальный свап, demo — protected-симуляция */
  exchange: "demo" | "jupiter";
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
    exchange: CRYO.jupiterOutputMint ? "jupiter" : "demo",
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
      exchange: CRYO.jupiterOutputMint ? "jupiter" : "demo",
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
 * Фикс позиции $1 USDC (Block 5). Одна позиция на кошелёк на рынок
 * (unique(marketId, wallet)) — повторный тап по кристаллу невозможен
 * на уровне БД.
 */
export async function placeCryoBet(args: {
  postCode: string;
  wallet: string;
  side: CryoSide;
  mode: "demo" | "phantom";
  txSig?: string | null;
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
