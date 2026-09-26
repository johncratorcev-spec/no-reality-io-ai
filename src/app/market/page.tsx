import type { Metadata } from "next";
import PromptDropCard from "@/components/feed/PromptDropCard";
import PromptCard from "@/components/market/PromptCard";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import Menu from "@/components/menu/Menu";
import { MARKET_ITEMS } from "@/lib/market/catalog";

export const metadata: Metadata = {
  title: "prompt market",
  description:
    "The official prompt market of no reality.: buy the exact prompts behind the characters. Crypto only via 2328.io — instant unlock. Creators keep 75%.",
  alternates: { canonical: "/market" },
};

/* ================================================================
   PROMPT MARKET — витрина промптов (/market), v5 crypto-only.

   • каталог карточек (MARKET_ITEMS) — оплата ТОЛЬКО крипто через
     2328.io (USDT), hosted checkout, мгновенная разблокировка;
   • Stripe/карты выпилены полностью (ТЗ v5);
   • featured-дроп loki (PromptDropCard) — прежний crypto-канал
     2328.io, работает как раньше;
   • реферальная панель: 20% с оплаченного инвойса — атрибуция
     ?ref= → ReferralEvent (kind=paid) в одном реестре.

   Новые дропы = новая запись в MARKET_ITEMS + строка в
   data/prompts.csv (utm_code = productCode). Кода писать не нужно.
   ================================================================ */

const STEPS = [
  { n: "01", t: "pick", d: "every drop is the exact prompt behind a character or scene you've already seen in the wild" },
  { n: "02", t: "pay crypto", d: "USDT invoice via 2328.io — MetaMask, Trust or any wallet. no account, no card, no middleman" },
  { n: "03", t: "unlock", d: "the full prompt reveals the second the payment confirms — copy it and go make it real" },
];

export default function MarketPage() {
  return (
    <main className="nrld-page min-h-dvh">
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden py-14 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 80% at 70% 10%, rgba(255,0,60,.14), transparent 60%), radial-gradient(50% 60% at 15% 90%, rgba(255,212,0,.08), transparent 60%), radial-gradient(40% 44% at 40% 40%, rgba(0,229,255,.08), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5">
          {/* верхняя строка: лого + меню-бургер (все разделы + кошелёк) */}
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
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#FF5C7A]">
            prompt market · crypto only
          </p>
          <h1 className="nr-collab-shimmer mt-3 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            the prompts behind the characters
          </h1>
          <p className="mt-4 max-w-xl text-[0.92rem] font-semibold leading-relaxed text-white/60">
            every drop here is the exact prompt behind a scene you&apos;ve seen
            in the wild. pick one, pay in USDT, copy the prompt — one look is
            all you need to recreate it.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-[rgba(16,13,22,0.72)] p-4 backdrop-blur-md"
              >
                <p className="font-mono text-[0.7rem] font-extrabold text-[#FF5C7A]">
                  {s.n}
                </p>
                <p className="mt-1 text-[0.82rem] font-extrabold text-white">{s.t}</p>
                <p className="mt-1 text-[0.68rem] font-semibold leading-snug text-white/50">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- каталог: крипто-дропы 2328.io ---------- */}
      <section className="mx-auto max-w-5xl px-5" aria-label="Prompt drops">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[1.6rem] font-extrabold tracking-tight text-white sm:text-3xl">
            fresh drops
          </h2>
          <p className="pb-1 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-white/35">
            usdt · instant unlock
          </p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET_ITEMS.map((item) => (
            <PromptCard key={item.code} item={item} />
          ))}
        </div>
      </section>

      {/* ---------- featured: loki, crypto-канал 2328.io ---------- */}
      <div className="mt-16">
        <PromptDropCard variant="section" />
      </div>

      {/* ---------- реферальная программа ---------- */}
      <div className="mx-auto max-w-4xl px-5">
        <ReferralPanel />
      </div>

      {/* ---------- нижний футер-строка ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-20 pt-10 text-center">
        <p className="text-[0.72rem] font-semibold text-white/40">
          all payments run in USDT via 2328.io — invoices unlock instantly after
          confirmation · questions —{" "}
          <a
            href="/feed"
            className="underline decoration-white/25 underline-offset-4 hover:text-white"
          >
            find us in the feed
          </a>
        </p>
      </section>
    </main>
  );
}
