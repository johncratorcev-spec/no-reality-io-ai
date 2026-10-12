import type { Metadata } from "next";
import BoostClient from "./BoostClient";
import Menu from "@/components/menu/Menu";

export const metadata: Metadata = {
  title: "boost your clip — featured placement",
  description:
    "Pay in USDT and pin your clip to the top of the prediction feed. 1, 3 or 7 days — the FEATURED chip and the first slot work while the timer runs.",
  alternates: { canonical: "/boost" },
  robots: { index: false, follow: true },
};

/* ================================================================
   BOOST / FEATURED CLIP (v5) — платное поднятие клипа в топ
   предикшен-ленты. Оплата ТОЛЬКО крипто: инвойс 2328.io → webhook
   paid → paidUntil → getRankedPosts поднимает клип и вешает чип
   FEATURED. Страница noindex: это инструмент создателей, не контент.
   ================================================================ */

export default function BoostPage() {
  return (
    <main className="nrld-page min-h-dvh">
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 80% at 70% 10%, rgba(200,255,0,.1), transparent 60%), radial-gradient(50% 60% at 15% 90%, rgba(255,0,60,.12), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5">
          <div className="mb-10 flex items-center gap-3">
            <a
              href="/"
              className="nr-logo select-none text-[1.2rem] font-extrabold leading-none tracking-tight"
            >
              no reality.
            </a>
            <div className="ml-auto">
              <Menu variant="dark" />
            </div>
          </div>
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#C8FF00]">
            boosted placement · crypto only
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl">
            подними клип в топ предикшен-ленты
          </h1>
          <p className="mt-4 max-w-xl text-[0.92rem] font-semibold leading-relaxed text-white/60">
            FEATURED-чип + первый экран ленты /bet, пока идёт таймер. Чем
            раньше кадр — тем больше глаз успеет поставить в банк. Оплата в
            USDT через 2328.io, старт сразу после подтверждения инвойса.
          </p>
        </div>
      </section>

      <BoostClient />
    </main>
  );
}
