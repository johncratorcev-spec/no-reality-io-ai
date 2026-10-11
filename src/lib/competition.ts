/**
 * v15 — соревнования (общий сервер/клиент, без server-only).
 *
 * bd помечает клип badge="raffle-NN" — сервер признаёт соревнованием
 * ТОЛЬКО точное совпадение с шаблоном raffle-NN (NN — 1..2 цифры);
 * произвольный текст из badge соревнованием не становится.
 *
 * v18 — сезонный бейдж "halloween-party": КОСМЕТИЧЕСКИЙ (тыква-чип в
 * ленте), соревнованием/раффлом НЕ является (без золотого оформления
 * и призовой механики). Признаётся сервером только точным совпадением.
 */

export const HALLOWEEN_BADGE = "halloween-party";

export function competitionCodeOf(badge: string | null | undefined): string | null {
  const m = /^raffle-(\d{1,2})$/.exec((badge || "").trim());
  return m ? `raffle-${m[1].padStart(2, "0")}` : null;
}

/** сезонный косметический бейдж (v18): точное совпадение, без механики */
export function isHalloweenBadge(badge: string | null | undefined): boolean {
  return (badge || "").trim().toLowerCase() === HALLOWEEN_BADGE;
}

/** валидный ли бейдж вообще (админ-API/bd): соревнование или хэллуин */
export function isValidBadge(badge: string | null | undefined): boolean {
  return Boolean(competitionCodeOf(badge) || isHalloweenBadge(badge));
}

/** номер для показа: "raffle-01" → "01" */
export function competitionNumberOf(competition: string | null | undefined): string {
  const m = /^raffle-(\d{1,2})$/.exec(competition || "");
  return m ? m[1].padStart(2, "0") : "";
}
