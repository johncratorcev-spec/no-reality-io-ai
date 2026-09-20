import type { Metadata } from "next";
import Link from "next/link";
import Menu from "@/components/menu/Menu";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "prediction layer — no reality.",
  description:
    "How the prediction layer works: watch 5 seconds, the clip cryo-freezes, call the ending with $1 USDC through Phantom, watch the full clip play out and split the pool pari-mutuel.",
  alternates: { canonical: "/predict" },
  openGraph: {
    title: "prediction layer — the feed freezes, you call the ending",
    description:
      "Watch 5 seconds. The clip freezes solid. Call the ending — ДА or НЕТ — with $1 USDC. The clip melts and plays out. Winners split the pool.",
    url: `${SITE.url}/predict`,
    type: "website",
  },
};

/* ================================================================
   PREDICTION LAYER (/predict) — task 42, пункт 6.

   Анимированная страница-объяснение механики Cryo-Stop:
   мини-карточка зацикленно проживает весь путь (просмотр 5с →
   крио-заморозка → кварцы ДА/НЕТ → USDC → плавление → PREDICTED),
   шаги механики, пари-мьютюэль с живыми пулами, честный дисклеймер.
   Только CSS-анимации — без библиотек, страница лёгкая.
   ================================================================ */

const STEPS = [
  {
    n: "01",
    t: "watch 5 seconds",
    d: "the clip plays normally. no buttons, no popups — you just watch. the prediction layer counts five seconds of your attention.",
  },
  {
    n: "02",
    t: "cryo-freeze",
    d: "the frame cools down and stops. the picture is captured as a frozen still — the ending is sealed inside, and nothing plays until you call it.",
  },
  {
    n: "03",
    t: "call the outcome",
    d: "two quartz prisms — ДА and НЕТ. one tap sends $1 USDC through Phantom straight to the treasury. no swaps, no tokens, no middlemen.",
  },
  {
    n: "04",
    t: "the clip plays out",
    d: "the ice melts, the frozen card becomes a normal video again with a PREDICTED label — and the full clip finally plays to the end.",
  },
  {
    n: "05",
    t: "split the pool",
    d: "when the oracle signs the verdict, winners split the whole pool pari-mutuel, minus 3%. extract your USDC from the pnl wallet.",
  },
] as const;

