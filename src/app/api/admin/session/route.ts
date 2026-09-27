import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  ADMIN_COOKIE,
  ADMIN_TTL_SEC,
  adminCodeMatches,
  adminConfigured,
  adminCookieOptions,
  issueAdminToken,
  verifyAdminToken,
} from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/* ================================================================
   v7 — вход в панель резолва по секретному коду.

   POST { code }  → timing-safe сверка + httpOnly HMAC-cookie (12 ч).
                    5 попыток/мин на IP; после 5 неудач — окно again.
   GET            → { authed: bool } — статус текущей сессии.
   DELETE         → выход (сброс cookie).
   ================================================================ */

const FAILS_COOKIE = "nr_admin_fails";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "admin_not_configured" },
      { status: 503 }
    );
  }

  /* анти-брутфорс: 5 попыток в минуту на IP */
  const rl = rateLimit(`admin:login:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!code || code.length > 200) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  if (!adminCodeMatches(code)) {
    const res = NextResponse.json({ error: "access_denied" }, { status: 401 });
    /* счётчик неудач в отдельной httpOnly-куке — удобный дебаг без логов */
    const fails = Number.parseInt(req.cookies.get(FAILS_COOKIE)?.value || "0", 10);
    res.cookies.set(
      FAILS_COOKIE,
      String(Number.isFinite(fails) ? Math.min(fails + 1, 99) : 1),
      { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", maxAge: 600, path: "/" }
    );
    return res;
  }

  const res = NextResponse.json({ ok: true, ttlSec: ADMIN_TTL_SEC });
  res.cookies.set(ADMIN_COOKIE, issueAdminToken(), adminCookieOptions(ADMIN_TTL_SEC));
  res.cookies.set(FAILS_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    authed: verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value),
    configured: adminConfigured(),
  });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return res;
}
