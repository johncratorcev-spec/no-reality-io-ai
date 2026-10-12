import { NextRequest, NextResponse } from "next/server";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { rateLimit } from "@/lib/rateLimit";
import { authedAccountId } from "@/lib/auth/session";
import { authIpHash, reqIp } from "@/lib/auth/identity";
import { logWithdrawAttempt } from "@/lib/hook";
import { FEATURES } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/cashout — вывод.
 *
 * v20 — КРЮЧКОВАЯ ЭКОНОМИКА (ТЗ §3, §11): вывод EYE НЕ СУЩЕСТВУЕТ.
 * EYE — внутренняя игровая валюта: зарабатывается активностью, тратится
 * на ставки/шоп, НИКОГДА не конвертируется в крипту/фиат. Единственный
 * выход ценности — сезонный snapshot → $NR merkle-клейм (/claim).
 *
 * Каждая попытка (даже от гостя с валидной сессией) пишется в
 * WithdrawAttempt — спрос на вывод виден, дорожки нет. Реальные выплаты
 * (если когда-нибудь включат FEATURE_PAYMENTS=1 + WITHDRAWALS_ENABLED=1)
 * проходят ТОЛЬКО через ручную админ-ревизию — самообслуживания нет.
 */
export async function POST(req: NextRequest) {
  const ip = reqIp(req);
  const rl = rateLimit(`cashout:${ip}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const accountId = authedAccountId(req);
  const bettor = readBettor(req);

  /* журнал попыток (кто и откуда пытался вывести) */
  if (accountId) {
    await logWithdrawAttempt(accountId, "cashout", authIpHash(ip), {
      payments: FEATURES.payments ? "on" : "off",
    });
  }

  /* вывод закрыт на уровне экономики: двойной замок (payments + env) */
  if (!FEATURES.payments || process.env.WITHDRAWALS_ENABLED !== "1") {
    return bettorResponse(
      bettor,
      {
        error: "cashout_disabled",
        message:
          "EYE is play-only: it never leaves the game. Value exits through the Season 1 snapshot ($NR merkle claim).",
        hint: "/claim",
      },
      403
    );
  }

  /* Даже с включёнными флагами — только ручная админ-ревизия (ТЗ §11). */
  return bettorResponse(
    bettor,
    {
      error: "cashout_manual_only",
      message:
        "self-service withdrawal does not exist. payouts are reviewed manually by the team; the $NR merkle claim opens after the season snapshot.",
    },
    403
  );
}
