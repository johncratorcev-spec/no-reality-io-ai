import { NextRequest, NextResponse } from "next/server";
import { authedAccountId } from "@/lib/auth/session";
import { ensureAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { ensureActiveSeason } from "@/lib/season";
import { collectPlayers, MIN_CORRECT_ROUNDS } from "@/lib/nr-snapshot";
import { finalWeightMilli } from "@/lib/nr";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * v14 — публичная сторона раздачи $NR (ТЗ §Раздача $NR).
 *
 * GET /api/me/nr — для СВОЕГО аккаунта до клейма публичны ТОЛЬКО:
 *     rank (место по весу), correctRounds, earlyCorrect (ранние верные
 *     коллы в первые 5с) и минимум 20 верных раундов. НЕ число монет —
 *     amountNr здесь не отдаётся принципиально.
 *
 * POST /api/me/nr { address } — регистрация Base-адреса для merkle-клейма.
 *     Адрес принимается ТОЛЬКО на этом домене и ТОЛЬКО после снапшота
 *     сезона (now >= endsAt). Один раз на аккаунт (accountId unique) и
 *     один раз на адрес (address unique).
 */

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`nr:${ip}`, 30, 60_000).ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }
  try {
    await ensureAccount(accountId);
    const season = await ensureActiveSeason();
    const seasons = season
      ? [season]
      : await db.season.findMany({ orderBy: { endsAt: "desc" }, take: 1 });
    const target = seasons[0];
    if (!target) {
      return NextResponse.json({ ok: true, season: null });
    }

    const players = await collectPlayers(target);
    const enriched = players
      .map((p) => ({ accountId: p.accountId, finalMilli: finalWeightMilli(p) }))
      .sort((a, b) => b.finalMilli - a.finalMilli || a.accountId.localeCompare(b.accountId));
    const idx = enriched.findIndex((p) => p.accountId === accountId);
    const mine = players.find((p) => p.accountId === accountId) ?? null;

    const claimed = await db.claimAddress.findUnique({ where: { accountId } });

    return NextResponse.json({
      ok: true,
      season: { code: target.code, endsAt: target.endsAt.toISOString() },
      snapshotDone: Date.now() >= target.endsAt.getTime(),
      /* до клейма монеты не публикуются: только ранг и ранние верные коллы */
      rank: idx >= 0 ? idx + 1 : null,
      correctRounds: mine?.correctRounds ?? 0,
      earlyCorrect: mine?.earlyCorrect ?? 0,
      qualifies: Boolean(mine && mine.correctRounds >= MIN_CORRECT_ROUNDS),
      address: claimed?.address ?? null,
    });
  } catch (e) {
    console.error("[me/nr] GET failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const accountId = authedAccountId(req);
  if (!accountId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`nr-post:${ip}`, 6, 60_000).ok) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  let body: { address?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!ADDR_RE.test(address)) {
    return NextResponse.json(
      { error: "bad_address", message: "expected Base address 0x…" },
      { status: 400 }
    );
  }

  try {
    await ensureAccount(accountId);
    const season = await ensureActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "no_season" }, { status: 503 });
    }
    /* «Адрес только на этом домене ПОСЛЕ снапшота» */
    if (Date.now() < season.endsAt.getTime()) {
      return NextResponse.json(
        { error: "snapshot_pending", endsAt: season.endsAt.toISOString() },
        { status: 403 }
      );
    }

    const existing = await db.claimAddress.findUnique({ where: { accountId } });
    if (existing) {
      return NextResponse.json(
        { error: "already_registered", address: existing.address },
        { status: 409 }
      );
    }

    const created = await db.claimAddress
      .create({
        data: {
          seasonCode: season.code,
          accountId,
          address: address.toLowerCase(),
        },
      })
      .catch(async (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Unique") || msg.includes("unique")) {
          /* адрес уже занят другим аккаунтом */
          return null;
        }
        throw e;
      });
    if (!created) {
      return NextResponse.json({ error: "address_taken" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, address: created.address });
  } catch (e) {
    console.error("[me/nr] POST failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
