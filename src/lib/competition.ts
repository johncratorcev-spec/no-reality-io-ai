/**
 * v15 — соревнования (общий сервер/клиент, без server-only).
 *
 * bd помечает клип badge="raffle-NN" — сервер признаёт соревнованием
 * ТОЛЬКО точное совпадение с шаблоном raffle-NN (NN — 1..2 цифры);
 * произвольный текст из badge соревнованием не становится.
 */

export function competitionCodeOf(badge: string | null | undefined): string | null {
  const m = /^raffle-(\d{1,2})$/.exec((badge || "").trim());
  return m ? `raffle-${m[1].padStart(2, "0")}` : null;
}

/** номер для показа: "raffle-01" → "01" */
export function competitionNumberOf(competition: string | null | undefined): string {
  const m = /^raffle-(\d{1,2})$/.exec(competition || "");
  return m ? m[1].padStart(2, "0") : "";
}
