import { createHash } from "crypto";
import { db } from "@/lib/db";
import { REFERRAL } from "@/lib/site";

/* ================================================================
   Реферальная модель «no reality.» — MVP.

   Код приглашения детерминирован от кошелька: sha256(wallet+salt)
   → "r" + 9 символов base36. Один кошелёк = один код навсегда
   (без БД: код можно получить и на сервере из cookie-кошелька).

   Атрибуция не зависит от нашей БД: код вшивается в orderId
   (pd-<id>-<ref>), а orderId хранится у 2328.io в самом платеже.
   БД (best-effort) — только удобный реестр для выплат админом.
   ================================================================ */

export const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/** соль деривации кода: сменишь — все коды переедут на новые значения */
const REF_SALT = process.env.REFERRAL_SALT || "no-reality-ref-v1";

/** код: строчные латиница/цифры, 6–12 символов, начинается с "r" */
export const REF_CODE_RE = /^r[a-z0-9]{5,11}$/;

/** детерминированный пригласительный код кошелька */
export function deriveRefCode(wallet: string): string {
  const h = createHash("sha256")
    .update(`${wallet.toLowerCase()}:${REF_SALT}`)
    .digest("hex");
  const B36 = BigInt(36);
  let n = BigInt("0x" + h.slice(0, 20)); // 80 бит — коллизии невероятны
  const abc = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 9; i++) {
    s += abc[Number(n % B36)];
    n /= B36;
  }
  return `r${s}`;
}

/** нормализация пришедшего снаружи ?ref=: null, если не похож на код */
export function normalizeRefCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return REF_CODE_RE.test(code) ? code : null;
}

/** pd-<id>[-<ref>] → { baseId, refCode } */
export function splitOrderId(orderId: string): {
  baseId: string;
  refCode: string | null;
} {
  const m = /^pd-([A-Za-z0-9]+?)(?:-([a-z0-9]{6,12}))?$/.exec(orderId);
  if (!m) return { baseId: orderId, refCode: null };
  return { baseId: m[1], refCode: m[2] ?? null };
}

/** доля рефереру (env REFERRAL_RATE_PCT перекрывает дефолт) */
export function referralRatePct(): number {
  const v = Number(process.env.REFERRAL_RATE_PCT);
  return Number.isFinite(v) && v > 0 && v < 1 ? v : REFERRAL.defaultRatePct;
}

/** "100.00" × rate → "20.00" (строки — как 2328.io любит) */
export function payoutFor(amountUsdt: string): string {
  const rate = referralRatePct();
  return (Number(amountUsdt) * rate).toFixed(2);
}

/* ---------------- best-effort реестр в БД ---------------- */

/** кошелёк → код (upsert). null = БД недоступна (не страшно) */
export async function upsertReferralProfile(
  wallet: string
): Promise<string | null> {
  const w = wallet.toLowerCase();
  const code = deriveRefCode(w);
  try {
    await db.referralProfile.upsert({
      where: { wallet: w },
      create: { wallet: w, code },
      update: {},
    });
    return code;
  } catch {
    return null; // serverless: БД может быть недоступна — код всё равно валиден
  }
}

/** запись события в реестр. null = БД недоступна (атрибуция живёт в orderId) */
export async function recordReferralEvent(e: {
  orderId: string;
  refCode: string;
  kind: "checkout" | "paid";
  amountUsdt?: string;
}): Promise<boolean> {
  try {
    await db.referralEvent.upsert({
      where: { orderId: e.orderId },
      create: {
        orderId: e.orderId,
        refCode: e.refCode,
        kind: e.kind,
        amountUsdt: e.amountUsdt ?? null,
        payoutUsdt:
          e.kind === "paid" && e.amountUsdt
            ? payoutFor(e.amountUsdt)
            : null,
      },
      update: e.kind === "paid" ? { kind: "paid", amountUsdt: e.amountUsdt, payoutUsdt: e.amountUsdt ? payoutFor(e.amountUsdt) : null } : {},
    });
    return true;
  } catch {
    return false;
  }
}

/* ================================================================
   v14 — рефералка аккаунтов (ТЗ §Рефка).
   Ссылка есть у всех с регистрации: https://no-reality.fun/?ref=код.
   До оплаты на ней «процент выключен»; инвойс rev-<accountId> ровно
   3 USDT, один раз, paid ставит revshare. Самоприглашение не пишется.
   Процент — 20% от каждой ПАЧКИ реферала, в USDT; из очков не меняется,
   под EYE не допечатывается. Выплата от 5 USDT, иначе копится.
   ================================================================ */

