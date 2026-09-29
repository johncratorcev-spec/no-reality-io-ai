import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ECON,
  applyLedger,
  ensureAccount,
  accountView,
} from "@/lib/account";
import { rateLimit } from "@/lib/rateLimit";
import { trackEvent } from "@/lib/bet/events";
import { authedAccountId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/* ================================================================
   v8 — награда за ПРОСМОТР ЛЕНТЫ (замена Instagram-задания).

   POST { clipCode } → отметка «этот клип этот аккаунт уже смотрел
   сегодня» (ledger-строка delta=0, refKey watch:<acc>:<день>:<клип>,
   unique — дедуп силами БД). Каждые WATCH_REWARD_EVERY_CLIPS уникальных
   клипов за UTC-день = +WATCH_REWARD_CENTS монет, но не больше
   WATCH_REWARD_DAILY_CAP_CENTS за день.

   Клиент зовёт это на просмотре карточки (BetPanel / лента /feed);
   сервер дедуплицирует и капсит — накрутка бессмысленна.
   ================================================================ */

const CLIP_RE = /^[\w-]{2,32}$/;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`reward:watch:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let clipCode = "";
  try {
    const body = (await req.json()) as { clipCode?: unknown };
    clipCode = typeof body.clipCode === "string" ? body.clipCode.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!CLIP_RE.test(clipCode)) {
    return NextResponse.json({ error: "bad_clip" }, { status: 400 });
  }

  /* v10: награды — только с сессией. Гость смотрит ленту без аккаунта:
     никаких ensureAccount-гостей на каждый клип (анти-инфляция) */
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    const me = await ensureAccount(accountId);
    const day = utcDayKey();
    const stampKey = `watch:${me.id}:${day}:${clipCode}`;

    /* дедуп отметки: повторный клип за день = no-op (unique refKey) */
    const stamped = await db.ledgerTxn
      .create({
        data: {
          accountId: me.id,
          delta: 0,
          kind: "watch_view",
          refKey: stampKey,
          meta: JSON.stringify({ clip: clipCode }),
        },
      })
      .catch(() => null);
    if (!stamped) {
      return NextResponse.json({ ok: true, credited: false, already: true });
    }

    const watchedToday = await db.ledgerTxn.count({
      where: { accountId: me.id, kind: "watch_view", createdAt: { gte: new Date(`${day}T00:00:00.000Z`) } },
    });

    /* каждые N уникальных клипов — монеты, но не больше дневного капса */
    const every = Math.max(1, ECON.watchRewardEveryClips);
    let credited = false;
    let rewardCents = 0;
    if (
      ECON.watchRewardCents > 0 &&
      watchedToday % every === 0 &&
      (watchedToday / every) * ECON.watchRewardCents <= ECON.watchRewardDailyCapCents
    ) {
      const idx = watchedToday / every;
      credited = await applyLedger(
        me.id,
        ECON.watchRewardCents,
        "watch_reward",
        `watchpay:${me.id}:${day}:${idx}`,
        { clips: watchedToday }
      );
      if (credited) {
        rewardCents = ECON.watchRewardCents;
        void trackEvent("watch_reward", {
          meta: { cents: rewardCents, clips: watchedToday },
        });
      }
    }

    const fresh = await ensureAccount(me.id);
    return NextResponse.json({
      ok: true,
      credited,
      rewardCents,
      watchedToday,
      account: accountView(fresh),
    });
  } catch (e) {
    console.error("[reward/watch] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "reward_failed" }, { status: 500 });
  }
}
