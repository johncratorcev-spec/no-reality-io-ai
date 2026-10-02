import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/db";
import { ECON, applyLedger, ensureAccount } from "@/lib/account";
import { labelCommitOf, scrubCaption } from "@/lib/clips";

export const dynamic = "force-dynamic";

/* ================================================================
   v14 — «легко создавать события» из панели: строка таблицы clips.
   (CSV удалён из дерева — ТЗ §Миграция.)

   GET  /api/admin/events          — список клипов (для панели).
   POST /api/admin/events          — вставить клип:
       { title, author?, url?, videoUrl, truth: "real"|"synth", badge? }
   Без метки — 400. Клип сразу queued; планировщик сам откроет окно.
   ================================================================ */

function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!/^https:\/\/[^\s"'<>]+$/.test(u) || u.length > 2048) return null;
  return u;
}

function safeText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

export async function GET(req: NextRequest) {
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await db.clip.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        captionPublic: true,
        authorHandle: true,
        label: true,
        videoUrl: true,
        status: true,
        createdAt: true,
      },
    });
    const posts = rows.map((p) => ({
      code: p.id,
      title: p.captionPublic,
      author: p.authorHandle,
      truth: p.label === "real" || p.label === "synth" ? p.label : null,
      status: p.status,
      hasVideo: Boolean(p.videoUrl),
    }));
    return NextResponse.json({ ok: true, posts });
  } catch {
    return NextResponse.json({ error: "posts_unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin:events:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const title = safeText(body.title, 220);
  const author = safeText(body.author, 80);
  const postUrl = httpsUrl(body.url) || "https://www.threads.com/";
  const videoUrl = httpsUrl(body.videoUrl);
  const truthRaw = String(body.truth || "").trim().toLowerCase();
  const truth = truthRaw === "real" || truthRaw === "synth" ? truthRaw : "";
  const badge = safeText(body.badge, 40);

  if (!title) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }
  if (!truth) {
    return NextResponse.json({ error: "label_required (real|synth)" }, { status: 400 });
  }
  if (!videoUrl) {
    return NextResponse.json(
      { error: "videoUrl (https) required" },
      { status: 400 }
    );
  }

  const idChars = "abcdefghijkmnpqrstuvwxyz23456789";
  let clipId = "";
  const rnd = new Uint8Array(10);
  crypto.getRandomValues(rnd);
  for (const b of rnd) clipId += idChars[b % idChars.length];

  try {
    const dupe = await db.clip.findUnique({ where: { sourceUrl: postUrl }, select: { id: true } });
    if (dupe) {
      return NextResponse.json({ error: "this post is already in the feed" }, { status: 409 });
    }
    const clip = await db.clip.create({
      data: {
        id: clipId,
        sourceUrl: postUrl,
        videoUrl,
        authorHandle: author,
        captionPublic: scrubCaption(title),
        label: truth,
        labelCommit: labelCommitOf(clipId, truth),
        status: "queued",
        listedBy: "panel",
        badge,
      },
    });
    console.log(`[admin/events] created: clip=${clip.id} label=${truth}`);

    /* v8: награда за ДОБАВЛЕНИЕ ВИДЕО — куратору панели монеты,
       идемпотентно по refKey video:<clipId>. best-effort. */
    let rewardCents = 0;
    const curatorUid = req.cookies.get("nr_uid")?.value;
    if (ECON.videoRewardCents > 0 && curatorUid && /^[0-9a-f-]{36}$/i.test(curatorUid)) {
      try {
        const curator = await ensureAccount(curatorUid);
        const credited = await applyLedger(
          curator.id,
          ECON.videoRewardCents,
          "video_reward",
          `video:${clip.id}`,
          { clip: clip.id, title: title.slice(0, 80) }
        );
        if (credited) rewardCents = ECON.videoRewardCents;
      } catch (e) {
        console.error("[admin/events] video reward failed:", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({ ok: true, code: clip.id, media: "video", rewardCents });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique")) {
      return NextResponse.json({ error: "this post is already in the feed" }, { status: 409 });
    }
    console.error("[admin/events] write failed:", msg);
    return NextResponse.json({ error: "db_write_failed" }, { status: 500 });
  }
}