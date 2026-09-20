import type { Metadata } from "next";
import PromptDropCard from "@/components/feed/PromptDropCard";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import Menu from "@/components/menu/Menu";
import { PROMPT_DROP } from "@/lib/site";

export const metadata: Metadata = {
  title: "prompt market",
  description:
    "The official prompt market of no reality.: buy the exact prompts behind the characters. The loki drop — the black cat in the hoodie from the collab — is live: one payment, one 60-second look.",
  alternates: { canonical: "/market" },
};

/* ================================================================
   PROMPT MARKET — витрина промптов (/market).
   Сейчас в витрине один активный дроп (loki-hoodie) + реферальная
   программа. Новые дропы = новый PROMPT_*-конфиг + карточка здесь.
   ================================================================ */

const STEPS = [
  { n: "01", t: "watch", d: "the character comes from a real collab video — follow the link on the card" },
  { n: "02", t: "pay", d: "crypto checkout via 2328.io — USDT, no account needed" },
  { n: "03", t: "unlock", d: "the prompt reveals for 60 seconds — screenshot it before the timer eats it" },
];

const SOON = [
  { tag: "coming soon", t: "the mimic — entity #018", d: "the tape-filed anomaly from the creepy shelf" },
  { tag: "coming soon", t: "robot #6 — carbonara", d: "the kitchen drone that cooks while you sleep" },
];

export default function MarketPage() {
  return (
    <main className="min-h-dvh bg-white">
      {/* ---------- hero (светлый, перламутровый) ---------- */}
      <section className="relative overflow-hidden bg-white py-14 text-[#10161d] sm:py-20">
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
              <Menu />
            </div>
          </div>
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#6d4fc2]">
            prompt market
          </p>
          <h1 className="nr-collab-shimmer mt-3 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            the prompts behind the characters
          </h1>
          <p className="mt-4 max-w-xl text-[0.92rem] font-semibold leading-relaxed text-[#10161d]/60">
            every drop here is the exact prompt behind a character you&apos;ve
            already seen in the wild. flash mechanics: pay, unlock, screenshot —
            one look is all you get.
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

      {/* ---------- активный дроп: loki ---------- */}
      <div className="bg-white">
        <PromptDropCard variant="section" />

        {/* ---------- soon-плейсхолдеры ---------- */}
        <section className="mx-auto max-w-4xl px-5 pb-4" aria-label="Upcoming drops">
          <div className="grid gap-4 sm:grid-cols-2">
            {SOON.map((d) => (
              <div
                key={d.t}
                className="rounded-3xl border border-dashed border-[#1B1523]/15 bg-[#f7f5fb] p-6"
              >
                <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#1B1523]/35">
                  {d.tag}
                </p>
                <p className="mt-2 text-[1.05rem] font-extrabold tracking-tight text-[#1B1523]/55">
                  {d.t}
                </p>
                <p className="mt-1 text-[0.72rem] font-semibold text-[#1B1523]/40">
                  {d.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- реферальная программа ---------- */}
        <ReferralPanel />

        {/* ---------- нижний футер-строка ---------- */}
        <section className="mx-auto max-w-4xl px-5 pb-20 pt-10 text-center">
          <p className="text-[0.72rem] font-semibold text-[#1B1523]/45">
            paid drops unlock instantly after confirmation · questions —{" "}
            <a
              href="/feed"
              className="underline decoration-[#1B1523]/25 underline-offset-4 hover:text-[#1B1523]"
            >
              find us in the feed
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
