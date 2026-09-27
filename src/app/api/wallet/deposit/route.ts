import { NextRequest, NextResponse } from "next/server";
import {
  accountResponse,
  createDeposit,
  depositStatus,
  ECON,
  ensureAccount,
  accountView,
  readAccount,
  EconError,
} from "@/lib/account";

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
 */
export async function POST(req: NextRequest) {
  const account = readAccount(req);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return accountResponse(account, { error: "invalid json" }, 400);
  }

  const amount = Number(body.amount_cents);
  if (!Number.isInteger(amount)) {
    return accountResponse(account, { error: "bad_amount" }, 400);
  }

  try {
    await ensureAccount(account.id);
    const dep = await createDeposit(account.id, amount);
    const fresh = await ensureAccount(account.id);
    return accountResponse(account, {
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
      return accountResponse(account, { error: e.code, message: e.message }, e.status);
    }
    console.error("[wallet/deposit] failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "deposit_failed" }, 500);
  }
}

export async function GET(req: NextRequest) {
  const account = readAccount(req);
  const orderId = req.nextUrl.searchParams.get("order") || "";
  if (!/^[\w-]{1,64}$/.test(orderId)) {
    return accountResponse(account, { error: "bad_order" }, 400);
  }
  try {
    await ensureAccount(account.id);
    const st = await depositStatus(account.id, orderId);
    return NextResponse.json(st);
  } catch (e) {
    console.error("[wallet/deposit] status failed:", e instanceof Error ? e.message : e);
    return accountResponse(account, { error: "status_failed" }, 500);
  }
}