export default function PredictPage() {
  return (
    <main className="min-h-dvh bg-white text-[#10161d]">
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden bg-white pb-12 pt-14 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(56% 72% at 72% 8%, rgba(125,211,252,.24), transparent 60%), radial-gradient(48% 60% at 12% 88%, rgba(168,207,234,.18), transparent 60%), radial-gradient(38% 42% at 45% 42%, rgba(183,157,255,.12), transparent 65%)",
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
          <h1 className="nr-collab-shimmer mt-3 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            the feed freezes. you call the ending.
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/60">
            every clip in the feed can carry a prediction market. watch five
            seconds, the frame cryo-freezes before the ending — and for $1 USDC
            you call how it plays out. free to run, instant to play, honest
            math on payouts.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="/feed"
              className="rounded-full bg-[#0a0a0a] px-6 py-3 text-[0.8rem] font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
            >
              ▸ try it in the feed
            </a>
            <a
              href="/pnl"
              className="nr-glass-deep rounded-full px-6 py-3 text-[0.8rem] font-extrabold text-[#10161d] transition-transform hover:scale-105 active:scale-95"
            >
              ◇ pnl wallet
            </a>
          </div>
        </div>
      </section>

      {/* ---------- живая анимация цикла ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-4" aria-label="Live loop demo">
        <div className="nr-glass-deep overflow-hidden rounded-3xl">
          <div className="border-b border-[#10161d]/10 px-5 py-3 text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#10161d]/45">
            one cycle in the feed · loops forever
          </div>
          {/* мини-карточка: сцена 16:9 с анимированным циклом */}
          <div className="nr-prd-stage">
            {/* «видео»: градиентный кадр с движением */}
            <div className="nr-prd-clip" aria-hidden>
              <span className="nr-prd-clip-glow" />
              <span className="nr-prd-clip-scan" />
            </div>
            {/* фаза 1: просмотр — тонкий таймер 5с */}
            <div className="nr-prd-watch" aria-hidden>
              <i className="nr-prd-watch-bar" />
              <b>watching · 5s</b>
            </div>
            {/* фаза 2: заморозка — циан-вуаль + трещины */}
            <div className="nr-prd-frost" aria-hidden>
              <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
                {[0, 1, 2, 3, 4].map((i) => (
                  <path
                    key={i}
                    d={`M ${150 + i * 4} 84 L ${190 + i * 22} ${40 + i * 26} L ${258 + i * 12} ${96 + i * 14} M ${186 + i * 16} 66 L ${168 + i * 9} ${120 - i * 8}`}
                    fill="none"
                    stroke="rgba(220,245,255,.85)"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    pathLength={1}
                    style={{ animationDelay: `${4.0 + i * 0.14}s` }}
                    className="nr-prd-crack"
                  />
                ))}
              </svg>
              <span className="nr-prd-frost-label">frozen · $1 to call it</span>
            </div>
            {/* фаза 3: кварцы */}
            <div className="nr-prd-crystals" aria-hidden>
              <span className="nr-prd-crystal nr-prd-crystal-yes">ДА</span>
              <span className="nr-prd-crystal nr-prd-crystal-no">НЕТ</span>
            </div>
            {/* фаза 4: PREDICTED + плавление */}
            <div className="nr-prd-predicted" aria-hidden>
              ✓ PREDICTED · ДА
            </div>
          </div>
          {/* легенда фаз */}
          <div className="grid grid-cols-2 gap-px bg-[#10161d]/10 sm:grid-cols-4">
            {[
              ["0–5s", "watch"],
              ["5s", "cryo-freeze"],
              ["6s", "call · $1 USDC"],
              ["7s+", "plays out"],
            ].map(([t, l]) => (
              <div key={t} className="bg-white px-4 py-3 text-center">
                <p className="font-mono text-[0.66rem] font-extrabold text-[#3d7db8]">{t}</p>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#10161d]/45">
                  {l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- шаги механики ---------- */}
      <section className="mx-auto max-w-4xl px-5 py-12" aria-label="How it works">
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="nr-glass-deep flex gap-4 rounded-2xl px-5 py-5 sm:gap-6 sm:px-7"
            >
              <span className="font-mono text-[0.8rem] font-extrabold text-[#3d7db8]">
                {s.n}
              </span>
              <div>
                <h2 className="text-[1rem] font-extrabold tracking-tight">{s.t}</h2>
                <p className="mt-1.5 max-w-xl text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/60">
                  {s.d}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- пари-мьютюэль: живые пулы ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-12" aria-label="Pari-mutuel math">
        <div className="nr-glass-deep rounded-3xl px-6 py-7 sm:px-9">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.24em] text-[#10161d]/45">
            pari-mutuel, no bookmaker
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
            the pool pays the winners, not the house
          </h2>
          <p className="mt-2 max-w-xl text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/60">
            every $1 lands in the ДА or НЕТ pool. when the verdict is signed,
            the whole pool (minus 3%) is split between winning positions,
            proportionally to their stake. odds move live as people bet.
          </p>
          <div className="mt-5 space-y-3" aria-hidden>
            <div className="nr-prd-pool">
              <span>ДА · 61%</span>
              <i className="nr-prd-pool-yes" />
            </div>
            <div className="nr-prd-pool">
              <span>НЕТ · 39%</span>
              <i className="nr-prd-pool-no" />
            </div>
          </div>
          <p className="mt-5 text-[0.66rem] font-semibold leading-relaxed text-[#10161d]/40">
            predictions are entertainment, not financial advice. one position
            per wallet per market, fixed $1.00 USDC on Solana through Phantom.
          </p>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="rounded-3xl bg-[#0a0a0a] px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            two live test markets are freezing right now
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[0.85rem] font-semibold leading-relaxed text-white/60">
            open the feed, watch five seconds, and the alien or the mimik
            clip will freeze before your eyes. call it.
          </p>
          <a
            href="/feed"
            className="mt-7 inline-block rounded-full bg-white px-7 py-3.5 text-[0.82rem] font-extrabold text-[#0a0a0a] transition-transform hover:scale-105 active:scale-95"
          >
            ▸ enter the feed
          </a>
        </div>
      </section>
    </main>
  );
}
