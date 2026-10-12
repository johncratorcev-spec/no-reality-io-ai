import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount } from "@/lib/account";
import { grantTelegramFreebet, HookError } from "@/lib/hook";

export const dynamic = "force-dynamic";

/**
 * POST /api/freebet/telegram { username: "@nick" } — фрибет за Telegram-ник
 * (ТЗ §9): БЕЗ проверки владения, один раз на аккаунт И на ник (глобально).
 * EYE сразу в баланс; вывода у EYE нет — «только на ставки» выполняется
 * самой экономикой. Ответ: { granted, amount_cents, reason? }.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`freebet-tg:${ip}`, 6, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let username = "";
  try {
    const body = (await req.json()) as { username?: unknown };
    username = typeof body.username === "string" ? body.username : "";
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    await ensureAccount(accountId);
    const res = await grantTelegramFreebet(accountId, username);
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof HookError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error("[freebet/telegram] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "freebet_failed" }, { status: 500 });
  }
}
