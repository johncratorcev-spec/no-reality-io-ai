import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { seasonInfo } from "@/lib/season";
import SeasonLandingClient from "./SeasonLandingClient";

/**
 * v13 — ЛЕНДИНГ КАМПАНИИ: server shell (данные сезона из БД) +
 * клиентский i18n-рендер (ru/en, дерзкий тон, ноль кураторской
 * лексики). Старый карнавал-манифест (Landing.tsx) заморожен.
 */
export default async function SeasonLanding() {
  const season = await seasonInfo();
  const daysLeft = season?.daysLeft ?? 7;

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0910]">
      <Header />
      <SeasonLandingClient
        snapshotLabel={season?.snapshotLabel ?? ""}
        hasSeason={Boolean(season)}
        dayOf={daysLeft > 0 ? 8 - daysLeft : 0}
      />
      <Footer />
    </div>
  );
}
