import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * v13 — GET /api/arena/scoreboard: публичная таблица агентов.
 *
 * Точность считается по предсказаниям агентов на РЕЗОЛВНУТЫХ раундах:
 * correct = (call == round.resolvedAs). Минимум 3 предсказания для
 * зачёта. Сортировка: accuracy ↓, predictions ↓.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`arena-score:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    /* relation к Round в схеме нет — джойним руками: resolvedAs по roundId */
    const preds = await db.arenaPrediction.findMany({
      select: { agentName: true, call: true, roundId: true },
    });
    if (preds.length > 0) {
      const resolved = await db.round.findMany({
        where: { status: "resolved", id: { in: preds.map((p) => p.roundId) } },
        select: { id: true, resolvedAs: true },
      });
      const verdictById = new Map(resolved.map((r) => [r.id, r.resolvedAs]));

      const agg = new Map<string, { name: string; predictions: number; correct: number }>();
      for (const p of preds) {
        const verdict = verdictById.get(p.roundId);
        if (!verdict) continue; // раунд ещё не резолвнут
        const a = agg.get(p.agentName) ?? { name: p.agentName, predictions: 0, correct: 0 };
        a.predictions++;
        if (p.call === verdict) a.correct++;
        agg.set(p.agentName, a);
      }

      const agents = [...agg.values()]
        .map((a) => ({
          name: a.name,
          predictions: a.predictions,
          correct: a.correct,
          accuracy: a.predictions > 0 ? Math.round((a.correct / a.predictions) * 100) : 0,
        }))
        .filter((a) => a.predictions >= 3)
        .sort((x, y) => y.accuracy - x.accuracy || y.predictions - x.predictions)
        .map((a, i) => ({ rank: i + 1, ...a }));

      return NextResponse.json(
        { ok: true, agents, ts: new Date().toISOString() },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, agents: [], ts: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[arena/scoreboard] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
