import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { get2328PaymentInfo } from "@/lib/2328/payment";
import { isPaidStatus } from "@/lib/2328/webhook";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/prompt-drop/status?orderId=pd-…
   Реконсиляция статуса инвойса у 2328.io. Если оплачен — отдаём
   промпт. Это единственное место, где PROMPT_LOKI_FLASH покидает
   сервер; значение уходит только по оплаченному orderId.
   ================================================================ */

/** срезаем XSS/инъекции в order_id при поллинге */
const ORDER_RE = /^pd-[A-Za-z0-9_-]{6,32}$/;

/** статусы, при которых инвойс уже не станет оплаченным */
const DEAD_STATUSES = new Set(["expired", "fail", "failed", "canceled", "cancel"]);

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // поллинг каждые 4с — 30 req/мин с запасом
  const rl = rateLimit(`drop-status:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId") || "";
  if (!ORDER_RE.test(orderId)) {
    return NextResponse.json({ error: "Bad orderId" }, { status: 400 });
  }

  const promptEnv = process.env.PROMPT_LOKI_FLASH?.trim() || "";

  try {
    const info = await get2328PaymentInfo({ orderId });
    const status = String(info?.payment_status ?? "unknown");

    if (isPaidStatus(status) && promptEnv) {
      return NextResponse.json({ ok: true, status, paid: true, prompt: promptEnv });
    }

    const dead = DEAD_STATUSES.has(status.toLowerCase());
    return NextResponse.json({
      ok: true,
      status,
      paid: false,
      dead,
      error: dead ? "This invoice is no longer payable" : undefined,
    });
  } catch (e) {
    console.error(
      "[prompt-drop] status check failed:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { error: "Status check failed — keep the tab open, we keep trying" },
      { status: 502 }
    );
  }
}
