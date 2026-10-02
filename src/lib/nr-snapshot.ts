import "server-only";

import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  betWeightMilli,
  decayMilliFor,
  distributeGamePack,
  authorQualifies,
  finalWeightMilli,
  snapshotParams,
  seasonSupply,
  MIN_CORRECT_ROUNDS,
  type PlayerWeight,
} from "@/lib/nr";
import { BET } from "@/lib/bet/config";

/**
 * v14 — снапшот сезона для раздачи $NR (ТЗ §Раздача $NR).
 *
 *   weight = sum(stake × time_decay) по ВЕРНЫМ ставкам
 *     - первые 5с окна ×1, середина ×0.4, последние 5с ×0;
 *     - неверный колл — 0; кеп ставки в весе 50 EYE;
 *     - ноль, если верных раундов < 20;
 *     - кеп аккаунта 2% игровой пачки, выше сгорает;
 *     - раунд без верного колла сжигает свою долю (вес не даёт никому);
 *     - пачки и revshare в вес НЕ входят (инвойс не пишет вес).
 *
 *   Доли: 75% игрокам · 15% авторам клипов (банк к закрытию не дальше
 *   60/40) · 10% в следующий сезон.
 *
 *   До клейма публичны ранг и число ранних верных коллов — не монеты.
 */

export interface SnapshotPlayer {
  accountId: string;
  displayName: string;
  telegramId: string;
  correctRounds: number;
  earlyCorrect: number;
  /** вес в EYE (суммарный, после капов) */
  weightEye: number;
  /** $NR к клейму (после 2% кепа) */
  amountNr: number;
  rank: number;
}

export interface SnapshotAuthor {
  handle: string;
  clips: number;
  /** суммарный банк qualifying-раундов, EYE */
  bankEye: number;
  amountNr: number;
}

export interface SeasonArtifact {
  season: { code: string; startsAt: string; endsAt: string };
  params: ReturnType<typeof snapshotParams>;
  players: SnapshotPlayer[];
  authors: SnapshotAuthor[];
  totals: {
    playersNr: number;
    authorsNr: number;
    nextSeasonNr: number;
    burnedNr: number;
    qualifyingClips: number;
    burnedRounds: number;
  };
}

/** агрегат won-ставок сезона по аккаунтам (вес — из Bet.weightMilli) */
export async function collectPlayers(season: {
  startsAt: Date;
  endsAt: Date;
}): Promise<PlayerWeight[]> {
  const bets = await db.bet.findMany({
    where: {
      createdAt: { gte: season.startsAt, lt: season.endsAt },
      status: "won",
      accountId: { not: null },
    },
    select: {
      accountId: true,
      roundId: true,
      amountCents: true,
      betSec: true,
      weightMilli: true,
      createdAt: true,
    },
  });

  const byAcc = new Map<string, Map<string, number>>();
  for (const b of bets) {
    const acc = b.accountId!;
    if (!byAcc.has(acc)) byAcc.set(acc, new Map());
    const rounds = byAcc.get(acc)!;
    /* верные РАУНДЫ считаем по distinct roundId */
    rounds.set(b.roundId, (rounds.get(b.roundId) ?? 0) + 1);
  }

  const out: PlayerWeight[] = [];
  for (const [accountId, rounds] of byAcc) {
    let weightMilli = 0;
    let earlyCorrect = 0;
    for (const b of bets) {
      if (b.accountId !== accountId) continue;
      const betSec =
        b.betSec ??
        Math.max(0, Math.round((b.createdAt.getTime() - season.startsAt.getTime()) / 1000));
      const w =
        b.weightMilli ??
        betWeightMilli(b.amountCents, betSec, BET.windowSec);
      weightMilli += w;
      if (decayMilliFor(betSec, BET.windowSec) === 1000) earlyCorrect++;
    }
    out.push({
      accountId,
      correctRounds: rounds.size,
      earlyCorrect,
      weightMilli,
    });
  }
  return out;
}

