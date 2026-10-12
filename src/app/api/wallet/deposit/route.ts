import { NextRequest, NextResponse } from "next/server";
import {
  createDeposit,
  depositStatus,
  ECON,
  ensureAccount,
  accountView,
  EconError,
} from "@/lib/account";
import { authedAccountId } from "@/lib/auth/session";
import { FEATURES } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * Пополнение внутреннего баланса — только крипто (2328.io, USDT).
 *
 * POST { amount_cents } → инвойс dp-<id> (payUrl 2328.io). Зачисление
 * происходит ТОЛЬКО по подписанному webhook'у (/api/webhooks/2328,
 * orderId dp-*) → LedgerTxn(deposit:<paymentId>). Внутренний баланс —
 * источник истины после удачного ответа вебхука.
 *
 * GET ?order=<orderId> → статус инвойса для поллинга клиента
 * (pending | paid | failed + текущий баланс).
 *
 * Demo/dev (без 2328-ключей): мгновенное demo-пополнение с дневным капсом —
 * вся воронка тестируется и без прод-ключей.
 *
 * v10: инвойсы — только с подписанной сессией: пополнение нужно ради
 * беттинга, а он за авторизацией; ghost-аккаунты под чужие деньги не
 * создаются.
 */
export async function POST(req: NextRequest) {
  /* v11 — платежи выключены приказом (заморозка 7 дней): EYE не продаются */
  if (!FEATURES.payments) {
    return NextResponse.json(
      { error: "payments_disabled", message: "EYE points are not for sale during Season 1" },
      { status: 403 }
    );
  }
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

  const amount = Number(body.amount_cents);
  if (!Number.isInteger(amount)) {
    return NextResponse.json({ error: "bad_amount" }, { status: 400 });
  }

  try {
    await ensureAccount(accountId);
    const dep = await createDeposit(accountId, amount);
    const fresh = await ensureAccount(accountId);
    return NextResponse.json({
      order_id: dep.orderId,
      pay_url: dep.payUrl,
      mode: dep.mode,
      /* v7: бонус-мультипликатор пакета (монеты сверху, % пакета) */
      bonus_cents: dep.bonusCents,
      bonus_pct: dep.bonusPct,
      presets: ECON.depositPresetsCents,
      account: accountView(fresh),
    });
  } catch (e) {
    if (e instanceof EconError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error("[wallet/deposit] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "deposit_failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const orderId = req.nextUrl.searchParams.get("order") || "";
  if (!/^[\w-]{1,64}$/.test(orderId)) {
    return NextResponse.json({ error: "bad_order" }, { status: 400 });
  }
  try {
    await ensureAccount(accountId);
    const st = await depositStatus(accountId, orderId);
    return NextResponse.json(st);
  } catch (e) {
    console.error("[wallet/deposit] status failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "status_failed" }, { status: 500 });
  }
}
