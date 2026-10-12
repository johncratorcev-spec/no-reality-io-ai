import type { Metadata } from "next";
import Link from "next/link";
import Menu from "@/components/menu/Menu";
import { SITE } from "@/lib/site";
import CabinetClient from "./CabinetClient";

export const metadata: Metadata = {
  title: "cabinet — no-reality.",
  description:
    "Your EYE balance, PnL, winrate, streaks, badges and referral stats — the personal cabinet of no reality. EYE is play-only: value exits through the season snapshot.",
  alternates: { canonical: "/cabinet" },
  openGraph: {
    title: "cabinet — no-reality.",
    description:
      "EYE balance, PnL day/season, winrate, streaks, badges and referrals — one honest view of your eye.",
    url: `${SITE.url}/cabinet`,
    type: "website",
  },
};

/* ================================================================
   CABINET (/cabinet) — личный кабинет игрока (v20, ТЗ §6–§7).
   Мобильный-first, тёмная панель nrld-panel-blood, всё одним срезом
   из /api/me/summary. Отсюда — /bet (ставить) и /pnl (позиции).
   ================================================================ */

export default function CabinetPage() {
  return (
    <main className="nrld-page min-h-dvh text-white">
      <section className="relative overflow-hidden pb-6 pt-14 sm:pt-16">
        <div className="relative mx-auto max-w-3xl px-5">
          <div className="mb-10 flex items-center gap-3">
            <Link
              href="/"
              className="nrld-logo select-none text-[1.2rem] font-extrabold leading-none tracking-tight"
            >
              no reality.
            </Link>
            <div className="ml-auto">
              <Menu variant="dark" />
            </div>
          </div>

          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#ff4d6e]">
            your eye
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl">
            cabinet
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-white/60">
            EYE balance is for play only — it never leaves the game. The season
            snapshot turns your weight (activity, streaks, referrals, winrate)
            into $NR.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24">
        <CabinetClient />
      </section>
    </main>
  );
}
