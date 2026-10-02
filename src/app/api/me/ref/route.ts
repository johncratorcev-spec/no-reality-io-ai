import { NextRequest, NextResponse } from "next/server";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount } from "@/lib/account";
import { createRevInvoice, CashierError } from "@/lib/packs";
import { refStatsOf } from "@/lib/referral";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/ref — рефералка СВОЕГО аккаунта (ТЗ §Рефка).
 *   Ссылка есть у всех с регистрации. До оплаты «процент выключен».
 *   Заработок — только с пачек рефералов (20% в USDT); сгоревшее видно,
 *   но не выплачивается. Выигрыши рефералов в EYE — цифрой на ссылке,
 *   в доллары не переводятся и под процент не допечатываются.
 *
 * POST /api/me/ref — инвойс разблокировки процента (rev-<accountId>,
 *   ровно 3 USDT, один раз). Самоприглашение исключено: инвойс создаётся
 *   только для своей сессии.
 */
export async function GET(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  try {
    await ensureAccount(accountId);
    const stats = await refStatsOf(accountId);
    if (!stats) {
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      ...stats,
      payoutThresholdUsdtCents: 500,
    });
  } catch (e) {
    console.error("[me/ref] GET failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`ref-unlock:${ip}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  try {
    await ensureAccount(accountId);
    const inv = await createRevInvoice(accountId);
    return NextResponse.json({ ok: true, payUrl: inv.payUrl, orderId: inv.orderId });
  } catch (e) {
    if (e instanceof CashierError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[me/ref] POST failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "invoice_failed" }, { status: 502 });
  }
}
