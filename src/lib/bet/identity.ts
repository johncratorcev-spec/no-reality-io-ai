import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Анонимная идентификация игрока (ТЗ v2 §4.3.2 — anon-first).
 *
 * Тот же паттерн, что buyer.ts (урок E2E: cookie ставится только на ТОТ
 * ответ, который реально уйдёт клиенту — jsonResponse на каждой точке выхода).
 * Отдельная cookie nr_bet: ставки и покупки живут в разных потоках, а срок
 * у игрока короче (год), чтобы старые «мёртвые» идентификаторы вымывались.
 */

const COOKIE = "nr_bet";
const YEAR = 60 * 60 * 24 * 365;

export interface Bettor {
  id: string;
  isNew: boolean;
}

export function readBettor(req: NextRequest): Bettor {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

/** JSON-ответ, который гарантирует доставку cookie нового игрока. */
export function bettorResponse(
  bettor: Bettor,
  body: unknown,
  status = 200
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (bettor.isNew) {
    res.cookies.set(COOKIE, bettor.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
  }
  return res;
}
