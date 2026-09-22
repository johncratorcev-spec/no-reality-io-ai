import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";
import { getRankedPosts } from "@/lib/posts";
import { invalidateFavoriteCounts } from "@/lib/favstats";

export const dynamic = "force-dynamic";

/**
 * Favorites (task 43): wallet-session-gated video bookmarks.
 *
 * GET    → { favorites: [{ postCode, title, author, hasVideo, createdAt }] }
 * POST   { postCode }  → add (200, returns the full list)
 * DELETE { postCode }  → remove (200, returns the full list)
 *
 * Identity: httpOnly session cookie — nr_phantom (Solana base58) first,
 * nr_wallet (EVM 0x…) as a fallback. No session → 401: the heart button
 * triggers the wallet-connect flow instead.
 */

const PHANTOM_COOKIE = "nr_phantom";
const WALLET_COOKIE = "nr_wallet";
const EMAIL_COOKIE = "nr_email";
const MAX_ITEMS = 200;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

/**
 * Субъект сессии: wallet (Solana base58 / EVM 0x…) или email (Magic Link,
 * task 44 §2). Email живёт в той же колонке Favorite.wallet с префиксом
 * «email:» — unique(wallet, postCode) и счётчик работают без миграций.
 */
function sessionWallet(req: NextRequest): string | null {
  const sol = req.cookies.get(PHANTOM_COOKIE)?.value;
  if (sol) {
    try {
      const bytes = bs58.decode(sol);
      if (bytes.length === 32 && bs58.encode(bytes) === sol) return sol;
    } catch {
      /* fall through */
    }
  }
  const evm = req.cookies.get(WALLET_COOKIE)?.value?.toLowerCase();
  if (evm && /^0x[a-f0-9]{40}$/.test(evm)) return evm;
  const email = req.cookies.get(EMAIL_COOKIE)?.value?.toLowerCase();
  if (email && EMAIL_RE.test(email)) return `email:${email}`;
  return null;
}

/** title/author/hasVideo straight from the ranked feed (cached CSV read) */
async function metasFor(codes: string[]) {
  const wanted = new Set(codes);
  const map = new Map<string, { title: string; author: string; hasVideo: boolean }>();
  try {
    const posts = await getRankedPosts();
    for (const p of posts) {
      if (!wanted.has(p.utmCode)) continue;
      map.set(p.utmCode, {
        title: p.title ?? "",
        author: p.author ?? "",
        hasVideo: Boolean(p.videoUrl) || (p.media?.length ?? 0) > 0,
      });
    }
  } catch {
    /* posts unavailable — titles stay empty */
  }
  for (const c of codes) {
    if (map.has(c)) continue;
    const p = getPostByCode(c);
    map.set(c, {
      title: p?.title ?? "",
      author: p?.author ?? "",
      hasVideo: Boolean(p?.videoUrl) || (p?.media?.length ?? 0) > 0,
    });
  }
  return map;
}

async function listFavorites(wallet: string) {
  const rows = await db.favorite.findMany({
    where: { wallet },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
  });
  const metas = await metasFor(rows.map((r) => r.postCode));
  return rows.map((r) => ({
    postCode: r.postCode,
    title: metas.get(r.postCode)?.title ?? "",
    author: metas.get(r.postCode)?.author ?? "",
    hasVideo: metas.get(r.postCode)?.hasVideo ?? true,
    createdAt: r.createdAt.toISOString(),
  }));
}

function denied() {
  return NextResponse.json(
    { error: "connect a wallet to save favorites" },
    { status: 401 }
  );
}

function writeKey(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return rateLimit(`favorites:${ip}`, 60, 60_000);
}

export async function GET(req: NextRequest) {
  const wallet = sessionWallet(req);
  if (!wallet) return denied();
  try {
    return NextResponse.json(
      { favorites: await listFavorites(wallet) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!writeKey(req).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const wallet = sessionWallet(req);
  if (!wallet) return denied();

  let body: { postCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const postCode = typeof body.postCode === "string" ? body.postCode.trim() : "";
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(postCode)) {
    return NextResponse.json({ error: "Bad postCode" }, { status: 400 });
  }

  try {
    // create (не upsert): только НОВАЯ строка двигает счётчик —
    // дубль падает на unique-констрейнте и агрегат не трогает
    try {
      await db.favorite.create({ data: { wallet, postCode } });
      await db.favoriteStats.upsert({
        where: { postCode },
        create: { postCode, count: 1 },
        update: { count: { increment: 1 } },
      });
      invalidateFavoriteCounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Unique constraint")) throw e; // already saved — ок
    }
    return NextResponse.json(
      { favorites: await listFavorites(wallet) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!writeKey(req).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const wallet = sessionWallet(req);
  if (!wallet) return denied();

  let body: { postCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const postCode = typeof body.postCode === "string" ? body.postCode.trim() : "";
  if (!postCode) {
    return NextResponse.json({ error: "postCode required" }, { status: 400 });
  }

  try {
    const removed = await db.favorite.deleteMany({ where: { wallet, postCode } });
    // счётчик вниз ровно на удалённые строки (защита от ухода в минус)
    if (removed.count > 0) {
      await db.favoriteStats.upsert({
        where: { postCode },
        create: { postCode, count: 0 },
        update: { count: { decrement: removed.count } },
      });
      const agg = await db.favoriteStats.findUnique({ where: { postCode } });
      if (agg && agg.count < 0) {
        await db.favoriteStats.update({
          where: { postCode },
          data: { count: 0 },
        });
      }
      invalidateFavoriteCounts();
    }
    return NextResponse.json(
      { favorites: await listFavorites(wallet) },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}
