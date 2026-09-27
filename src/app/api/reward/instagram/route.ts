import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  applyLedger,
  ECON,
  ensureAccount,
  readAccount,
  accountResponse,
  accountView,
} from "@/lib/account";
import { rateLimit } from "@/lib/rateLimit";
import {
  IG_MIN_DELAY_SEC,
  IG_OPEN_COOKIE,
  IG_OPEN_TTL_SEC,
  instagramUrl,
  issueOpenToken,
  verifyOpenToken,
} from "@/lib/rewards/instagram";
import { trackEvent } from "@/lib/bet/events";

export const dynamic = "force-dynamic";

/* ================================================================
   v7 — задание «подпишись на @mmayrday в Instagram» → монеты.

   GET  ?open=1 → 302 на instagram.com/mmayrday + подписанная open-кука
                  (HMAC-время). Без этой куки claim невозможен.
   POST         → claim: аккаунт (nr_uid) + живая open-кука старше 25с +
                  один раз на аккаунт (refKey ig:<accountId> — повторная
                  заявка/повторный вебхук не дадут дубль).
   ================================================================ */

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("open");
  if (url !== "1") {
    return NextResponse.json(
      { url: instagramUrl(), rewardCents: ECON.igRewardCents, minDelaySec: IG_MIN_DELAY_SEC }
    );
  }
  const res = NextResponse.redirect(instagramUrl(), 302);
  res.cookies.set(IG_OPEN_COOKIE, issueOpenToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: IG_OPEN_TTL_SEC,
    path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`reward:ig:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  if (ECON.igRewardCents <= 0) {
    return NextResponse.json({ error: "reward_disabled" }, { status: 403 });
  }

  /* open-кука: переход на Instagram должен был реально случиться.
     НО если награда уже зачислена — честнее ответить already_claimed,
     чем требовать куку (после успешного claim кука стирается). */
  const open = verifyOpenToken(req.cookies.get(IG_OPEN_COOKIE)?.value);
  const account = readAccount(req);
  if (!open.ok) {
    try {
      const me0 = await ensureAccount(account.id);
      const already = await db.ledgerTxn.findUnique({
        where: { refKey: `ig:${me0.id}` },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json({ error: "already_claimed" }, { status: 409 });
      }
    } catch {
      /* БД недоступна — обычный отказ */
    }
    const status = open.reason === "too_fast" ? 425 : 403;
    return NextResponse.json(
      { error: open.reason === "too_fast" ? "too_fast" : "open_instagram_first" },
      { status }
    );
  }

  try {
    const me = await ensureAccount(account.id);
    const credited = await applyLedger(
      me.id,
      ECON.igRewardCents,
      "ig_reward",
      `ig:${me.id}`,
      { task: "instagram_mmayrday" }
    );
    if (!credited) {
      return NextResponse.json({ error: "already_claimed" }, { status: 409 });
    }
    void trackEvent("ig_reward_claimed", { meta: { cents: ECON.igRewardCents } });
    const fresh = await ensureAccount(me.id);
    const res = NextResponse.json({
      ok: true,
      rewardCents: ECON.igRewardCents,
      account: accountView(fresh),
    });
    /* кука больше не нужна — claim одноразовый по аккаунту */
    res.cookies.set(IG_OPEN_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    console.error("[reward/ig] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "reward_failed" }, 500);
  }
}
