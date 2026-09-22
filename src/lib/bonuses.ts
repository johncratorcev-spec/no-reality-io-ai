import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";

/* ================================================================
   Виральные бонусы (task 44, ТЗ §6).

   При ПЕРВОМ успешном входе (wallet или Magic Link):
     - welcome-бонус: бесплатные прогнозы без риска (bonusCredits);
     - приглашённый по ?ref получает +1 сверху, пригласивший +1 тоже
       (реферальный бонус обеим сторонам, поверх ReferralEvent);
     - бейдж «early» первым BONUS.earlyBadgeLimit профилям (Early Creator);
     - бейдж «seer» за серию верных прогнозов (Провидец).

   Все начисления/списания — через этот модуль и только в БД;
   каждая операция журналируется [money-op] (ТЗ §9).
   Флаг FEATURE_BONUSES=0 выключает начисления (профили живут —
   реферальные коды и статистика не завязаны на бонусы).
   ================================================================ */

export const BONUS = {
  /** welcome: сколько бесплатных прогнозов при первом входе */
  welcomeCredits: 2,
  /** бонус пригласившему при его первом входе приглашённого */
  referrerCredits: 1,
  /** доп. бонус самому приглашённому (сверху welcome) */
  inviteeCredits: 1,
  /** первые N профилей получают бейдж early (Early Creator) */
  earlyBadgeLimit: 100,
  /** серия верных прогнозов для бейджа seer (Провидец) */
  seerStreak: 2,
  /** номинал одной бесплатной ставки (USDC, в границах min/max конфига) */
  bonusStakeUsdc: "1.00",
} as const;

export interface EnsureProfileResult {
  created: boolean;
  bonusCredits: number;
  badges: string[];
}

function parseBadges(raw: string): string[] {
  try {
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function readProfile(wallet: string): Promise<EnsureProfileResult | null> {
  const prof = await db.userProfile.findUnique({ where: { wallet } });
  if (!prof) return null;
  return {
    created: false,
    bonusCredits: prof.bonusCredits,
    badges: parseBadges(prof.badges),
  };
}

/**
 * Гарантирует профиль кошелька. Возвращает создан ли он только что
 * (нужен auth-роутам, чтобы показать welcome-модалку/тост).
 * null — БД недоступна (бонусы пропускаются, вход живёт).
 */
export async function ensureUserProfile(
  wallet: string,
  invitedBy?: string | null
): Promise<EnsureProfileResult | null> {
  const w = wallet.toLowerCase();
  try {
    const existing = await readProfile(w);
    if (existing) return existing;

    if (!FEATURES.bonuses) {
      await db.userProfile.create({
        data: { wallet: w, bonusCredits: 0, invitedBy: invitedBy ?? null },
      });
      return { created: true, bonusCredits: 0, badges: [] };
    }

    // early-бейдж: считаем профили ДО создания (гонка в пределе ±1 — ок)
    const totalBefore = await db.userProfile.count();
    const badges: string[] = [];
    if (totalBefore + 1 <= BONUS.earlyBadgeLimit) badges.push("early");

    const credits =
      BONUS.welcomeCredits + (invitedBy ? BONUS.inviteeCredits : 0);

    await db.userProfile.create({
      data: {
        wallet: w,
        bonusCredits: credits,
        badges: JSON.stringify(badges),
        invitedBy: invitedBy ?? null,
      },
    });
    console.info(
      `[money-op] bonus grant (welcome): wallet=${w} credits=${credits} badges=[${badges.join(",")}] invitedBy=${invitedBy ?? "-"}`
    );

    // реферальный бонус ОБЕИМ сторонам (ТЗ §6) — best-effort
    if (invitedBy) await grantReferrerCredits(invitedBy);

    return { created: true, bonusCredits: credits, badges };
  } catch {
    return null;
  }
}

/** бонус пригласившему: профиль по ReferralProfile.code */
async function grantReferrerCredits(inviterCode: string): Promise<void> {
  try {
    const prof = await db.referralProfile.findUnique({
      where: { code: inviterCode },
      select: { wallet: true },
    });
    if (!prof) return;
    if (!FEATURES.bonuses) return;
    await db.userProfile.upsert({
      where: { wallet: prof.wallet },
      create: { wallet: prof.wallet, bonusCredits: BONUS.referrerCredits },
      update: { bonusCredits: { increment: BONUS.referrerCredits } },
    });
    console.info(
      `[money-op] bonus grant (referral): referrer=${prof.wallet} code=${inviterCode} credits=+${BONUS.referrerCredits}`
    );
  } catch {
    /* реферальный бонус best-effort */
  }
}

/**
 * Списать один бесплатный прогноз. false — кредитов нет / БД недоступна /
 * флаг выключен. Ставка в режиме bonus НЕ требует on-chain платежа.
 */
export async function spendBonusCredit(wallet: string): Promise<boolean> {
  if (!FEATURES.bonuses) return false;
  const w = wallet.toLowerCase();
  try {
    const prof = await db.userProfile.findUnique({ where: { wallet: w } });
    if (!prof || prof.bonusCredits <= 0) return false;
    await db.userProfile.update({
      where: { wallet: w },
      data: { bonusCredits: { decrement: 1 } },
    });
    console.info(
      `[money-op] bonus credit used: wallet=${w} left=${prof.bonusCredits - 1}`
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Бейдж «seer» (Провидец): вызывается из resolveCryoMarket для каждого
 * победителя. Серия = последние BONUS.seerStreak resolved-позиции кошелька
 * все выигрышные. Best-effort: сбой не должен ронять расчистку пула.
 */
export async function awardSeerBadge(wallet: string): Promise<void> {
  if (!FEATURES.bonuses) return;
  const w = wallet.toLowerCase();
  try {
    const prof = await db.userProfile.findUnique({ where: { wallet: w } });
    if (!prof) return;
    const badges = parseBadges(prof.badges);
    if (badges.includes("seer")) return;

    const bets = await db.cryoBet.findMany({
      where: { wallet: w, payout: { not: null } },
      orderBy: { createdAt: "desc" },
      take: BONUS.seerStreak,
    });
    if (bets.length < BONUS.seerStreak) return;
    const allWins = bets.every((b) => parseFloat(b.payout || "0") > 0);
    if (!allWins) return;

    await db.userProfile.update({
      where: { wallet: w },
      data: { badges: JSON.stringify([...badges, "seer"]) },
    });
    console.info(`[money-op] badge granted: wallet=${w} badge=seer`);
  } catch {
    /* бейдж best-effort */
  }
}
