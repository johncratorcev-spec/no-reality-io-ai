import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getFavoriteCounts } from "@/lib/favstats";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/favorites/counts?codes=a,b,c — публичные счётчики
   «X авторизованных пользователей добавили в избранное» (task 44, §3).

   Без сессии: счётчик — социальное доказательство для всех, кнопка
   сердцa по-прежнему требует авторизацию. Чтение идёт по агрегату
   FavoriteStats + in-memory кэш 30с (см. src/lib/favstats.ts).

   200 → { counts: { [postCode]: number } }
   ================================================================ */

const CODE_RE = /^[A-Za-z0-9_-]{2,32}$/;

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`favcounts:${ip}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("codes") || "";
  const codes = raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => CODE_RE.test(c))
    .slice(0, 120); // лента ~50 постов — запас есть

  const counts = await getFavoriteCounts(codes);
  return NextResponse.json(
    { counts },
    { headers: { "cache-control": "public, max-age=15" } }
  );
}
