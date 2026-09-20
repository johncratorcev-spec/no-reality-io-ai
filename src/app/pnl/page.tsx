import type { Metadata } from "next";
import Link from "next/link";
import Menu from "@/components/menu/Menu";
import { SITE } from "@/lib/site";
import PnlWallet from "./PnlWallet";

export const metadata: Metadata = {
  title: "pnl wallet — no reality.",
  description:
    "Your prediction positions, pari-mutuel payouts and USDC claims — the pnl wallet of no reality.",
  alternates: { canonical: "/pnl" },
  openGraph: {
    title: "pnl wallet — no reality.",
    description:
      "Every position you fixed in the cryo feed: staked, won, lost, claimable — one honest wallet view.",
    url: `${SITE.url}/pnl`,
    type: "website",
  },
};

/* ================================================================
   PNL WALLET (/pnl) — task 42, пункт 8.

   Кошелёк предикшенов: все позиции (ДА/НЕТ по $1 USDC), статусы
   рынков, пари-мьютюэль выплаты и клейм. Сессия — Phantom-cookie;
   гостевые demo-позиции читаются по localStorage-адресу.
   ================================================================ */

export default function PnlPage() {
  return (
    <main className="min-h-dvh bg-white text-[#10161d]">
      <section className="relative overflow-hidden bg-white pb-10 pt-14 sm:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(56% 72% at 72% 8%, rgba(168,207,234,.22), transparent 60%), radial-gradient(48% 60% at 12% 88%, rgba(183,157,255,.14), transparent 60%), radial-gradient(38% 42% at 45% 42%, rgba(125,211,252,.12), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="mb-10 flex items-center gap-3">
            <Link
              href="/"
              className="nr-logo select-none text-[1.2rem] font-extrabold leading-none tracking-tight"
            >
              no reality.
            </Link>
            <div className="ml-auto">
              <Menu />
            </div>
          </div>

          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#3d7db8]">
            prediction layer
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">
            pnl wallet
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/60">
            every position you fixed in the feed — staked, won, lost and
            claimable USDC. one honest wallet, no spreadsheets.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <PnlWallet />
      </section>
    </main>
  );
}
