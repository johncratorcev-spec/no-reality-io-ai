import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount, accountView } from "@/lib/account";
import { ensureRefCode, refLinkOf } from "@/lib/referral";
import {
  pnlOf,
  winStatsOf,
  referralSummaryOf,
  dailyStreakOf,
  shareStatusToday,
} from "@/lib/hook";
import { badgesOf, badgeMetaOf } from "@/lib/badges";
import { winStreakOf } from "@/lib/bet/stats";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/summary — ЛИЧНЫЙ КАБИНЕТ одним срезом (ТЗ §7):
 *   баланс EYE («только для игры»), PnL день/сезон, winrate, стрики
 *   (daily с щитом + вин-стрик), бейджи, статистика рефералов
 *   (привёл/активировал/EYE), фрибет, шоп-владение, шеринг-кнопки.
 * Без сессии — 401. Всё, что можно, переживает недоступность отдельных
 * частей (кабинет не должен падать целиком).
 */
export async function GET(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    const me = await ensureAccount(accountId);

    const [pnl, winStats, refs, streak, shares, badges, freebet, shop, winStreak] = await Promise.all([
      pnlOf(accountId).catch(() => ({
        day: { stakeCents: 0, payoutCents: 0, bonusCents: 0 },
        season: { stakeCents: 0, payoutCents: 0, bonusCents: 0 },
      })),
      winStatsOf(accountId).catch(() => ({ won: 0, lost: 0, total: 0, winrate: 0 })),
      referralSummaryOf(accountId).catch(() => ({ invited: 0, activated: 0, eyeFromRefs: 0, refCode: null as string | null })),
      dailyStreakOf(accountId).catch(() => ({ streakDays: 0, shieldActive: false })),
      shareStatusToday(accountId).catch(() => ({ win: false, streak: false })),
      badgesOf(accountId).catch(() => [] as Array<{ code: string; awardedAt: Date }>),
      db.freebet
        .findUnique({ where: { accountId_source: { accountId, source: "telegram" } } })
        .catch(() => null),
      db.shopPurchase.findMany({ where: { accountId }, select: { sku: true, createdAt: true } }).catch(() => []),
      winStreakOf(accountId).catch(() => 0),
    ]);

    const refCode = await ensureRefCode(accountId).catch(() => refs.refCode);

    return NextResponse.json({
      account: accountView(me),
      pnl,
      winStats,
      referrals: {
        ...refs,
        refCode: refCode ?? refs.refCode,
        link: refCode ? refLinkOf(refCode) : null,
      },
      streak: { ...streak, dailyStreak: streak.streakDays },
      shares,
      badges: badges.map((b) => ({
        code: b.code,
        awardedAt: b.awardedAt.toISOString(),
        ...(badgeMetaOf(b.code) ?? { label: b.code, hint: "", leaderboard: false, icon: "🎖" }),
      })),
      freebet: freebet
        ? {
            username: freebet.username,
            amountCents: freebet.amountCents,
            createdAt: freebet.createdAt.toISOString(),
          }
        : null,
      shop: { owned: shop.map((s) => s.sku) },
      winStreak,
    });
  } catch (e) {
    console.error("[me/summary] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "summary_failed" }, { status: 500 });
  }
}
