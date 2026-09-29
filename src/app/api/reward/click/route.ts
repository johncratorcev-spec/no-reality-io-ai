import { NextRequest, NextResponse } from "next/server";
import {
  applyLedger,
  ECON,
  ensureAccount,
  accountView,
} from "@/lib/account";
import { guardReward, verifyTurnstile } from "@/lib/antifraud";
import { authedAccountId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/reward/click — внутренняя валюта за ЦЕЛЕВЫЕ клики
 * (спецблоки предикшен-ленты: FEATURED-чипы, спонсорские карточки,
 * партнёрские CTA, daily-плашки). Тело: { target: string, token? }.
 *
 * Мотивация вокруг внутреннего баланса: клик по целевому блоку =
 * небольшой кэбэк в баланс. Анти-фрод (lib/antifraud): бот-фильтр по UA,
 * IP rate-limit, velocity (мин. интервал), дневной капс, дедуп
 * (уникальный target на аккаунт в сутки), Turnstile-ready.
 *
 * v10: награды — только с подписанной сессией. Гость (или легаси nr_uid
 * без подписи) получает 401: ни аккаунтов, ни монет на пустом месте.
 *
 * Ответ: { credited, reward_cents, account } | { credited: false, reason }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ua = req.headers.get("user-agent") || "unknown";
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const target =
    typeof body.target === "string" && /^[\w:.-]{1,64}$/.test(body.target)
      ? body.target
      : null;
  if (!target) {
    return NextResponse.json({ error: "bad_target" }, { status: 400 });
  }

  try {
    await ensureAccount(accountId);

    /* Turnstile (когда Cloudflare-интеграция включена секретом) */
    const token = typeof body.token === "string" ? body.token : "";
    if (process.env.TURNSTILE_SECRET && !(await verifyTurnstile(token, ip))) {
      return NextResponse.json({ credited: false, reason: "captcha" }, { status: 403 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const refKey = `click:${accountId}:${target}:${day}`;
    const guard = await guardReward({
      accountId,
      ip,
      ua,
      kind: "click_reward",
      dedupeKey: refKey,
      ipPerMin: 30,
    });
    if (!guard.ok) {
      const status = guard.code === "rate_limited" ? 429 : 200;
      const fresh0 = await ensureAccount(accountId);
      return NextResponse.json(
        { credited: false, reason: guard.code, account: accountView(fresh0) },
        { status }
      );
    }

    const credited = await applyLedger(
      accountId,
      ECON.clickRewardCents,
      "click_reward",
      refKey,
      { target }
    );
    const fresh = await ensureAccount(accountId);
    return NextResponse.json({
      credited,
      reward_cents: credited ? ECON.clickRewardCents : 0,
      account: accountView(fresh),
    });
  } catch (e) {
    console.error("[reward/click] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "reward_failed" }, { status: 500 });
  }
}
