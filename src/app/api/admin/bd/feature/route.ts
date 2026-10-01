import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminConfigured, hasAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/**
 * v13 — POST /api/admin/bd/feature: пометки из BD-панели.
 *
 *   { kind: "featured", clip, on: true }   → PostStats.featuredUntil = +24ч
 *   { kind: "featured", clip, on: false }  → снять featured
 *   { kind: "daily", clip, label? }        → Daily Challenge сегодняшнего
 *     UTC-дня: upsert строки дня + флаг challenge на открытых раундах
 *     этого клипа (победителям резолва начисляется бонус сверху).
 *
 * Доступ: только сессия nr_admin (или легаси ?key=).
 */
export async function POST(req: NextRequest) {
  if (!adminConfigured() || !hasAdminSession(req)) {
    return NextResponse.json({ ok: false, error: "access_denied" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    kind?: string;
    clip?: string;
    on?: boolean;
    label?: string;
  } | null;

  const kind = body?.kind ?? "";
  const clip = (body?.clip ?? "").trim();
  if (!["featured", "daily"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "kind must be featured|daily" }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(clip)) {
    return NextResponse.json({ ok: false, error: "bad clip code" }, { status: 400 });
  }

  try {
    if (kind === "featured") {
      const on = body?.on !== false;
      const until = on ? new Date(Date.now() + 24 * 3_600_000) : null;
      await db.postStats.upsert({
        where: { utmCode: clip },
        create: { utmCode: clip, featuredUntil: until },
        update: { featuredUntil: until },
      });
      console.log(`[admin/bd] featured ${on ? "ON " : "OFF"} ${clip}`);
      return NextResponse.json({
        ok: true,
        featured: on,
        until: until?.toISOString() ?? null,
      });
    }

    /* --- daily --- */
    const today = new Date().toISOString().slice(0, 10);
    await db.dailyChallenge.upsert({
      where: { day: today },
      create: { day: today, clipCode: clip, label: (body?.label ?? "").slice(0, 60) },
      update: { clipCode: clip, label: (body?.label ?? "").slice(0, 60) },
    });
    /* снять флаг со всех открытых/заблокированных раундов и поставить нужному */
    await db.round.updateMany({
      where: { status: { in: ["open", "locked"] }, challenge: true },
      data: { challenge: false },
    });
    const marked = await db.round.updateMany({
      where: { clipCode: clip, status: { in: ["open", "locked"] } },
      data: { challenge: true },
    });
    console.log(`[admin/bd] daily ${today} → ${clip} (marked ${marked.count} rounds)`);
    return NextResponse.json({ ok: true, day: today, clip, marked: marked.count });
  } catch (e) {
    console.error("[admin/bd/feature] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
