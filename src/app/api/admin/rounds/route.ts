import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { resolveRound } from "@/lib/bet/core";

export const dynamic = "force-dynamic";

/* ================================================================
   v7 — раунды REAL/SYNTH в панели резолва.

   GET  /api/admin/rounds  — последние 60 раундов (пулы, статусы).
   POST /api/admin/rounds  — принудительный вердикт оракула:
       { roundId, verdict: "real"|"synth" } → досрочный резолв,
       перекрывающий CSV-truth (журналируется force_resolve).
   ================================================================ */

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
        closesAt: r.closesAt.toISOString(),
        bets: r._count.bets,
      })),
    });
  } catch (e) {
    console.error("[admin/rounds] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin:rounds:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { roundId?: unknown; verdict?: unknown };
  try {
    body = (await req.json()) as { roundId?: unknown; verdict?: unknown };
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const roundId = typeof body.roundId === "string" ? body.roundId : "";
  const verdict =
    body.verdict === "real" || body.verdict === "synth" ? body.verdict : null;
  if (!/^[0-9a-f-]{36}$/i.test(roundId) || !verdict) {
    return NextResponse.json(
      { error: "roundId + verdict(real|synth) required" },
      { status: 400 }
    );
  }

  try {
    const summary = await resolveRound(roundId, { verdict });
    if (!summary) {
      return NextResponse.json({ error: "round_not_resolvable" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("[admin/rounds] resolve failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "resolve_failed" }, { status: 500 });
  }
}
