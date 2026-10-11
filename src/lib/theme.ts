/**
 * v18 — сезонные темы оформления.
 *
 * Halloween («судная ночь»): авто-включается на сезон (1 окт — 7 ноя),
 * env NR_THEME перекрывает: "halloween" — включить всегда, "off" — выключить.
 * Класс вешается на <html> в root layout (server component, ноль CLS):
 * вся тематика — чистый CSS поверх .nr-halloween (globals.css),
 * анимации только transform/opacity + prefers-reduced-motion.
 */

export type SeasonTheme = "default" | "halloween";

/** окно сезона: 1 октября — 7 ноября (UTC) */
function inHalloweenWindow(now: Date): boolean {
  const m = now.getUTCMonth(); // 0-based: 9 = октябрь, 10 = ноябрь
  const d = now.getUTCDate();
  return (m === 9 && d >= 1) || (m === 10 && d <= 7);
}

/** активная тема (server: layout.tsx; env NR_THEME перекрывает календарь) */
export function activeSeasonTheme(now: Date = new Date()): SeasonTheme {
  const t = (process.env.NR_THEME || "").trim().toLowerCase();
  if (t === "halloween") return "halloween";
  if (t === "off" || t === "default") return "default";
  return inHalloweenWindow(now) ? "halloween" : "default";
}

/** классы для <html> по активной теме */
export function seasonThemeClass(theme: SeasonTheme): string {
  return theme === "halloween" ? "nr-halloween" : "";
}
