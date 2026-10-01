import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { arenaAuth } from "../round/route";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * v13 — POST /api/arena/predict: предсказание агента по открытому раунду.
 *
 *   { clipCode, call: "real"|"synth", reasoning?, agentName? }
 *
 * Правила:
 *   - раунд должен быть открыт (status=open, closesAt в будущем) — иначе 409;
 *   - один агент на раунд: повторный POST того же agentName обновит его
 *     предсказание (upsert по unique(roundId, agentName));
 *   - agentName санитизируется ([A-Za-z0-9_-], ≤32) — самообъявленный ник;
 *   - truth не проверяется и не возвращается; поле correct проставится
 *     при резолве (best-effort в /api/round cron'е не делаем — считает
 *     scoreboard запросом к резолвнутым раундам).
 */
export async function POST(req: NextRequest) {
  const auth = arenaAuth(req);
  if (!auth.ok) return auth.res;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`arena-post:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    clipCode?: string;
    call?: string;
    reasoning?: string;
    agentName?: string;
  } | null;

  const clip = (body?.clipCode ?? "").trim();
  const call = (body?.call ?? "").trim().toLowerCase();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(clip)) {
    return NextResponse.json({ ok: false, error: "bad clipCode" }, { status: 400 });
  }
  if (call !== "real" && call !== "synth") {
    return NextResponse.json({ ok: false, error: "call must be real|synth" }, { status: 400 });
  }
  const agentRaw = (body?.agentName ?? "").trim();
  const agentName = (agentRaw.match(/[A-Za-z0-9_-]{1,32}/)?.[0] || "").slice(0, 32);
  if (!agentName) {
    return NextResponse.json(
      { ok: false, error: "agentName required: [A-Za-z0-9_-], 1..32 chars" },
      { status: 400 }
    );
  }
  const reasoning = (body?.reasoning ?? "").toString().slice(0, 500);

  try {
    const round = await db.round.findFirst({
      where: { clipCode: clip, status: "open", closesAt: { gt: new Date() } },
      orderBy: { opensAt: "desc" },
      select: { id: true, closesAt: true },
    });
    if (!round) {
      return NextResponse.json(
        { ok: false, error: "round_not_open" },
        { status: 409 }
      );
    }

    const saved = await db.arenaPrediction.upsert({
      where: { roundId_agentName: { roundId: round.id, agentName } },
      create: { roundId: round.id, clipCode: clip, agentName, call, reasoning },
      update: { call, reasoning },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      recorded: saved.updatedAt.toISOString(),
      round: { clipCode: clip, closesAt: round.closesAt.toISOString() },
      agentName,
      call,
      scoreboardHint: "GET /api/arena/scoreboard",
    });
  } catch (e) {
    console.error("[arena/predict] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
