import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BetError, placeBet, roundView, type PlaceBetResult } from "@/lib/bet/core";
import { readBettor, bettorResponse } from "@/lib/bet/identity";
import { normalizeRefCode } from "@/lib/referral";
import { visitorHashOf } from "@/lib/utm";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/bet — ставка на раунд (§4.2).
 *   { round_id, side: real|synth, amount_cents, ref? }
 *
 * Anon-first: аккаунт не нужен, личность — httpOnly-cookie nr_bet.
 * Анти-фрод (§4.3.9): 10/мин на IP, одна активная ставка на раунд
 * с одного bettorId/fingerprint, cap суммы.
 * demo-режим (без 2328-ключей): ставка активна мгновенно.
 * crypto-режим: инвойс 2328.io → pay_url, ставка станет активной
 * после подписанного webhook'а.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ua = req.headers.get("user-agent") || "unknown";

  const rl = rateLimit(`bet:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const roundId = typeof body.round_id === "string" ? body.round_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(roundId)) {
    return NextResponse.json({ error: "bad round id" }, { status: 400 });
  }

  const bettor = readBettor(req);
  const fingerprint = visitorHashOf(ip, ua);
  const refCode = normalizeRefCode(body.ref);

  try {
    const result: PlaceBetResult = await placeBet({
      roundId,
      side: body.side,
      amountCents: body.amount_cents,
      bettorId: bettor.id,
      fingerprint,
      refCode,
    });

    /* свежий срез раунда — чтобы клиент сразу увидел обновлённый банк */
    const round = await db.round.findUnique({ where: { id: roundId } });
    const myBet = await db.bet.findFirst({
      where: { roundId, bettorId: bettor.id },
      orderBy: { createdAt: "desc" },
      select: { side: true, amountCents: true, status: true, payoutCents: true },
    });

    return bettorResponse(bettor, {
      bet_id: result.betId,
      status: result.status,
      mode: result.mode,
      pay_url: result.payUrl ?? null,
      round: round ? roundView(round, myBet) : null,
    });
  } catch (e) {
    if (e instanceof BetError) {
      return bettorResponse(
        bettor,
        { error: e.code, message: e.message },
        e.status
      );
    }
    console.error("[bet] failed:", e instanceof Error ? e.message : e);
    return bettorResponse(bettor, { error: "bet_failed" }, 500);
  }
}