import { randomBytes } from "crypto";

/** детерминированный код аккаунта: r + 9 символов base36 от sha256(id+salt) */
export function deriveAccountRefCode(accountId: string): string {
  const h = createHash("sha256")
    .update(`acc:${accountId}:${REF_SALT}`)
    .digest("hex");
  const B36 = BigInt(36);
  let n = BigInt("0x" + h.slice(0, 20));
  const abc = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 9; i++) {
    s += abc[Number(n % B36)];
    n /= B36;
  }
  return `r${s}`;
}

/** ссылка пригласившего (код аккаунта) */
export function refLinkOf(code: string): string {
  return `${process.env.PUBLIC_BASE_URL || "https://no-reality.fun"}/?ref=${code}`;
}

/** гарантированный код аккаунта (лениво для старых аккаунтов) */
export async function ensureRefCode(accountId: string): Promise<string> {
  const acc = await db.account.findUnique({
    where: { id: accountId },
    select: { refCode: true },
  });
  if (acc?.refCode) return acc.refCode;
  const code = deriveAccountRefCode(accountId);
  try {
    const set = await db.account.updateMany({
      where: { id: accountId, refCode: null },
      data: { refCode: code },
    });
    if (set.count === 0) {
      /* уже выдан (гонка) или конфликт unique — перечитаем */
    }
    return code;
  } catch {
    /* гонка/занят код — перечитаем */
    const fresh = await db.account.findUnique({
      where: { id: accountId },
      select: { refCode: true },
    });
    return fresh?.refCode ?? code;
  }
}

/**
 * Атрибуция при регистрации: пригласивший = владелец кода.
 * Самоприглашение (свой код) НЕ пишется; повторная атрибуция не меняется.
 * @returns код пригласившего (если записан) | null
 */
export async function attributeReferral(
  accountId: string,
  rawRef: unknown
): Promise<string | null> {
  const code = normalizeRefCode(rawRef);
  if (!code) return null;
  try {
    const inviter = await db.account.findUnique({
      where: { refCode: code },
      select: { id: true },
    });
    if (!inviter || inviter.id === accountId) return null; // самоприглашение не пишется
    const me = await db.account.findUnique({
      where: { id: accountId },
      select: { referredById: true },
    });
    if (me?.referredById) return null; // атрибуция одноразовая
    await db.account.update({
      where: { id: accountId },
      data: { referredById: inviter.id },
    });
    return code;
  } catch {
    return null;
  }
}

/** статистика по ссылке: заработано/сгорело/выплачено + выигрыши рефералов в EYE */
export async function refStatsOf(accountId: string) {
  await ensureRefCode(accountId).catch(() => null);
  const me = await db.account.findUnique({
    where: { id: accountId },
    select: {
      refCode: true,
      revshare: true,
      refEarnedCents: true,
      refBurnedCents: true,
      refPaidCents: true,
    },
  });
  if (!me) return null;
  const referrals = await db.account.findMany({
    where: { referredById: accountId },
    select: {
      id: true,
      displayName: true,
      tgUsername: true,
    },
    take: 100,
    orderBy: { createdAt: "asc" },
  });
  /* «Выигрыш реферала в EYE показывать на ссылке цифрой» — сумма bet_payout
     леджера реферала; в доллары НЕ переводим и под процент не допечатываем */
  const ids = referrals.map((r) => r.id);
  const wonRows = ids.length
    ? await db.ledgerTxn.groupBy({
        by: ["accountId"],
        where: { accountId: { in: ids }, kind: "bet_payout" },
        _sum: { delta: true },
      })
    : [];
  const wonMap = new Map(wonRows.map((w) => [w.accountId, w._sum.delta ?? 0]));
  return {
    code: me.refCode,
    link: me.refCode ? refLinkOf(me.refCode) : null,
    revshare: me.revshare,
    earnedUsdtCents: me.refEarnedCents,
    burnedUsdtCents: me.refBurnedCents,
    paidUsdtCents: me.refPaidCents,
    pendingUsdtCents: Math.max(0, me.refEarnedCents - me.refPaidCents),
    referrals: referrals.map((r) => ({
      name: r.displayName || (r.tgUsername ? `@${r.tgUsername}` : "player"),
      eyeWon: wonMap.get(r.id) ?? 0,
    })),
  };
}

/** порог выплаты, USDT-центы */
export const REF_PAYOUT_THRESHOLD_CENTS = 500;

/** nonce для идемпотентности выплат (не часть ТЗ-формата order_id) */
export function payoutNonce(): string {
  return randomBytes(4).toString("hex");
}
