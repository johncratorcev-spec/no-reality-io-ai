import "server-only";

import { db } from "@/lib/db";
import { trackEvent } from "@/lib/bet/events";
import { applyLedger, ECON } from "@/lib/account";
import { guardReward } from "@/lib/antifraud";

/**
 * Награда за UTM-переходы (v6): владелец персональной ссылки (?ref=rXXX)
 * получает внутреннюю валюту за каждого УНИКАЛЬНОГО посетителя, пришедшего
 * по его ссылке. Уникальность гарантирует unique-констрейнт UtmClick —
 * накрутка повторными кликами бессмысленна.
 *
 * Дневной капс + velocity + бот-фильтр — lib/antifraud (kind utm_reward).
 * Best-effort: любые сбои не ломают переход/редирект.
 */
export async function creditUtmReward(args: {
  ownerCode: string;
  targetType: string;
  targetId: string;
  visitorHash: string;
  ip: string;
  ua: string;
}): Promise<boolean> {
  try {
    if (ECON.utmRewardCents <= 0) return false;

    const profile = await db.referralProfile.findUnique({
      where: { code: args.ownerCode },
      select: { wallet: true },
    });
    if (!profile) return false;

    const account = await db.account.findUnique({
      where: { wallet: profile.wallet },
      select: { id: true },
    });
    if (!account) return false;

    /* refKey зеркалит дедуп UtmClick: один visitor на объект — один раз */
    const refKey = `utm:${args.ownerCode}:${args.targetType}:${args.targetId}:${args.visitorHash}`;
    const guard = await guardReward({
      accountId: account.id,
      ip: args.ip,
      ua: args.ua,
      kind: "utm_reward",
      dedupeKey: refKey,
      ipPerMin: 120,
    });
    if (!guard.ok) return false;

    const credited = await applyLedger(
      account.id,
      ECON.utmRewardCents,
      "utm_reward",
      refKey,
      { targetType: args.targetType, targetId: args.targetId }
    );
    if (credited) {
      void trackEvent("utm_reward", {
        clipCode: args.targetId,
        visitorHash: args.visitorHash,
        meta: { owner: args.ownerCode, cents: ECON.utmRewardCents },
      });
    }
    return credited;
  } catch {
    return false;
  }
}
