import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import {
  GOOGLE_STATE_COOKIE,
  googleAuthUrl,
  googleConfigured,
} from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google/start — шаг 1 OAuth: state-cookie + редирект
 * на consent Google. Без настроенных ключей — 503 (кнопка в UI скрыта).
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`auth:google:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  if (!googleConfigured()) {
    return NextResponse.json(
      { error: "google_not_configured" },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const res = NextResponse.redirect(googleAuthUrl(state), { status: 303 });
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 минут на завершение consent
    path: "/",
  });
  return res;
}