/** авторские доли: клипы сезона с банком не дальше 60/40 */
export async function collectAuthors(season: {
  startsAt: Date;
  endsAt: Date;
}): Promise<SnapshotAuthor[]> {
  const params = snapshotParams(seasonSupply());
  const clips = await db.clip.findMany({
    where: { status: "resolved", resolvedAt: { gte: season.startsAt, lt: season.endsAt } },
    select: { id: true, authorHandle: true },
  });

  const agg = new Map<string, { clips: number; bankEye: number }>();
  let qualifying = 0;
  for (const c of clips) {
    if (!c.authorHandle) continue;
    const round = await db.round.findFirst({
      where: { clipCode: c.id, status: "resolved" },
      orderBy: { resolvedAt: "desc" },
      select: { poolRealCents: true, poolSynthCents: true },
    });
    if (!round) continue;
    if (!authorQualifies(round.poolRealCents, round.poolSynthCents)) continue;
    qualifying++;
    const bank = round.poolRealCents + round.poolSynthCents;
    const key = c.authorHandle;
    const prev = agg.get(key) ?? { clips: 0, bankEye: 0 };
    agg.set(key, { clips: prev.clips + 1, bankEye: prev.bankEye + bank });
  }

  const totalBank = [...agg.values()].reduce((s, v) => s + v.bankEye, 0);
  const authors: SnapshotAuthor[] = [];
  for (const [handle, v] of agg) {
    authors.push({
      handle,
      clips: v.clips,
      bankEye: v.bankEye,
      amountNr: totalBank > 0 ? Math.floor((params.authorsPack * v.bankEye) / totalBank) : 0,
    });
  }
  authors.sort((a, b) => b.bankEye - a.bankEye);
  void qualifying;
  return authors;
}

