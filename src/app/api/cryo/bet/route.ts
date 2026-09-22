import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import { rateLimit } from "@/lib/rateLimit";
import { placeCryoBet } from "@/lib/cryo/core";
import { CRYO } from "@/lib/cryo/config";
import { BONUS, spendBonusCredit } from "@/lib/bonuses";

export const dynamic = "force-dynamic";

/**
 * POST /api/cryo/bet — fix a position of ANY USDC amount (task 43; direct
 * transfer to the treasury via Phantom, demo mode without on-chain).
 * Task 44: side = ключ нарративной опции ("yes"/"no" или произвольный —
 * валидация по конфигу рынка в placeCryoBet); mode "bonus" — БЕСПЛАТНЫЙ
 * прогноз из welcome-кредитов (сессия обязана совпадать с кошельком ставки).
 * Body: { postCode, side, wallet, amount: "0.10".."500.00",
 *         mode: "demo"|"phantom"|"bonus", txSig?, betRef? }
 *
 * 200 → { market } (fresh view with the wallet position)
 * 400 → bad amount / bad side / phantom transaction failed USDC verification
 * 401 → bonus bet without a matching session
 * 409 → market frozen/closed, position already fixed, or no bonus credits
 * 503 → DB unavailable (client degrades to a localStorage position)
 */

/** та же проверка сессии, что в favorites (cookie → адрес) */
function sessionWallet(req: NextRequest): string | null {
  const sol = req.cookies.get("nr_phantom")?.value;
  if (sol) {
    try {
      const bytes = bs58.decode(sol);
      if (bytes.length === 32 && bs58.encode(bytes) === sol) return sol;
    } catch {
      /* fall through */
    }
  }
  const evm = req.cookies.get("nr_wallet")?.value?.toLowerCase();
  if (evm && /^0x[a-f0-9]{40}$/.test(evm)) return evm;
  return null;
}
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cryo:bet:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
    postCode?: string;
    side?: string;
    wallet?: string;
    amount?: string;
    mode?: string;
    txSig?: string;
    betRef?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body.postCode || !body.side || !body.wallet) {
    return NextResponse.json(
      { error: "postCode, side, wallet required" },
      { status: 400 }
    );
  }

  // --- task 44: бесплатный прогноз — списываем кредит, фиксируем номинал.
  //     Сессия обязана совпадать с кошельком ставки (иначе спуф credits). ---
  let mode: "demo" | "phantom" | "bonus" =
    body.mode === "phantom" ? "phantom" : "demo";
  let amount = body.amount ?? CRYO.betAmountUsdc;
  if (body.mode === "bonus") {
    const session = sessionWallet(req);
    if (!session || session.toLowerCase() !== body.wallet.toLowerCase()) {
      return NextResponse.json(
        { error: "sign in to use a free prediction" },
        { status: 401 }
      );
    }
    const ok = await spendBonusCredit(session.toLowerCase());
    if (!ok) {
      return NextResponse.json(
        { error: "no free predictions left" },
        { status: 409 }
      );
    }
    mode = "bonus";
    amount = BONUS.bonusStakeUsdc;
  }

  const res = await placeCryoBet({
    postCode: body.postCode,
    side: body.side, // валидация по опциям рынка — внутри placeCryoBet
    wallet: body.wallet,
    amount,
    mode,
    txSig: body.txSig || null,
    betRef: body.betRef || null,
  });

  if (!res.ok && mode === "bonus") {
    // ставка не прошла — возвращаем кредит (компенсация, best-effort)
    const session = sessionWallet(req);
    if (session) {
      try {
        const { db } = await import("@/lib/db");
        await db.userProfile
          .upsert({
            where: { wallet: session.toLowerCase() },
            create: { wallet: session.toLowerCase(), bonusCredits: 1 },
            update: { bonusCredits: { increment: 1 } },
          })
          .catch(() => {});
        console.info(
          `[money-op] bonus credit refunded: wallet=${session.toLowerCase()} (bet ${res.status})`
        );
      } catch {
        /* компенсация не критична */
      }
    }
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status }
    );
  }
  return NextResponse.json({ market: res.view });
}
