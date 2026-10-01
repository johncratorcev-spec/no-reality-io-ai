import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPostByCode } from "@/lib/csv";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/* ================================================================
   v13 — Human vs AI Agents Arena: публичный API для агентов.
   Авторизация: заголовок x-agent-key == ARENA_API_KEY (env).
   Rate-limit: 60/мин на ключ. truth НЕ отдаётся — только открытые
   раунды и служебные поля. Никаких персональных данных.
   ================================================================ */

export function arenaKeyMatches(candidate: string | null): boolean {
  const expected = process.env.ARENA_API_KEY || "";
  if (!expected || !candidate) return false;
  const a = createHash("sha256").update(candidate.trim()).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function arenaAuth(req: NextRequest): { ok: true } | { ok: false; res: NextResponse } {
  if (!process.env.ARENA_API_KEY) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "arena_not_configured" }, { status: 503 }),
    };
  }
  const key = req.headers.get("x-agent-key");
  if (!arenaKeyMatches(key)) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
    };
  }
  const rl = rateLimit(`arena:${createHash("sha256").update(key ?? "").digest("hex").slice(0, 16)}`, 60, 60_000);
  if (!rl.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: "too_many_requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      ),
    };
  }
  return { ok: true };
}

/**
 * GET /api/arena/round — текущий открытый раунд для агента.
 * Возвращает clipCode, videoUrl (прямой mp4 из CSV), автора, тайминги.
 * Если открытых раундов нет — 404 (агент подождёт).
 */
export async function GET(req: NextRequest) {
  const auth = arenaAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const round = await db.round.findFirst({
      where: { status: "open", closesAt: { gt: new Date() } },
      orderBy: { opensAt: "desc" },
      select: {
        id: true,
        clipCode: true,
        opensAt: true,
        closesAt: true,
        poolRealCents: true,
        poolSynthCents: true,
        challenge: true,
      },
    });
    if (!round) {
      return NextResponse.json(
        { ok: false, error: "no_open_round" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }
    const post = getPostByCode(round.clipCode);
    return NextResponse.json(
      {
        ok: true,
        round: {
          id: round.id,
          clipCode: round.clipCode,
          opensAt: round.opensAt.toISOString(),
          closesAt: round.closesAt.toISOString(),
          poolRealCents: round.poolRealCents,
          poolSynthCents: round.poolSynthCents,
          challenge: round.challenge,
          videoUrl: post?.videoUrl ?? null,
          author: post?.author ?? null,
          prompt: post?.promptPreview ?? null,
        },
        /* подсказка агенту, что делать дальше */
        next: "POST /api/arena/predict {clipCode, call: real|synth, reasoning?, agentName?}",
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[arena/round] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
