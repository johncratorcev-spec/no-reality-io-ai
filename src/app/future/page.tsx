import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Dice5, Trophy } from "lucide-react";
import Menu from "@/components/menu/Menu";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "in future",
  description:
    "The roadmap of no reality.: what ships next — ending predictions with pari-mutuel USDC voting, creator uploads, mood channels and prediction seasons. Watch the clip. Call the ending. Split the pot.",
  alternates: { canonical: "/future" },
  openGraph: {
    title: "in future — the no reality. roadmap",
    description:
      "Soon: predictions on how a clip ends. Pick your outcome, stake any USDC amount via Phantom, pari-mutuel odds, instant payouts when the real ending plays.",
    url: `${SITE.url}/future`,
    type: "website",
  },
};

/* ================================================================
   IN FUTURE (/future) — дорожная карта проекта.

   Главная фича «next» — предикшены на концовку ролика:
   1) мы даём варианты исходов,
   2) открывается рынок исходов — фикс $1 USDC через Phantom (Solana),
   3) коэффициенты считаются пари-мьютюэль (пул делится на пулы исходов),
   4) когда показывается концовка — победители делят банк пропорционально
      ставкам. Страница описывает механику честно и без обещаний дохода.
   ================================================================ */

const LIVE = [
  {
    tag: "live",
    t: "the feed",
    d: "a curated feed of AI video from Threads, four moods, deep links, attention-based ranking.",
  },
  {
    tag: "live",
    t: "prompt market",
    d: "flash drops of the exact prompts behind the characters — crypto checkout, instant unlock.",
  },
  {
    tag: "live",
    t: "referrals",
    d: "bring a buyer with your invite link — keep 20% of every invoice paid through it.",
  },
  {
    tag: "live",
    t: "wallet sign-in",
    d: "Phantom (Solana) session for predictions and payouts — MetaMask still works for the prompt market.",
  },
] as const;

const PREDICT_STEPS = [
  {
    n: "01",
    t: "watch 5 seconds",
    d: "the clip plays normally — no buttons. after five seconds of your attention the frame cools down and cryo-freezes before the ending.",
  },
  {
    n: "02",
    t: "outcomes on the table",
    d: "two big outcomes — YES and NO — with pari-mutuel odds computed live from the pool.",
  },
  {
    n: "03",
    t: "call it with any USDC stake",
    d: "one tap sends your stake — any amount in USDC — through Phantom straight to the treasury. no swaps, no outcome tokens, no middlemen — Solana only.",
  },
  {
    n: "04",
    t: "pari-mutuel odds",
    d: "odds are the simple honest way: total pool ÷ outcome pool, minus a small platform fee. odds shift live as the pool grows — the crowd prices the ending in real time.",
  },
  {
    n: "05",
    t: "the reveal & payouts",
    d: "the ice melts and the full clip plays out on a PREDICTED card. when the oracle signs the verdict, winners extract their share from the pnl wallet.",
  },
] as const;

const MOCK_OUTCOMES = [
  { t: "the cat wakes up", mult: "×1.8", pool: "62%", hot: true },
  { t: "it was still dreaming", mult: "×3.1", pool: "31%", hot: false },
  { t: "the ufo takes the moon", mult: "×9.4", pool: "7%", hot: false },
] as const;

const LATER = [
  {
    t: "creator uploads",
    d: "submit your own clips and prompts straight from your wallet — self-serve shelf space with the same 75/25 split.",
  },
  {
    t: "mood channels",
    d: "follow a single mood — SWAG, WELCOME TO THE FUTURE, CREEPY or UFO — and the feed becomes your personal channel.",
  },
  {
    t: "prediction seasons",
    d: "weekly prediction leaderboards with badges and bonus pools for the sharpest callers in the feed.",
  },
  {
    t: "on-chain receipts",
    d: "every payout and every prediction settles with a verifiable on-chain receipt tied to your wallet.",
  },
] as const;

