import { seasonInfo } from "@/lib/season";
import HalloweenLanding from "./HalloweenLanding";

/**
 * v19 — ЛЕНДИНГ «СУДНАЯ НОЧЬ»: server shell (данные сезона из БД,
 * гвард от недоступной БД — hotfix digest 1559654748) + клиентский
 * анимированный онбординг → /auth. v13-текстовая кампания (SeasonLanding-
 * Client) и карнавал-манифест (Landing.tsx) заморожены.
 */
export default async function SeasonLanding() {
  /* БД недоступна (ингресс/пулер/деплой с кривым env) — лендинг всё равно
     должен отдавать 200: fallback hasSeason=false, daysLeft=7. */
  const season = await seasonInfo().catch(() => null);
  const daysLeft = season?.daysLeft ?? 7;

  return (
    <HalloweenLanding
      snapshotLabel={season?.snapshotLabel ?? ""}
      hasSeason={Boolean(season)}
      dayOf={daysLeft > 0 ? 8 - daysLeft : 0}
    />
  );
}
