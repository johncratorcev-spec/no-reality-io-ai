import "server-only";

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureAccount, ECON, applyLedger } from "@/lib/account";
import { attributeReferral } from "@/lib/referral";
import { awardBadge, countAccounts } from "@/lib/badges";
import { trackEvent } from "@/lib/bet/events";
import { visitorHashOf } from "@/lib/utm";

/**
 * v21 — ЕДИНАЯ точка входа по подтверждённому email (Supabase Auth:
 * сюда приходят и парольная сессия, и magic-OTP). Google-провайдер
 * выключен (v21);passport-легаси удалён.
 *
 * Логика связки (наследие v16, сохранено):
 *   - email уже с аккаунтом → вход (+ passTier, поздняя атрибуция ?ref);
 *   - живой гость (nr_uid без email) → аккаунт гостя усыновляется
 *     (баланс не теряется);
 *   - новый email → свежий аккаунт (+ welcome, + xref-бонус по ?ref,
 *     + Early Bird в первые 1000).
 *
 * v20 (крючковая экономика): в момент РЕГИСТРАЦИИ снимаем антфрод-
 * отпечатки (fp/ip) — они становятся контекстом реферальной квалификации
 * (один device/IP не может быть referrer'ом и referee одновременно).
 */

export interface IdentityProfile {
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Антфрод-отпечатки = КАНОНический visitorHashOf (lib/utm): тот же хеш,
 * что у ставок/кликов. Это даёт сквозную проверку «один device/IP не может
 * быть referrer'ом и referee одновременно»: signupFp == fingerprint ставки.
 */
export function authFingerprint(ip: string, ua: string): string {
  return visitorHashOf(ip, ua);
}

export function authIpHash(ip: string): string {
  const salt = process.env.VISITOR_SALT || process.env.ADMIN_SECRET || "no-reality-salt";
  return createHash("sha256").update(`ip:${ip}::${salt}`).digest("hex").slice(0, 40);
}

export function reqIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function reqUa(req: NextRequest): string {
  return req.headers.get("user-agent")?.slice(0, 220) || "unknown";
}

/**
 * Вход/регистрация по email. Возвращает accountId сессии.
 * refRaw — значение cookie nr_ref (если было).
 */
export async function signInWithEmailIdentity(
  profile: IdentityProfile,
  req: NextRequest
): Promise<{ accountId: string; linked: boolean; newAccount: boolean }> {
  const email = profile.email.toLowerCase();
  const refRaw = req.cookies.get("nr_ref")?.value;
  const fp = authFingerprint(reqIp(req), reqUa(req));
  const ipHash = authIpHash(reqIp(req));

  const byEmail = await db.account.findUnique({ where: { email } });
  if (byEmail) {
    if (!byEmail.passTier) {
      await db.account.updateMany({
        where: { id: byEmail.id, passTier: 0 },
        data: { passTier: 1 },
      });
    }
    /* поздняя атрибуция (если аккаунт ещё без пригласившего) */
    if (refRaw) {
      await attributeReferral(byEmail.id, refRaw).catch(() => null);
    }
    /* добираем недостающие антфрод-поля у старых аккаунтов */
    await db.account
      .updateMany({
        where: { id: byEmail.id, OR: [{ signupFp: null }, { signupIpHash: null }] },
        data: { signupFp: byEmail.signupFp ?? fp, signupIpHash: byEmail.signupIpHash ?? ipHash },
      })
      .catch(() => null);
    void trackEvent("auth_signin", { meta: { provider: "supabase", linked: true } });
    return { accountId: byEmail.id, linked: false, newAccount: false };
  }

  /* гостевой аккаунт из cookie nr_uid — если жив, входим в него */
  const guestId = req.cookies.get("nr_uid")?.value;
  if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
    const guest = await db.account.findUnique({ where: { id: guestId } });
    if (guest && !guest.email) {
      const linked = await db.account
        .update({
          where: { id: guest.id },
          data: { email, passTier: 1, displayName: guest.displayName ?? profile.name ?? null, signupFp: guest.signupFp ?? fp, signupIpHash: guest.signupIpHash ?? ipHash },
        })
        .then(() => true)
        .catch(() => false);
      if (linked) {
        await ensureAccount(guest.id);
        if (refRaw) {
          await attributeReferral(guest.id, refRaw).catch(() => null);
        }
        void trackEvent("auth_signin", { meta: { provider: "supabase", linked: true } });
        return { accountId: guest.id, linked: true, newAccount: false };
      }
    }
  }

  /* свежий аккаунт: Supabase = регистрация с порогом 0 */
  const refCode = typeof refRaw === "string" ? refRaw : undefined;
  const acc = await ensureAccount(globalThis.crypto.randomUUID(), refCode);
  await db.account.update({
    where: { id: acc.id },
    data: {
      email,
      passTier: 1,
      displayName: profile.name ?? null,
      signupFp: fp,
      signupIpHash: ipHash,
    },
  });

  /* xref-бонус: пришёл по ссылке → extra EYE сразу (двусторонняя модель:
     referee-часть; referrer-часть платится после ПЕРВОЙ ставки друга) */
  if (refCode && ECON.refWelcomeExtraCents > 0) {
    const attributed = await db.account
      .findUnique({ where: { id: acc.id }, select: { referredById: true } })
      .then((r) => Boolean(r?.referredById))
      .catch(() => false);
    if (attributed) {
      await applyLedger(
        acc.id,
        ECON.refWelcomeExtraCents,
        "ref_welcome",
        `refwelcome:${acc.id}`,
        { ref: refCode }
      ).catch(() => false);
    }
  }

  /* Early Bird Season 1: первые 1000 аккаунтов (идемпотентно по unique) */
  if (await earlyBirdWindowOpen()) {
    void awardBadge(acc.id, "early_bird", {}).catch(() => null);
  }

  void trackEvent("auth_signup", { meta: { provider: "supabase" } });
  return { accountId: acc.id, linked: false, newAccount: true };
}

/** окно Early Bird открыто? (счётчик аккаунтов ≤ EARLY_BIRD_MAX) */
async function earlyBirdWindowOpen(): Promise<boolean> {
  try {
    const n = await countAccounts();
    return n > 0 && n <= 1000;
  } catch {
    return false;
  }
}
