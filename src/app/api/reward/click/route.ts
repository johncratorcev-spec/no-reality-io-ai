import { NextRequest } from "next/server";
import {
  accountResponse,
  applyLedger,
  ECON,
  ensureAccount,
  accountView,
  readAccount,
} from "@/lib/account";
import { guardReward, verifyTurnstile } from "@/lib/antifraud";

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
 * Ответ: { credited, reward_cents, account } | { credited: false, reason }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ua = req.headers.get("user-agent") || "unknown";
  const account = readAccount(req);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return accountResponse(account, { error: "invalid json" }, 400);
  }

  const target =
    typeof body.target === "string" && /^[\w:.-]{1,64}$/.test(body.target)
      ? body.target
      : null;
  if (!target) {
    return accountResponse(account, { error: "bad_target" }, 400);
  }

  try {
    await ensureAccount(account.id);

    /* Turnstile (когда Cloudflare-интеграция включена секретом) */
    const token = typeof body.token === "string" ? body.token : "";
    if (process.env.TURNSTILE_SECRET && !(await verifyTurnstile(token, ip))) {
      return accountResponse(account, { credited: false, reason: "captcha" }, 403);
    }

    const day = new Date().toISOString().slice(0, 10);
    const refKey = `click:${account.id}:${target}:${day}`;
    const guard = await guardReward({
      accountId: account.id,
      ip,
      ua,
      kind: "click_reward",
      dedupeKey: refKey,
      ipPerMin: 30,
    });
    if (!guard.ok) {
      const status = guard.code === "rate_limited" ? 429 : 200;
      const fresh0 = await ensureAccount(account.id);
      return accountResponse(
        account,
        { credited: false, reason: guard.code, account: accountView(fresh0) },
        status
      );
    }

    const credited = await applyLedger(
      account.id,
      ECON.clickRewardCents,
      "click_reward",
      refKey,
      { target }
    );
    const fresh = await ensureAccount(account.id);
    return accountResponse(account, {
      credited,
      reward_cents: credited ? ECON.clickRewardCents : 0,
      account: accountView(fresh),
    });
  } catch (e) {
    console.error("[reward/click] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "reward_failed" }, 500);
  }
}