export default function FuturePage() {
  return (
    <main className="min-h-dvh bg-white text-[#10161d]">
      {/* ---------- hero (светлый, перламутровый) ---------- */}
      <section className="relative overflow-hidden bg-white pb-14 pt-14 sm:pb-20 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(56% 72% at 72% 8%, rgba(168,207,234,.22), transparent 60%), radial-gradient(48% 60% at 12% 88%, rgba(183,157,255,.14), transparent 60%), radial-gradient(38% 42% at 45% 42%, rgba(255,178,125,.12), transparent 65%)",
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
            in future
          </p>
          <h1 className="nr-collab-shimmer mt-3 max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            the road ahead of the feed
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/60">
            no reality. is a feed today. tomorrow it is a place where you don&apos;t
            just watch AI video — you call the ending before it plays. here is
            what is already running and what we are building next.
          </p>
        </div>
      </section>

      {/* ---------- live now ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-6" aria-label="Shipped">
        <div className="grid gap-3 sm:grid-cols-2">
          {LIVE.map((s) => (
            <div
              key={s.t}
              className="rounded-2xl bg-white p-4 ring-1 ring-[#10161d]/10"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1d8a4e]/10 px-2.5 py-1 text-[0.56rem] font-extrabold uppercase tracking-[0.2em] text-[#1d8a4e]">
                <Check className="h-3 w-3" aria-hidden />
                {s.tag}
              </span>
              <p className="mt-2 text-[0.95rem] font-extrabold tracking-tight text-[#0a0a0a]">
                {s.t}
              </p>
              <p className="mt-1 text-[0.74rem] font-semibold leading-snug text-[#10161d]/55">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- next: ending predictions ---------- */}
      <section className="mx-auto max-w-4xl px-5 py-14 sm:py-20" aria-label="Ending predictions">
        <div className="overflow-hidden rounded-[2.5rem] border border-[#a8cfea]/50 bg-gradient-to-br from-white via-[#f7fafd] to-[#eef5fb] shadow-[0_24px_70px_rgba(61,125,184,0.14)]">
          <div className="px-7 py-12 sm:px-12">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#e4713b]">
              live test · cryo-stop in the feed
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              watch the clip. call the ending.{" "}
              <span className="nrld-irid">split the pot.</span>
            </h2>
            <p className="mt-4 max-w-xl text-[0.9rem] font-semibold leading-relaxed text-[#10161d]/65">
              the first prediction markets are frozen into the feed right now —
              two test clips with live USDC positions, pari-mutuel odds and oracle
              resolution. scroll to a market card, the clip freezes itself.
              full mechanics, no fine print hidden in the footer.
            </p>

            {/* шаги механики */}
            <ol className="mt-8 space-y-3">
              {PREDICT_STEPS.map((s) => (
                <li
                  key={s.n}
                  className="flex gap-4 rounded-2xl bg-white/80 p-4 ring-1 ring-[#10161d]/8"
                >
                  <span className="font-mono text-[0.72rem] font-extrabold text-[#e4713b]">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-[0.88rem] font-extrabold tracking-tight text-[#0a0a0a]">
                      {s.t}
                    </p>
                    <p className="mt-1 text-[0.76rem] font-semibold leading-relaxed text-[#10161d]/60">
                      {s.d}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* мок-полоса исходов */}
            <div className="mt-8 rounded-3xl border border-dashed border-[#3d7db8]/30 bg-white/70 p-5" aria-hidden>
              <p className="flex items-center gap-2 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#3d7db8]/80">
                <Dice5 className="h-3.5 w-3.5" aria-hidden />
                how it looks in the feed — live odds on the cryo cards
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {MOCK_OUTCOMES.map((o) => (
                  <div
                    key={o.t}
                    className={`rounded-2xl p-3.5 ring-1 ${
                      o.hot
                        ? "bg-[#e4713b]/8 ring-[#e4713b]/30"
                        : "bg-white ring-[#10161d]/10"
                    }`}
                  >
                    <p className="font-mono text-[1.15rem] font-extrabold tracking-tight text-[#0a0a0a]">
                      {o.mult}
                    </p>
                    <p className="mt-0.5 text-[0.72rem] font-extrabold leading-snug text-[#10161d]/75">
                      {o.t}
                    </p>
                    <p className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#10161d]/8">
                      <span
                        className={`block h-full rounded-full ${
                          o.hot ? "bg-[#e4713b]" : "bg-[#5b9bd5]"
                        }`}
                        style={{ width: o.pool }}
                      />
                    </p>
                    <p className="mt-1 text-[0.58rem] font-bold text-[#10161d]/45">
                      {o.pool} of the pool
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#10161d]/45">
                <Trophy className="h-3.5 w-3.5 text-[#e4713b]" aria-hidden />
                when the real ending plays, the pot splits proportionally —
                odds you saw are the odds you get at that moment.
              </p>
            </div>

            <p className="mt-5 text-[0.62rem] font-semibold leading-snug text-[#10161d]/40">
              predictions are recreational entertainment, not financial advice
              and not a lottery. stakes are capped per round. mechanics ships
              only where it is allowed — availability may vary by region.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- later ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-6" aria-label="Later">
        <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#6d4fc2]">
          later
        </p>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          and then it gets deeper
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {LATER.map((l) => (
            <div
              key={l.t}
              className="rounded-3xl border border-dashed border-[#6d4fc2]/25 bg-[#f9f7fe] p-6"
            >
              <p className="text-[1rem] font-extrabold tracking-tight text-[#1B1523]/70">
                {l.t}
              </p>
              <p className="mt-2 text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/55">
                {l.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-4xl px-5 pb-20 pt-10 text-center sm:pb-24">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/feed"
            className="nr-btn-glow inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
          >
            meanwhile — watch the feed
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href="/market"
            className="nr-glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-[#0a0a0a] transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            ✦ prompt market
          </Link>
        </div>
        <p className="mt-8 text-[0.62rem] font-bold tracking-tight text-[#10161d]/35">
          no reality. — your only limit is mind
        </p>
      </section>
    </main>
  );
}
