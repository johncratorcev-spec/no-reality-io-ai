import { createHash } from "crypto";
import { db } from "@/lib/db";

/* ================================================================
   Персональные UTM-переходы (task 44, ТЗ §5).

   Владелец кода (ReferralProfile.code) делится ссылкой на ЛЮБОЙ объект;
   переходы по его коду пишутся в UtmClick:
     (ownerCode, targetType, targetId) × visitorHash = уникально
   visitorHash — тот же анонимный отпечаток ip+ua+секрет, что в Click:
   ни IP, ни UA, ни персональные данные не хранятся; накрутка бессмысленна.

   target_type: video (/v/[code]) | market (cryo) | banner (лендинг)
                | prompt (/market) | page (всё остальное)
   best-effort: БД недоступна → переход не пишется, UX не ломается
   (тот же принцип, что у Click/PageVisit/ReferralEvent).
   ================================================================ */

export const TARGET_TYPES = ["video", "market", "banner", "prompt", "page"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

/** каноничный код владельца: r… (ReferralProfile.code) */
export function normalizeOwnerCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return /^r[a-z0-9]{5,11}$/.test(code) ? code : null;
}

export function normalizeTargetType(raw: unknown): TargetType {
  if (typeof raw === "string" && (TARGET_TYPES as readonly string[]).includes(raw)) {
    return raw as TargetType;
  }
  return "page";
}

/** targetId: короткий код объекта (utm_code поста / якорь промпта) */
export function normalizeTargetId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const id = raw.trim();
  return /^[\w-]{0,64}$/.test(id) ? id : "";
}

/** анонимный visitor-отпечаток (канон /r/[code]) */
export function visitorHashOf(ip: string, ua: string): string {
  const secret = process.env.ADMIN_SECRET || "no-reality-secret";
  return createHash("sha256").update(`${ip}::${ua}::${secret}`).digest("hex");
}

/**
 * Запись уникального перехода. Повторный визит того же visitor'а на тот же
 * объект падает на unique-констрейнте — молча игнорируем.
 */
export async function recordUtmClick(args: {
  ownerCode: string;
  targetType: TargetType;
  targetId: string;
  visitorHash: string;
}): Promise<boolean> {
  try {
    await db.utmClick.create({
      data: {
        ownerCode: args.ownerCode,
        targetType: args.targetType,
        targetId: args.targetId,
        visitorHash: args.visitorHash,
      },
    });
    return true;
  } catch {
    return false; // дубль или БД недоступна — не страшно
  }
}
