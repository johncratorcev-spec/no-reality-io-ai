import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { magicLinkEnabled } from "@/lib/magic";

export const dynamic = "force-dynamic";

/* ================================================================
   POST /api/auth/magic/request — выслать Magic Link на email
   (task 44, ТЗ §2). Бесплатно через Resend (3000 писем/мес).

   Лимиты: 5 писем / 15 мин на email, 10 / час на IP.
   Анти-энумерация: ответ всегда 200 { ok: true } — существует
   аккаунт или нет, наружу не различимо.
   ================================================================ */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;

export async function POST(req: NextRequest) {
  if (!magicLinkEnabled()) {
    return NextResponse.json(
      { error: "Magic link sign-in is not configured" },
      { status: 501 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`magic:ip:${ip}`, 10, 3_600_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    /* битое тело → 400 ниже */
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (!rateLimit(`magic:email:${email}`, 5, 900_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const fallback = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const origin = fallback || (host ? `${proto}://${host}` : "");

  const { sendMagicLink } = await import("@/lib/magic");
  await sendMagicLink(email, origin);

  // анти-энумерация: не раскрываем, доставилось ли письмо
  return NextResponse.json({ ok: true });
}
