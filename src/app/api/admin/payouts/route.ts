import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { is2328PayoutConfigured } from "@/lib/2328/payout";
import { runSinglePayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payouts?key=<ADMIN_SECRET> — прогон очереди выплат.
 *
 * Первый этап — ПОЛУАВТОМАТ: оплаты накапливаются в статусе
 * ready_for_payout, админ запускает выплату вручную (можно с привязкой
 * к конкретной покупке: ?purchase=<id>). Авто-режим включается позже
 * флагом PAYOUT_AUTO=true — тогда выплаты стартуют прямо из webhook'а.
 *
 * Каждый payout идемпотентен по payoutOrderId (уникальная попытка),
 * ошибки возвратом в очередь не теряют денег.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const rl = rateLimit(`admin:payouts:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  if (!key || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!is2328PayoutConfigured()) {
    return NextResponse.json(
      { error: "Payout API key is not configured" },
      { status: 503 }
    );
  }

  const purchaseId = url.searchParams.get("purchase");

  try {
    const queue = await db.purchase.findMany({
      where: {
        status: "ready_for_payout",
        ...(purchaseId ? { id: purchaseId } : {}),
      },
      orderBy: { paidAt: "asc" },
      take: 25,
      select: { id: true },
    });

    const results: Array<{ id: string; result: string; error?: string }> = [];
    for (const { id } of queue) {
      try {
        const result = await runSinglePayout(id);
        results.push({ id, result });
      } catch (e) {
        results.push({
          id,
          result: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const left = await db.purchase.count({ where: { status: "ready_for_payout" } });
    return NextResponse.json({ ok: true, processed: results.length, results, queueLeft: left });
  } catch (e) {
    console.error("[admin-payouts] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Payout run failed" }, { status: 500 });
  }
}
