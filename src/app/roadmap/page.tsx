import type { Metadata } from "next";
import RoadmapClient from "./RoadmapClient";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "roadmap — internal balance → $NR token on Base",
  description:
    "Where no reality. goes next: instant accounts and internal balance today, reward seasons next, then the $NR token on Base — internal currency converts to real money.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "no reality. roadmap — $NR on Base",
    description:
      "Internal balance economy: earn for clicks and UTM links, play predictions, and when the token lands on Base — convert to real money.",
    url: `${SITE.url}/roadmap`,
    type: "website",
  },
};

/* ================================================================
   ROADMAP (/roadmap) — карта дорожная v6.

   1) NOW — внутренняя экономика: мгновенные аккаунты (порог входа = 0),
      внутренний баланс, награды за целевые клики и UTM-переходы,
      NR PASS, крипто-пополнение через 2328.io.
   2) NEXT — сезоны/турниры, призы во внутренней валюте, бусты авторов.
   3) BASE — токен $NR на Base: внутренняя валюта конвертируется
      в реальные деньги (1:1 на TGE), ончейн-лидерборд, награды за UTM
      в $NR.
   ================================================================ */

export default function RoadmapPage() {
  return (
    <main className="nrld-page min-h-dvh text-white">
      <section className="relative overflow-hidden pb-16 pt-14 sm:pt-16">
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="mb-10 flex items-center gap-3">
            <a
              href="/"
              className="nrld-logo select-none text-[1.2rem] font-extrabold leading-none tracking-tight"
            >
              no reality.
            </a>
          </div>
          <RoadmapClient />
        </div>
      </section>
    </main>
  );
}
