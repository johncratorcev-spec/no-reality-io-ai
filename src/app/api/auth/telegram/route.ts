import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyLedger, ECON, accountView, ensureAccount } from "@/lib/account";
import { attributeReferral, ensureRefCode } from "@/lib/referral";
import { setSessionCookies } from "@/lib/auth/session";
import {
  telegramBotToken,
  verifyTelegramPayload,
  telegramDisplayName,
  type TelegramLoginPayload,
} from "@/lib/auth/telegram";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * v11 — POST /api/auth/telegram: вход по Telegram Login Widget.
 *
 * ЕДИНСТВЕННЫЙ ВХОД КАМПАНИИ SEASON 1 (приказ: «заморозить контур»):
 *   - подпись проверяется строго (HMAC, спека Telegram) — фальшивый
 *     payload невозможен без bot_token;
 *   - telegramId существует → вход (welcome НЕ повторяется — он
 *     идемпотентен по refKey signup:<id>);
 *   - нового telegramId привязываем к ЛЕГАси-гостю (cookie nr_uid без
 *     email-аккаунта) — баланс гостя сохраняется; иначе новый аккаунт
 *     + welcome +100 EYE ровно один раз + NR PASS;
 *   - сессия: nr_uid + nr_auth (HMAC) — та же, что у password/google.
 *
 * Секретные коды убраны вовсе (v12): Telegram-вход — главная дверь
 * кампании для BD-трафика, email/google — открытые запасные двери.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const rl = rateLimit(`tg-auth:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  /* только строковые поля подписи — виджет присылает именно их */
  const p: TelegramLoginPayload = {
    id: typeof body.id === "string" ? body.id : String(body.id ?? ""),
    first_name: typeof body.first_name === "string" ? body.first_name.slice(0, 64) : undefined,
    last_name: typeof body.last_name === "string" ? body.last_name.slice(0, 64) : undefined,
    username: typeof body.username === "string" ? body.username.slice(0, 32) : undefined,
    photo_url: typeof body.photo_url === "string" ? body.photo_url.slice(0, 512) : undefined,
    auth_date: typeof body.auth_date === "string" ? body.auth_date : String(body.auth_date ?? ""),
    hash: typeof body.hash === "string" ? body.hash : "",
  };

  const verdict = verifyTelegramPayload(p, telegramBotToken());
  if (!verdict.ok) {
    /* единая generic-ошибка наружу (детали — только в лог) */
    console.log("[auth/telegram] rejected:", verdict.reason || "unknown");
    return NextResponse.json({ ok: false, error: "telegram_verification_failed" }, { status: 401 });
  }

  try {
    /* --- 1. существующий telegram-аккаунт → вход --- */
    const existing = await db.account.findUnique({ where: { telegramId: p.id } });
    if (existing) {
      await db.account
        .updateMany({
          where: { id: existing.id, passTier: 0 },
          data: {
            passTier: 1,
            tgUsername: p.username ?? null,
            displayName: telegramDisplayName(p) || null,
          },
        })
        .catch(() => null);
      await ensureRefCode(existing.id).catch(() => null);
      const fresh = await db.account.findUniqueOrThrow({ where: { id: existing.id } });
      const res = NextResponse.json({
        ok: true,
        created: false,
        account: accountView(fresh),
      });
      return setSessionCookies(res, fresh.id);
    }

    /* --- 2. новый telegramId: сначала пробуем усыновить легаси-гостя --- */
    const ghostUid = req.cookies.get("nr_uid")?.value || "";
    if (/^[0-9a-f-]{36}$/i.test(ghostUid)) {
      const ghost = await db.account.findUnique({
        where: { id: ghostUid },
        select: { id: true, telegramId: true, email: true },
      });
      /* усыновление безопасно только если у гостя нет ни telegram, ни email-аккаунта */
      if (ghost && !ghost.telegramId) {
        const hasEmailAuth = await db.emailAuth.findUnique({ where: { accountId: ghost.id } });
        if (!hasEmailAuth) {
          const attached = await db.account.updateMany({
            where: { id: ghost.id, telegramId: null },
            data: {
              telegramId: p.id,
              tgUsername: p.username ?? null,
              displayName: telegramDisplayName(p) || null,
              passTier: 1,
            },
          });
          if (attached.count === 1) {
            if (ECON.welcomeBonusCents > 0) {
              await applyLedger(ghost.id, ECON.welcomeBonusCents, "signup_bonus", `signup:${ghost.id}`);
            }
            /* v14: код с регистрации + атрибуция пригласившего (?ref —
               тело ИЛИ cookie nr_ref от ловца на клиенте) */
            await ensureRefCode(ghost.id).catch(() => null);
            await attributeReferral(ghost.id, body.ref ?? req.cookies.get("nr_ref")?.value).catch(() => null);
            const fresh = await db.account.findUniqueOrThrow({ where: { id: ghost.id } });
            const res = NextResponse.json({
              ok: true,
              created: true,
              adopted: true,
              account: accountView(fresh),
            });
            return setSessionCookies(res, fresh.id);
          }
        }
      }
    }

    /* --- 3. чистый новый аккаунт: welcome +100 EYE ровно один раз --- */
    const id = randomUUID();
    const { deriveAccountRefCode } = await import("@/lib/referral");
    await db.account.create({
      data: {
        id,
        telegramId: p.id,
        tgUsername: p.username ?? null,
        displayName: telegramDisplayName(p) || null,
        passTier: 1,
        refCode: deriveAccountRefCode(id),
      },
    });
    if (ECON.welcomeBonusCents > 0) {
      const credited = await applyLedger(id, ECON.welcomeBonusCents, "signup_bonus", `signup:${id}`, {
        telegram: p.id,
      });
      console.log(
        "[auth/telegram] signup_bonus",
        JSON.stringify({ accountId: id, cents: credited ? ECON.welcomeBonusCents : 0 })
      );
    }
    const fresh = await db.account.findUniqueOrThrow({ where: { id } });
    /* v14: атрибуция нового аккаунта по ?ref (тело ИЛИ cookie nr_ref) */
    await attributeReferral(id, body.ref ?? req.cookies.get("nr_ref")?.value).catch(() => null);
    const res = NextResponse.json({ ok: true, created: true, account: accountView(fresh) });
    return setSessionCookies(res, id);
  } catch (e) {
    console.error("[auth/telegram] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "account_failed" }, { status: 500 });
  }
}
