import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  BetError,
  placeBetBalance,
  roundView,
} from "@/lib/bet/core";
import { readBettor } from "@/lib/bet/identity";
import { normalizeRefCode, deriveRefCode } from "@/lib/referral";
import { visitorHashOf } from "@/lib/utm";
import { rateLimit } from "@/lib/rateLimit";
import {
  ensureAccount,
  accountView,
} from "@/lib/account";
import { authedAccountId } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const YEAR = 60 * 60 * 24 * 365;

/**
 * POST /api/bet — ставка на раунд (§4.2).
 *   { round_id, side: real|synth, amount_cents, ref?, mode: "balance" }
 *
 * v7 — СТАВКИ ТОЛЬКО ВНУТРЕННИМИ МОНЕТАМИ (виртуальные):
 *   mode="balance" обязателен — списание с внутреннего баланса мгновенного
 *   аккаунта (cookie nr_uid), атомарно и идемпотентно. Внутренний баланс —
 *   источник истины после удачного ответа вебхука пополнения.
 *   Ответ содержит свежий account (баланс/пасс) + срез раунда.
 *
 * Легаси-режимы demo/crypto (инвойс 2328 на ставку) УДАЛЕНЫ: реальные
 * крипто-ставки больше не существуют. 2328.io остаётся только на
 * пополнении (dp-*) и бустах (bs-*). Инвойсы rb-* в полёте доедут через
 * webhook (confirmBetPayment сохранён).
 *
 * Анти-фрод (§4.3.9): 10/мин на IP, одна активная ставка на раунд
 * с одного bettorId/fingerprint, cap суммы.
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

  /* v10: БЕТТИНГ ТОЛЬКО С АВТОРИЗАЦИЕЙ — гость (или подделка cookie без
     подписи) получает 401 ДО любых обращений к аккаунтам/пулам */
  const authAccountId = authedAccountId(req);
  if (!authAccountId) {
    return NextResponse.json(
      { error: "auth_required", message: "sign in to place a prediction" },
      { status: 401 }
    );
  }

  const bettor = readBettor(req);
  const fingerprint = visitorHashOf(ip, ua);
  /* v10 усиление: саморефка закрыта — свой пригласительный код
     (derives от uid) не даёт доли рейка с собственных ставок */
  const rawRef = normalizeRefCode(body.ref);
  const refCode =
    rawRef && rawRef === deriveRefCode(`uid:${authAccountId.toLowerCase()}`)
      ? null
      : rawRef;
  /* v5: легаси-куки кошелька (если остались от старой сессии) — сразу пишем
     в ставку (Best Eyes Leaderboard + кэшаут). v7.1: крипто-подключение
     удалено, новые кошелёчные сессии не появляются. */
  const walletCookie =
    req.cookies.get("nr_wallet")?.value?.toLowerCase() ||
    req.cookies.get("nr_phantom")?.value?.toLowerCase() ||
    null;

  /* ---- v7: баланс-режим — единственный путь ставки (виртуальные монеты) ---- */
  if (body.mode !== "balance") {
    /* крипто/demo-ставки сняты с производства */
    return bettorResponseWrapped(bettor, { error: "bet_mode_disabled" }, 400);
  }

  /* ---- v6: баланс-режим (основной путь предикшен-воронки) ---- */
  if (body.mode === "balance") {
    /* v10: аккаунт уже привязан подписанной сессией — create-on-the-fly нет */
    const account = { id: authAccountId, isNew: false } as const;
    try {
      const acc = await ensureAccount(account.id);
      if (!acc) {
        return accountResponseWrapped(account, bettor, { error: "account_failed" }, 500);
      }
      const result = await placeBetBalance({
        roundId,
        side: body.side,
        amountCents: body.amount_cents,
        bettorId: bettor.id,
        accountId: account.id,
        fingerprint,
        refCode,
        wallet: walletCookie,
      });

      const fresh = await ensureAccount(account.id);
      const round = await db.round.findUnique({ where: { id: roundId } });
      const myBet = await db.bet.findFirst({
        where: { roundId, bettorId: bettor.id },
        orderBy: { createdAt: "desc" },
        select: { side: true, amountCents: true, status: true, payoutCents: true },
      });
      return accountResponseWrapped(account, bettor, {
        bet_id: result.betId,
        status: result.status,
        mode: result.mode,
        balance_cents: result.balanceCents ?? fresh.balanceCents,
        account: accountView(fresh),
        round: round ? roundView(round, myBet) : null,
      });
    } catch (e) {
      if (e instanceof BetError) {
        return accountResponseWrapped(
          account,
          bettor,
          { error: e.code, message: e.message },
          e.status
        );
      }
      console.error("[bet] balance failed:", e instanceof Error ? e.message : e);
      return accountResponseWrapped(account, bettor, { error: "bet_failed" }, 500);
    }
  }

  /* ---- легаси-ветка удалена (v7): ставки только виртуальными монетами ---- */
}

/* обёртки, гарантирующие доставку cookies нового bettor/account */

function bettorResponseWrapped(
  bettor: { id: string; isNew: boolean },
  body: unknown,
  status = 200
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (bettor.isNew) {
    res.cookies.set("nr_bet", bettor.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
  }
  return res;
}

function accountResponseWrapped(
  account: { id: string; isNew: boolean },
  bettor: { id: string; isNew: boolean },
  body: unknown,
  status = 200
): NextResponse {
  const res = bettorResponseWrapped(bettor, body, status);
  if (account.isNew) {
    res.cookies.set("nr_uid", account.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
  }
  return res;
}
