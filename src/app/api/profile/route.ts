import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { deriveRefCode, upsertReferralProfile } from "@/lib/referral";
import { FEATURES } from "@/lib/features";
import { emailSession } from "@/lib/magic";
import { normalizeOwnerCode } from "@/lib/utm";

export const dynamic = "force-dynamic";

/* ================================================================
   GET /api/profile — профиль текущей сессии (task 44, §4+§5).

   Личность: nr_phantom (Solana) → nr_wallet (EVM) → nr_email (Magic Link).
   Отдаёт:
     - wallet/email, персональный refCode + inviteUrl;
     - виральные бонусы: bonusCredits (free predictions) + бейджи;
     - reach: переходы по персональным ссылкам (total / unique /
       разбивка по типам объектов — video/market/banner/prompt/page);
     - referral: события checkout/paid + начисленная доля (USDT).

   401 без сессии; 503 при недоступной БД (клиент деградирует молча).
   ================================================================ */

const PHANTOM_COOKIE = "nr_phantom";
const WALLET_COOKIE = "nr_wallet";

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
  return null;
}

function origin(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`profile:${ip}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const wallet = sessionWallet(req);
  const email = emailSession(req);
  if (!wallet && !email) {
    return NextResponse.json(
      { error: "connect a wallet or sign in" },
      { status: 401 }
    );
  }

  try {
    // реферальный код: от кошелька; у email-only сессии кода пока нет
    const refCode = wallet
      ? ((await upsertReferralProfile(wallet)) ?? deriveRefCode(wallet))
      : null;

    /* --- бонусы (UserProfile) --- */
    let bonusCredits = 0;
    let badges: string[] = [];
    if (wallet) {
      const prof = await db.userProfile.findUnique({
        where: { wallet: wallet.toLowerCase() },
      });
      if (prof) {
        bonusCredits = prof.bonusCredits;
        try {
          const b = JSON.parse(prof.badges) as unknown;
          badges = Array.isArray(b)
            ? b.filter((x): x is string => typeof x === "string")
            : [];
        } catch {
          /* бейджи не читаются — пусто */
        }
      }
    }

    /* --- reach: переходы по персональным ссылкам (task 44 §4) --- */
    let reach: {
      total: number;
      unique: number;
      byType: { type: string; total: number; unique: number }[];
    } = { total: 0, unique: 0, byType: [] };
    if (refCode && normalizeOwnerCode(refCode) && FEATURES.utmTracking) {
      const rows = await db.utmClick.findMany({
        where: { ownerCode: refCode },
        select: { targetType: true, visitorHash: true },
      });
      const visitors = new Set<string>();
      const byType = new Map<string, { total: number; visitors: Set<string> }>();
      for (const r of rows) {
        visitors.add(r.visitorHash);
        const agg = byType.get(r.targetType) ?? {
          total: 0,
          visitors: new Set<string>(),
        };
        agg.total += 1;
        agg.visitors.add(r.visitorHash);
        byType.set(r.targetType, agg);
      }
      reach = {
        total: rows.length,
        unique: visitors.size,
        byType: [...byType.entries()]
          .map(([type, agg]) => ({
            type,
            total: agg.total,
            unique: agg.visitors.size,
          }))
          .sort((a, b) => b.total - a.total),
      };
    }

    /* --- реферальные начисления (реестр ReferralEvent) --- */
    let referral: {
      eventsTotal: number;
      paidTotal: number;
      accruedUsdt: string;
    } = { eventsTotal: 0, paidTotal: 0, accruedUsdt: "0.00" };
    if (refCode) {
      const events = await db.referralEvent.findMany({
        where: { refCode },
        select: { kind: true, payoutUsdt: true },
      });
      const paid = events.filter((e) => e.kind === "paid");
      referral = {
        eventsTotal: events.length,
        paidTotal: paid.length,
        accruedUsdt: paid
          .reduce((s, e) => s + Number(e.payoutUsdt ?? 0), 0)
          .toFixed(2),
      };
    }

    return NextResponse.json(
      {
        wallet: wallet ?? null,
        email: email ?? null,
        refCode,
        inviteUrl: refCode ? `${origin(req)}/market?ref=${refCode}` : null,
        bonusCredits,
        badges,
        reach,
        referral,
        bonusesEnabled: FEATURES.bonuses,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }
}
