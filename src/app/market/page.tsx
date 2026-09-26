import type { Metadata } from "next";
import PromptDropCard from "@/components/feed/PromptDropCard";
import PromptCard from "@/components/market/PromptCard";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import Menu from "@/components/menu/Menu";
import { MARKET_ITEMS } from "@/lib/market/catalog";
import { FEATURES } from "@/lib/features";

export const metadata: Metadata = {
  title: "prompt market",
  description:
    "The official prompt market of no reality.: buy the exact prompts behind the characters. Pay with card via Stripe — instant unlock — or crypto via 2328.io. Creators keep 75%.",
  alternates: { canonical: "/market" },
};

/* динамическая витрина: FEATURES.stripeMarket зависит от env РАНТАЙМА —
   статический пререндер запёк бы «card checkout soon» с билд-машины */
export const dynamic = "force-dynamic";

/* ================================================================
   PROMPT MARKET — витрина промптов (/market), task 45.

   Минималистичный стиль платформы продаж промптов:
   • каталог карточек (MARKET_ITEMS) — оплата КАРТОЙ через Stripe
     Checkout (hosted), test/live определяется ключом;
   • featured-дроп loki (PromptDropCard) — прежний crypto-канал
     2328.io, не трогаем;
   • реферальная панель: 20% с оплаченного инвойса в ОБОИХ каналах —
     атрибуция ?ref= → ReferralEvent (kind=paid) в одном реестре.

   Новые дропы = новая запись в MARKET_ITEMS + строка в
   data/prompts.csv (utm_code = productCode). Кода писать не нужно.
   ================================================================ */

const STEPS = [
  { n: "01", t: "pick", d: "every drop is the exact prompt behind a character or scene you've already seen in the wild" },
  { n: "02", t: "pay", d: "card checkout via Stripe — or crypto via 2328.io for the featured drop. no account needed" },
  { n: "03", t: "unlock", d: "the full prompt reveals the second the payment confirms — copy it and go make it real" },
];

export default function MarketPage() {
  const cardPayEnabled = FEATURES.stripeMarket;

  return (
    <main className="nrld-page min-h-dvh">
      {/* ---------- hero (светлый, перламутровый) ---------- */}
      <section className="relative overflow-hidden py-14 text-white sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 80% at 70% 10%, rgba(183,157,255,.16), transparent 60%), radial-gradient(50% 60% at 15% 90%, rgba(255,178,125,.14), transparent 60%), radial-gradient(40% 44% at 40% 40%, rgba(168,207,234,.2), transparent 65%)",
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
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#6d4fc2]">
            prompt market
          </p>
          <h1 className="nr-collab-shimmer mt-3 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            the prompts behind the characters
          </h1>
          <p className="mt-4 max-w-xl text-[0.92rem] font-semibold leading-relaxed text-[#10161d]/60">
            every drop here is the exact prompt behind a scene you&apos;ve seen
            in the wild. pick one, pay with card or crypto, copy the prompt —
            one look is all you need to recreate it.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white/70 p-4 ring-1 ring-[#10161d]/8"
              >
                <p className="font-mono text-[0.7rem] font-extrabold text-[#e4713b]">
                  {s.n}
                </p>
                <p className="mt-1 text-[0.82rem] font-extrabold">{s.t}</p>
                <p className="mt-1 text-[0.68rem] font-semibold leading-snug text-[#10161d]/50">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- каталог: карточные дропы (Stripe) ---------- */}
      <section className="mx-auto max-w-5xl px-5" aria-label="Prompt drops">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[1.6rem] font-extrabold tracking-tight text-[#10161d] sm:text-3xl">
            fresh drops
          </h2>
          <p className="pb-1 text-[0.64rem] font-extrabold uppercase tracking-[0.22em] text-[#10161d]/35">
            card checkout · instant unlock
          </p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET_ITEMS.map((item) => (
            <PromptCard
              key={item.code}
              item={item}
              cardPayEnabled={cardPayEnabled}
            />
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
        <p className="text-[0.72rem] font-semibold text-[#1B1523]/45">
          card payments run in Stripe test mode for these drops · crypto drops
          unlock instantly after confirmation · questions —{" "}
          <a
            href="/feed"
            className="underline decoration-[#1B1523]/25 underline-offset-4 hover:text-[#1B1523]"
          >
            find us in the feed
          </a>
        </p>
      </section>
    </main>
  );
}
