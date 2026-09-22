import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/features";

/* ================================================================
   Magic Link (task 44, ТЗ §2) — email-вход как ДОПОЛНЕНИЕ к кошельку.

   Полностью бесплатно: POST https://api.resend.com/emails (без SDK),
   Resend Free — 3000 писем/мес. Токен одноразовый, TTL 15 минут,
   в БД живёт только sha256(token) — утечка базы не раскрывает ссылки.

   Сессия: httpOnly cookie nr_email (30 дней), та же схема, что у
   nr_phantom/nr_wallet. Связка email↔wallet — через MagicUser:
   при verify с активной wallet-сессией или wallet-входе с активной
   email-сессией (best-effort).

   Без RESEND_API_KEY / при FEATURE_MAGIC_LINK=0 всё выключено.
   ================================================================ */

export const EMAIL_COOKIE = "nr_email";
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;
const TOKEN_TTL_MIN = 15;

function tokenHashOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function magicLinkEnabled(): boolean {
  return FEATURES.magicLink;
}

export function emailSession(req: { cookies: { get(name: string): { value?: string } | undefined } }): string | null {
  const email = req.cookies.get(EMAIL_COOKIE)?.value?.toLowerCase();
  return email && EMAIL_RE.test(email) ? email : null;
}

/**
 * Создать одноразовый токен и отправить письмо. Возвращает true, даже если
 * письмо не ушло (анти-энумерация): решает вызывающий роут.
 */
export async function sendMagicLink(email: string, origin: string): Promise<boolean> {
  const token = randomBytes(24).toString("hex");
  try {
    await db.magicLogin.create({
      data: {
        email,
        tokenHash: tokenHashOf(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MIN * 60_000),
      },
    });
  } catch {
    return false;
  }

  const link = `${origin}/api/auth/magic/verify?token=${token}`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "no reality. <onboarding@resend.dev>",
        to: [email],
        subject: "your no reality. sign-in link",
        html: [
          `<p style="font:15px/1.5 sans-serif;color:#10161d">one tap and you are in — the link works once and expires in ${TOKEN_TTL_MIN} minutes:</p>`,
          `<p style="margin:20px 0"><a href="${link}" style="background:#0a0a0a;color:#fff;padding:11px 22px;border-radius:999px;font:700 14px sans-serif;text-decoration:none">enter no reality.</a></p>`,
          `<p style="font:12px/1.5 sans-serif;color:#8a8f98">if it wasn't you — ignore this letter, nothing will happen.</p>`,
        ].join(""),
        text: `your no reality. sign-in link (works once, ${TOKEN_TTL_MIN} min): ${link}`,
      }),
    });
    if (!r.ok) {
      console.error("[magic] resend rejected:", r.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[magic] resend failure:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Проверить токен: валиден/неиспользован/не истёк → пометить used и
 * вернуть email. Иначе null.
 */
export async function consumeMagicToken(token: string): Promise<string | null> {
  if (!/^[\da-f]{48}$/.test(token)) return null;
  try {
    const row = await db.magicLogin.findUnique({
      where: { tokenHash: tokenHashOf(token) },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
    await db.magicLogin.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return row.email;
  } catch {
    return null;
  }
}

/**
 * Связка email ↔ wallet (MagicUser) — обе личности в одном аккаунте.
 * Вызывается best-effort из magic-verify (есть wallet-cookie) и из
 * wallet-auth (есть email-cookie).
 */
export async function linkMagicUser(email: string, wallet: string): Promise<void> {
  const e = email.toLowerCase();
  const w = wallet.toLowerCase();
  if (!EMAIL_RE.test(e) || !w) return;
  try {
    await db.magicUser.upsert({
      where: { email: e },
      create: { email: e, wallet: w },
      update: { wallet: w },
    });
  } catch {
    /* связка не критична */
  }
}
