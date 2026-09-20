import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
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
 *   { postCode, result: "yes"|"no" }        — вердикт куратора
 *     («РЕАЛЬНОСТЬ ПОДТВЕРЖДЕНА» = yes, «ИЛЛЮЗИЯ РАССЕЯЛАСЬ» = no)
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

  const key =
    req.nextUrl.searchParams.get("key") || req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  if (!key || key !== secret) {
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
  } else if (body.result === "yes" || body.result === "no") {
    res = await resolveCryoMarket(body.postCode, body.result);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
  } else {
    return NextResponse.json(
      { error: "result yes|no or action expire required" },
      { status: 400 }
    );
  }

  const markets = await getCryoMarketViews(null);
  return NextResponse.json({ ok: true, markets });
}
