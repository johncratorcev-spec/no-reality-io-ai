import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession, adminConfigured } from "@/lib/admin/session";
import { ensureActiveSeason } from "@/lib/season";
import {
  buildSeasonArtifact,
  artifactCsv,
  buildMerkle,
} from "@/lib/nr-snapshot";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/snapshot?key=<ADMIN_SECRET> — срез сезона v14 для $NR.
 *
 * Формат: ?format=json (по умолчанию csv).
 *
 *   csv   — rank,accountId,telegramId,displayName,correctRounds,
 *           earlyCorrect,weightEye,amountNr (+ блок авторов)
 *   json  — полный артефакт: параметры (75/15/10, кепы), игроки, авторы,
 *           totals (сожжённые раунды/доли), и т.д.
 *
 * Правила (ТЗ §Раздача $NR): вес = sum(stake × time_decay) по ВЕРНЫМ
 * ставкам (1/0.4/0 по окну, кеп ставки 50 EYE), ноль при < 20 верных
 * раундов, кеп аккаунта 2% игровой пачки, доли 75/15/10, пачки и
 * revshare в вес не входят. ДО КЛЕЙМА публичны только ранг и число
 * ранних верных коллов — артефакт целиком живёт у админа.
 *
 * POST — построить merkle-клейм: { addresses: { accountId: "0x…" } }
 * → { root, leafCount } ( proofs в season_claims.claimsJson ).
 */
export async function GET(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const season = await ensureActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "season_unavailable" }, { status: 503 });
    }
    const artifact = await buildSeasonArtifact(season);
    const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();

    if (format === "json") {
      return NextResponse.json(artifact, {
        headers: { "cache-control": "no-store" },
      });
    }
    return new NextResponse(artifactCsv(artifact), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="snapshot-${season.code}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[snapshot] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "snapshot_failed" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }
  if (!hasAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* v14: адреса берутся из claim_addresses (игроки регистрируют их на
     домене после снапшота через POST /api/me/nr); { addresses: {...} }
     из тела по-прежнему принимается как поверх — для ручных правок. */
  let body: { addresses?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* тело необязательно */
  }

  try {
    const season = await ensureActiveSeason();
    if (!season) {
      return NextResponse.json({ error: "season_unavailable" }, { status: 503 });
    }
    const artifact = await buildSeasonArtifact(season);
    const manual = (body.addresses && typeof body.addresses === "object"
      ? (body.addresses as Record<string, string>)
      : {}) as Record<string, string>;
    const registered = await db.claimAddress.findMany({
      where: { seasonCode: season.code },
      select: { accountId: true, address: true },
    });
    const regMap = new Map(registered.map((r) => [r.accountId, r.address]));
    const entries = artifact.players.map((p) => ({
      accountId: p.accountId,
      address: manual[p.accountId] ?? regMap.get(p.accountId) ?? "",
      amount: p.amountNr,
    }));
    const { root, leaves } = buildMerkle(entries);
    if (!root) {
      return NextResponse.json(
        { error: "no_valid_addresses", message: "no entries passed address/amount validation" },
        { status: 422 }
      );
    }
    await db.seasonClaim.upsert({
      where: { seasonCode: season.code },
      create: {
        seasonCode: season.code,
        root,
        supply: artifact.params.supply,
        gamePack: artifact.params.gamePack,
        claimsJson: JSON.stringify(leaves),
        leafCount: leaves.length,
      },
      update: {
        root,
        supply: artifact.params.supply,
        gamePack: artifact.params.gamePack,
        claimsJson: JSON.stringify(leaves),
        leafCount: leaves.length,
      },
    });
    return NextResponse.json({
      ok: true,
      seasonCode: season.code,
      root,
      leafCount: leaves.length,
      gamePack: artifact.params.gamePack,
    });
  } catch (e) {
    console.error("[snapshot:merkle] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "merkle_failed" }, { status: 503 });
  }
}
