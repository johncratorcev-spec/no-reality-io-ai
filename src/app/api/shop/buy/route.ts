import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount, accountView, EconError } from "@/lib/account";
import { shopBuy, shopCatalog, HookError } from "@/lib/hook";

export const dynamic = "force-dynamic";

/**
 * POST /api/shop/buy { sku } — покупка за EYE (ТЗ §3: «тратить на
 * временные бусты / фрибеты / косметику»): pumpkin-бейдж (косметика),
 * streak_shield (сутки защиты daily-стрика от сгорания). Атомарно:
 * нет EYE → 402 insufficient_balance, товар не выдаётся.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`shop-buy:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let sku = "";
  try {
    const body = (await req.json()) as { sku?: unknown };
    sku = typeof body.sku === "string" ? body.sku : "";
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    const me = await ensureAccount(accountId);
    const res = await shopBuy(accountId, sku);
    const fresh = await ensureAccount(accountId);
    return NextResponse.json({ ...res, account: accountView(fresh), oldBalance: me.balanceCents });
  } catch (e) {
    if (e instanceof HookError || e instanceof EconError) {
      return NextResponse.json({ error: e.code ?? "bad_sku", message: e.message }, { status: e.status });
    }
    console.error("[shop/buy] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "shop_failed" }, { status: 500 });
  }
}

/** GET — каталог с ценами (для UI) */
export async function GET() {
  return NextResponse.json({ items: shopCatalog() });
}
