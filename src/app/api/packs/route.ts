import { NextRequest, NextResponse } from "next/server";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount } from "@/lib/account";
import { isPackSku, createPackInvoice, CashierError } from "@/lib/packs";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * POST /api/packs — инвойс пачки EYE (ТЗ §Касса).
 *   { sku: 100 | 300 | 1000 } → { payUrl, orderId, eye }
 * Инвойс создаёт только сервер; сумму и очки выбирает сервер по sku.
 * Кнопка пачки показывается на нуле баланса после закрытого раунда —
 * не на лендинге. Редирект ничего не начисляет: settle только в вебхуке.
 */
export async function POST(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`packs:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let body: { sku?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!isPackSku(body.sku)) {
    return NextResponse.json(
      { error: "bad_sku", message: "sku must be 100|300|1000" },
      { status: 400 }
    );
  }

  try {
    await ensureAccount(accountId);
    const inv = await createPackInvoice(accountId, body.sku);
    return NextResponse.json({
      ok: true,
      orderId: inv.orderId,
      payUrl: inv.payUrl,
      eye: inv.eye,
      amountUsdt: inv.amountMicros / 1_000_000,
    });
  } catch (e) {
    if (e instanceof CashierError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[packs] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "invoice_failed" }, { status: 502 });
  }
}