/** полный артефакт снапшота (JSON для админки + источник CSV/merkle) */
export async function buildSeasonArtifact(season: {
  code: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<SeasonArtifact> {
  const params = snapshotParams(seasonSupply());
  const playersRaw = await collectPlayers(season);

  const enriched = playersRaw.map((p) => ({
    ...p,
    finalMilli: finalWeightMilli(p),
  }));
  const amounts = distributeGamePack(enriched, params.gamePack, params.accountCap);

  const withNames = await db.account.findMany({
    where: { id: { in: enriched.map((e) => e.accountId) } },
    select: { id: true, displayName: true, tgUsername: true, telegramId: true },
  });
  const nameOf = new Map(
    withNames.map((a) => [a.id, a.displayName || (a.tgUsername ? `@${a.tgUsername}` : "")]),
  );
  const tgOf = new Map(withNames.map((a) => [a.id, a.telegramId ?? ""]));

  const players: SnapshotPlayer[] = enriched
    .map((e) => ({
      accountId: e.accountId,
      displayName: nameOf.get(e.accountId) || "",
      telegramId: tgOf.get(e.accountId) || "",
      correctRounds: e.correctRounds,
      earlyCorrect: e.earlyCorrect,
      weightEye: Math.round(e.finalMilli / 1000),
      amountNr: amounts.get(e.accountId) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.weightEye - a.weightEye || a.accountId.localeCompare(b.accountId))
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const authors = await collectAuthors(season);

  /* раунды без верного колла сжигают свою долю (учёт для отчёта) */
  const roundsTotal = await db.round.count({
    where: { status: "resolved", resolvedAt: { gte: season.startsAt, lt: season.endsAt } },
  });
  const roundsWithWinners = await db.round.findMany({
    where: { status: "resolved", resolvedAt: { gte: season.startsAt, lt: season.endsAt } },
    select: { _count: { select: { bets: true } } },
  });
  const burnedRounds = roundsTotal - roundsWithWinners.filter((r) => r._count.bets > 0).length;

  const playersNr = players.reduce((s, p) => s + p.amountNr, 0);
  const authorsNr = authors.reduce((s, a) => s + a.amountNr, 0);

  return {
    season: {
      code: season.code,
      startsAt: season.startsAt.toISOString(),
      endsAt: season.endsAt.toISOString(),
    },
    params,
    players,
    authors,
    totals: {
      playersNr,
      authorsNr,
      nextSeasonNr: params.nextSeasonCarry,
      burnedNr: Math.max(0, params.gamePack - playersNr),
      qualifyingClips: authors.reduce((s, a) => s + a.clips, 0),
      burnedRounds,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Merkle (sha256 double-hash, листья отсортированы)                  */
/* ------------------------------------------------------------------ */

export interface MerkleLeaf {
  address: string;
  amount: number;
  proof: string[];
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  return createHash("sha256")
    .update(Buffer.compare(a, b) <= 0 ? Buffer.concat([a, b]) : Buffer.concat([b, a]))
    .digest();
}

function leafHash(address: string, amount: number): Buffer {
  return createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from(address.toLowerCase().replace(/^0x/, ""), "hex"),
        Buffer.from(BigInt(amount).toString(16).padStart(64, "0"), "hex"),
      ])
    )
    .digest();
}

/**
 * Строит merkle-дерево клейма. Лист = sha256(address ++ amount(uint256be)).
 * Требует адрес для каждого игрока с amount > 0 (адреса собираются на
 * домене после снапшота). Возвращает root + proofs.
 */
export function buildMerkle(
  entries: Array<{ accountId: string; address: string; amount: number }>
): { root: string; leaves: MerkleLeaf[] } {
  const valid = entries
    .filter((e) => /^0x[a-fA-F0-9]{40}$/.test(e.address) && e.amount > 0)
    .map((e) => ({ ...e, address: e.address.toLowerCase() }));
  if (valid.length === 0) return { root: "", leaves: [] };

  const nodes = new Map<number, Map<number, Buffer>>(); // level → index → hash
  const level0 = valid.map((e) => leafHash(e.address, e.amount));
  nodes.set(0, new Map(level0.map((h, i) => [i, h])));

  let level = 0;
  while (nodes.get(level)!.size > 1) {
    const cur = nodes.get(level)!;
    const next = new Map<number, Buffer>();
    for (let i = 0; i < Math.ceil(cur.size / 2); i++) {
      const a = cur.get(i * 2)!;
      const b = cur.get(i * 2 + 1) ?? a; // нечётный — дублируем
      next.set(i, hashPair(a, b));
    }
    level++;
    nodes.set(level, next);
  }

  const leaves: MerkleLeaf[] = valid.map((e, i) => {
    const proof: string[] = [];
    let idx = i;
    for (let l = 0; l < level; l++) {
      const cur = nodes.get(l)!;
      const sibIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      const sib = cur.get(sibIdx) ?? cur.get(idx)!;
      proof.push(sib.toString("hex"));
      idx = Math.floor(idx / 2);
    }
    return { address: e.address, amount: e.amount, proof };
  });

  return { root: nodes.get(level)!.get(0)!.toString("hex"), leaves };
}

/** CSV снапшота (артефакт для BD; монеты НЕ публикуются на сайте) */
export function artifactCsv(a: SeasonArtifact): string {
  const head = "rank,accountId,telegramId,displayName,correctRounds,earlyCorrect,weightEye,amountNr";
  const body = a.players
    .map((p) =>
      [
        p.rank,
        p.accountId,
        p.telegramId,
        p.displayName,
        p.correctRounds,
        p.earlyCorrect,
        p.weightEye,
        p.amountNr,
      ]
        .map((v) => `"${String(v)}"`)
        .join(","),
    )
    .join("\n");
  const authorsHead = "\nhandle,clips,bankEye,amountNr";
  const authorsBody = a.authors
    .map((x) => `"${x.handle}",${x.clips},${x.bankEye},${x.amountNr}`)
    .join("\n");
  return `${head}\n${body}\n${authorsHead}\n${authorsBody}\n`;
}

export { MIN_CORRECT_ROUNDS };
export { finalWeightMilli };
