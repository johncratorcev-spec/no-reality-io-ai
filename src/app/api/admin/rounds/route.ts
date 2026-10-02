import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession, legacyKeyMatches } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { voidRound } from "@/lib/bet/core";

export const dynamic = "force-dynamic";

/**
 * v14 — раунды в админке.
 *
 * GET  /api/admin/rounds — последние 60 раундов (пулы, статусы, клип).
 * POST /api/admin/rounds — ручной override ТОЛЬКО на void (ТЗ):
 *        { roundId } → void-раунд, ставки назад, метка НЕ раскрывается.
 *      Ручная постановка метки удалена: метку знает только таблица clips
 *      + планировщик; фиксируется reason.
 */

export async function GET(req: NextRequest) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rounds = await db.round.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { _count: { select: { bets: true } } },
    });
    return NextResponse.json({
      ok: true,
      rounds: rounds.map((r) => ({
        id: r.id,
        clipCode: r.clipCode,
        status: r.status,
        poolRealCents: r.poolRealCents,
        poolSynthCents: r.poolSynthCents,
        resolvedAs: r.resolvedAs,
        challenge: r.challenge,
        closesAt: r.closesAt.toISOString(),
        bets: r._count.bets,
      })),
    });
  } catch (e) {
    console.error("[admin/rounds] GET failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!hasAdminSession(req) && !legacyKeyMatches(req.nextUrl.searchParams.get("key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin-rounds:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  let body: { roundId?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const roundId = typeof body.roundId === "string" ? body.roundId : "";
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 120)
      : "admin_override";

  try {
    const res = await voidRound(roundId, reason);
    if (!res) {
      return NextResponse.json(
        { error: "not_voidable", message: "round missing, already closed" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, voided: true, summary: res });
  } catch (e) {
    console.error("[admin/rounds] void failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "void_failed" }, { status: 503 });
  }
}
