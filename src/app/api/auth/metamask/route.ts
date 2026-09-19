import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import {
  WALLET_RE,
  deriveRefCode,
  upsertReferralProfile,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

/* ================================================================
   Простейшая авторизация с MetaMask (MVP).

   POST { address } → валидируем форму адреса EOA, ставим httpOnly
   cookie-сессию на 30 дней и регистрируем реферальный код.
   Подпись personal_sign (nonce → verify) — следующий шаг хардненинга;
   для MVP риска немного: кошелёк = адрес выплат, спуфить чужой адрес
   бессмысленно (деньги уйдут владельцу адреса).

   GET    → текущая сессия { wallet, refCode, inviteUrl } | { wallet: null }
   DELETE → выход (сброс cookie)
   ================================================================ */

const COOKIE = "nr_wallet";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней

function origin(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function sessionPayload(
  wallet: string,
  refCode: string,
  req: NextRequest
) {
  return {
    wallet,
    refCode,
    inviteUrl: `${origin(req)}/market?ref=${refCode}`,
  };
}

export async function GET(req: NextRequest) {
  const wallet = req.cookies.get(COOKIE)?.value?.toLowerCase();
  if (!wallet || !WALLET_RE.test(wallet)) {
    return NextResponse.json({ wallet: null });
  }
  const refCode = (await upsertReferralProfile(wallet)) ?? deriveRefCode(wallet);
  return NextResponse.json(sessionPayload(wallet, refCode, req));
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`auth:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let address = "";
  try {
    const body = (await req.json()) as { address?: unknown };
    address = typeof body.address === "string" ? body.address.trim() : "";
  } catch {
    /* пустое/битое тело — отдаст 400 ниже */
  }

  if (!WALLET_RE.test(address)) {
    return NextResponse.json(
      { error: "Not a valid Ethereum address — connect MetaMask" },
      { status: 400 }
    );
  }

  const wallet = address.toLowerCase();
  const refCode =
    (await upsertReferralProfile(wallet)) ?? deriveRefCode(wallet);

  const res = NextResponse.json(sessionPayload(wallet, refCode, req));
  res.cookies.set(COOKIE, wallet, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, wallet: null });
  res.cookies.set(COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
