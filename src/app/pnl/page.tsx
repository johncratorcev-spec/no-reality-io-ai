import type { Metadata } from "next";
import Link from "next/link";
import Menu from "@/components/menu/Menu";
import { SITE } from "@/lib/site";
import PositionsPanel from "./PositionsPanel";
import PnlWallet from "./PnlWallet";
import ProfilePanel from "./ProfilePanel";

export const metadata: Metadata = {
  title: "pnl wallet",
  description:
    "Your REAL/SYNTH positions, pari-mutuel payouts and USDT cash-out via 2328.io — the pnl wallet of no reality.",
  alternates: { canonical: "/pnl" },
  openGraph: {
    title: "pnl wallet",
    description:
      "Every position you fixed in the seam: staked, won, lost, claimable — one honest wallet view. Cash out in USDT via 2328.io.",
    url: `${SITE.url}/pnl`,
    type: "website",
  },
};

/* ================================================================
   PNL WALLET (/pnl) — единый кровавый карнавал.

   1) POSITIONS — ставки REAL/SYNTH + кэшаут через 2328.io Payout
      (USDT, сеть по формату кошелька). Тёмная панель, motion.
   2) PnlWallet — предикшен-слой (cryo, USDC) — legacy-шим красит.
   3) ProfilePanel — «share the seam»: рефералка 20% вместо охватов.
   ================================================================ */

export default function PnlPage() {
  return (
    <main className="nrld-page min-h-dvh text-white">
      <section className="relative overflow-hidden pb-8 pt-14 sm:pt-16">
        <div className="relative mx-auto max-w-4xl px-5">
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
            the ledger
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl">
            pnl wallet
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-white/60">
            every position you fixed in the seam — staked, won, lost and
            claimable USDT. cash out through 2328.io, no spreadsheets.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <PositionsPanel />
        {/* предикшен-слой (cryo USDC) — legacy-шим перекрашивает в тёмное */}
        <PnlWallet />
        {/* шаринг и рефералка: 20% с рейка приведённого глаза */}
        <ProfilePanel />
      </section>
    </main>
  );
}
