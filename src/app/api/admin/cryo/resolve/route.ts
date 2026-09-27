import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  hasAdminSession,
  legacyKeyMatches,
  adminConfigured,
} from "@/lib/admin/session";
import {
  expireCryoMarket,
  getCryoMarketViews,
  resolveCryoMarket,
} from "@/lib/cryo/core";

export const dynamic = "force-dynamic";

/**
 * Oracle resolution API (Block 8 спеки) — панель /admin/resolution.
 *
 * POST /api/admin/cryo/resolve?key=<ADMIN_SECRET>
 * Body:
 *   { postCode, result: "<optionKey>" }     — вердикт куратора
 *     (task 44: ключ ЛЮБОЙ опции рынка — "yes"/"no" или нарративной
 *      ("drip"/"vanish"/…); валидация по конфигу в resolveCryoMarket)
 *   { postCode, action: "expire" }          — заморозить терминал сейчас
 *   { postCode, action: "expire", inSec:10} — кипение за 10с (тест Block 7)
 *
 * Подпись куратора: ключ админа = второй фактор (hold-to-confirm живёт
 * на клиенте, ключ проверяется здесь). YubiKey-совместимый flow:
 * реальный аппаратный подписант подключается заменой проверки ключа.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:oracle:${ip}`, 40, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  /* v7: сессия (cookie nr_admin) или легаси-ключ — оба timing-safe;
     дефолтный секрет вырезан: без ADMIN_SECRET эндпоинт мёртв (503). */
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  const legacyKey =
    req.nextUrl.searchParams.get("key") || req.headers.get("x-admin-key");
  if (!hasAdminSession(req) && !legacyKeyMatches(legacyKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { postCode?: string; result?: string; action?: string; inSec?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body.postCode) {
    return NextResponse.json({ error: "postCode required" }, { status: 400 });
  }

  let res;
  if (body.action === "expire") {
    res = await expireCryoMarket(body.postCode, body.inSec ?? 0);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
  } else if (typeof body.result === "string" && body.result.trim()) {
    // result — ключ любой опции рынка ("yes"/"no"/нарративный);
    // неизвестный ключ вернёт 400 из resolveCryoMarket
    res = await resolveCryoMarket(body.postCode, body.result.trim().toLowerCase());
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
  } else {
    return NextResponse.json(
      { error: "result <optionKey> or action expire required" },
      { status: 400 }
    );
  }

  const markets = await getCryoMarketViews(null);
  return NextResponse.json({ ok: true, markets });
}
