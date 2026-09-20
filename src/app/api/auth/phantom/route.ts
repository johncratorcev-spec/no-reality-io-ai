import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const dynamic = "force-dynamic";

/* ================================================================
   Авторизация с Phantom Wallet (task 42, пункт 3).

   POST { wallet, message, signature } — base58-подпись ed25519
   над сообщением вида:
     no reality. sign in
     wallet: <base58>
     time: <ISO>
   Сервер проверяет:
     - форму base58-публичного ключа (32 байта, каноничная запись);
     - свежесть сообщения (±10 минут — stateless-анти-реплей);
     - ed25519-подпись (tweetnacl, без внешних сервисов).
   Успех → httpOnly cookie nr_phantom на 30 дней.

   GET    → { wallet, provider: "phantom" } | { wallet: null }
   DELETE → выход.
   ================================================================ */

const COOKIE = "nr_phantom";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней
const FRESH_MS = 10 * 60 * 1000;

/** каноничный Solana base58-адрес: декодируется в 32 байта и кодируется назад */
function isSolanaWallet(addr: string): boolean {
  try {
    const bytes = bs58.decode(addr);
    if (bytes.length !== 32) return false;
    return bs58.encode(bytes) === addr;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const wallet = req.cookies.get(COOKIE)?.value;
  if (!wallet || !isSolanaWallet(wallet)) {
    return NextResponse.json({ wallet: null });
  }
  return NextResponse.json({ wallet, provider: "phantom" });
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`auth:phantom:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { wallet?: unknown; message?: unknown; signature?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const wallet =
    typeof body.wallet === "string" ? body.wallet.trim() : "";
  const message =
    typeof body.message === "string" ? body.message : "";
  const signature =
    typeof body.signature === "string" ? body.signature : "";

  if (!isSolanaWallet(wallet)) {
    return NextResponse.json(
      { error: "Not a valid Solana address — connect Phantom" },
      { status: 400 }
    );
  }

  // свежесть: сообщение содержит ISO-время не старше ±10 минут
  const m = message.match(/time: (.+)$/m);
  if (!m || !message.includes(`wallet: ${wallet}`)) {
    return NextResponse.json({ error: "Bad sign-in message" }, { status: 400 });
  }
  const ts = Date.parse(m[1]);
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > FRESH_MS) {
    return NextResponse.json(
      { error: "Sign-in message expired" },
      { status: 400 }
    );
  }

  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signature);
    const pubBytes = bs58.decode(wallet);
    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    if (!ok) {
      return NextResponse.json({ error: "Signature invalid" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Signature invalid" }, { status: 400 });
  }

  const res = NextResponse.json({ wallet, provider: "phantom" });
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
