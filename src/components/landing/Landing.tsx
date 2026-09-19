"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import Reveal from "./Reveal";
import Tilt from "./Tilt";
import CountUp from "./CountUp";
import HeroCanvas from "./HeroCanvas";
import Globe from "./Globe";
import Partner from "./Partner";
import Menu from "@/components/menu/Menu";
import { FAQ_ITEMS } from "./faq";
import { SITE, SOCIALS } from "@/lib/site";
import "./landing.css";

/* ================================================================
   no reality. — лендинг-главная.
   Один клиентский компонент-композиция; вся тяжёлая анимация —
   ванильная (WebGL-шейдер, canvas-глобус, CSS keyframes, IO).
   ================================================================ */

const NAV = [
  { href: "#about", label: "about" },
  { href: "#how", label: "how it works" },
  { href: "/market", label: "✦ prompt market" },
  { href: "#creators", label: "creators" },
  { href: "#team", label: "team" },
  { href: "/collab", label: "🐾 cat collab" },
  { href: "#faq", label: "faq" },
];

/** доп. ссылки для футера (в навигации-пилюле места нет — они в бургере) */
const FOOTER_LINKS = [
  ...NAV,
  { href: "/future", label: "◑ in future" },
  { href: "/feed", label: "▸ feed" },
];

/** плавающие бейджи-«спутники» героя: классы бейджей ленты + параллакс */
const CHIPS = [
  { depth: 1.7, rot: "-6deg", dur: "6.5s", delay: "0.3s", pos: "left-[6%] top-[24%] hidden md:block", kind: "swag" },
  { depth: 1.15, rot: "5deg", dur: "8s", delay: "1.1s", pos: "right-[7%] top-[19%] hidden sm:block", kind: "welcome" },
  { depth: 2.1, rot: "4deg", dur: "7.2s", delay: "0.7s", pos: "left-[12%] bottom-[22%] hidden sm:block", kind: "creepy" },
  { depth: 0.85, rot: "-4deg", dur: "9s", delay: "1.6s", pos: "right-[13%] bottom-[26%] hidden md:block", kind: "ufo" },
] as const;

function ChipBadge({ kind }: { kind: "swag" | "welcome" | "creepy" | "ufo" }) {
  const base = "rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold tracking-[0.18em] text-white uppercase";
  if (kind === "swag") return <span className={`nr-swag-badge ${base}`}>swag</span>;
  if (kind === "welcome")
    return (
      <span className={`nr-ufo-badge ${base} inline-flex items-center gap-2`}>
        <i className="nr-ufo" aria-hidden /> welcome to the future
      </span>
    );
  if (kind === "creepy") return <span className={`nr-creepy-badge ${base}`}>creepy</span>;
  return (
    <span className="nr-glass inline-flex h-8 w-14 items-center justify-center rounded-full" aria-hidden>
      <i className="nr-ufo nr-ufo-sm" />
    </span>
  );
}

/* --- маленькие иконки (без библиотек) --------------------------- */
const IconArrow = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
  </svg>
);
const IconLock = ({ className = "h-3 w-3" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const IconPlus = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={className} aria-hidden>
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);
const IconSocial = ({ keyName }: { keyName: string }) => {
  const cls = "h-5 w-5";
  if (keyName === "instagram")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    );
  if (keyName === "threads")
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
        <circle cx="12" cy="12" r="9" /><path d="M15.5 9.5c-.7-1.6-2-2.5-3.5-2.5-2.2 0-4 2.2-4 5s1.8 5 4 5c1.9 0 3.5-1.6 3.5-3.5S13.9 10 12 10c-1 0-2 .5-2 1.4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={cls} aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
  );
};

export default function Landing() {
  const heroRef = useRef<HTMLElement | null>(null);
  const chipRefs = useRef<Array<HTMLDivElement | null>>([]);

  /* параллакс бейджей героя: внешний div — параллакс (JS),
     внутренний span — CSS-float; слои не конфликтуют */
  const onHeroMove = (e: ReactPointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const r = hero.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;

    chipRefs.current.forEach((el) => {
      if (!el) return;
      const depth = Number(el.dataset.depth || "1");
      el.style.transform = `translate3d(${(nx * depth * 30).toFixed(1)}px, ${(ny * depth * 22).toFixed(1)}px, 0)`;
    });
  };
  const onHeroLeave = () => {
    chipRefs.current.forEach((el) => {
      if (el) el.style.transform = "";
    });
  };

  return (
    <div className="bg-white text-[#10161d]">
      {/* ================= NAV ================= */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="nr-glass mx-auto mt-3 flex h-12 max-w-5xl items-center gap-1 rounded-full px-4 sm:px-5">
          <a href="/" className="nr-logo mr-auto text-[1.05rem] font-extrabold leading-none tracking-tight">
            no reality.
          </a>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Sections">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-[0.78rem] font-bold tracking-tight text-[#10161d]/60 transition-colors hover:text-[#0a0a0a]"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href="/feed"
            className="nr-btn-glow ml-2 inline-flex items-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 py-2 text-[0.75rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]"
          >
            watch the feed
            <IconArrow className="h-3 w-3" />
          </a>
          {/* разделы сайта + кошелёк — в бургере (виден и на мобиле) */}
          <div className="ml-1">
            <Menu />
          </div>
        </div>
      </header>

      {/* ================= HERO ================= */}
      <section
        ref={heroRef}
        onPointerMove={onHeroMove}
        onPointerLeave={onHeroLeave}
        className="relative flex min-h-[100svh] items-center justify-center overflow-hidden"
      >
        <HeroCanvas />

        {/* плавающие бейджи-спутники (3D-параллакс) */}
        {CHIPS.map((c, i) => (
          <div
            key={c.kind}
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            data-depth={c.depth}
            aria-hidden
            className={`absolute z-10 transition-transform duration-300 ease-out will-change-transform ${c.pos}`}
          >
            <div
              className="nrld-float"
              style={{ "--nrld-rot": c.rot, "--nrld-dur": c.dur, "--nrld-delay": c.delay } as React.CSSProperties}
            >
              <ChipBadge kind={c.kind} />
            </div>
          </div>
        ))}

        <div className="relative z-20 mx-auto max-w-3xl px-5 pb-16 pt-28 text-center">
          <p className="nrld-hero-in mb-5 inline-flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#10161d]/55" style={{ animationDelay: "0.1s" }}>
            <span className="nrld-live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#3d7db8]" aria-hidden />
            ai video discovery feed
          </p>

          <h1 className="nrld-hero-in text-[3.4rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-[#0a0a0a] sm:text-[5rem]" style={{ animationDelay: "0.2s" }}>
            no reality.
            <span className="sr-only"> — AI video feed and prompt marketplace</span>
          </h1>

          <p className="nrld-hero-in nrld-irid mt-4 text-[1.5rem] font-extrabold tracking-tight sm:text-[2.2rem]" style={{ animationDelay: "0.35s" }}>
            Reality is optional.
          </p>

          <p className="nrld-hero-in mx-auto mt-5 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/70 sm:text-base" style={{ animationDelay: "0.5s" }}>
            A curated feed of AI-generated video, hand-picked from the endless scroll of
            Threads. Watch the clips that shouldn’t exist — then take the exact prompts home.
          </p>

          <div className="nrld-hero-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.65s" }}>
            <a
              href="/feed"
              className="nr-btn-glow group inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-3.5 text-[0.9rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]"
            >
              watch the feed
              <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
            <a
              href="#prompts"
              className="nr-glass inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.9rem] font-extrabold tracking-tight text-[#0a0a0a] transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97]"
            >
              <IconLock className="h-3.5 w-3.5" />
              get the prompts
            </a>
          </div>
        </div>

        {/* hint: скролль вниз */}
        <div aria-hidden className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2">
          <div className="flex h-9 w-6 items-start justify-center rounded-full border border-[#10161d]/25 pt-1.5">
            <span className="nrld-hint-dot block h-2 w-1 rounded-full bg-[#10161d]/60" />
          </div>
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <div className="nrld-marquee overflow-hidden border-y border-[#a8cfea]/40 bg-white/70 py-3.5" aria-hidden>
        <div className="nrld-marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {["swag", "welcome to the future", "creepy", "ufo", "ai video", "prompts", "deep links", "47+ curated clips"].map((w) => (
                <span key={`${copy}-${w}`} className="flex items-center text-[0.72rem] font-extrabold uppercase tracking-[0.32em] text-[#10161d]/45">
                  <span className="px-5">{w}</span>
                  <span className="text-[#5b9bd5]/70">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ================= ABOUT ================= */}
      <section id="about" className="scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">what is no reality.?</p>
            <h2 className="mt-3 max-w-2xl text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
              A discovery feed for <span className="nrld-irid">synthetic cinema</span>.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <Reveal delay={80}>
              <p className="text-[1rem] font-semibold leading-relaxed text-[#10161d]/75">
                no reality. is a curation project for AI-generated video: a living feed of
                clips discovered across Threads, sorted into four recurring moods — SWAG,
                WELCOME TO THE FUTURE, CREEPY and UFO. Every card credits its author and links
                back to the original post, every video carries a shareable deep link, and the
                ranking re-orders itself around real human attention.
              </p>
              <p className="mt-5 text-[1rem] font-semibold leading-relaxed text-[#10161d]/75">
                We are not a generation tool and not another infinite feed. A decentralized
                crew of curators watches the machine output around the clock so you don’t have
                to: only the clips that make you stop scrolling make it in. The result is a
                short, dense, addictive channel of what AI video actually looks like right now.
              </p>
            </Reveal>

            <div className="grid grid-cols-2 gap-3.5 self-start">
              {[
                { v: 47, suffix: "+", label: "curated clips in the feed" },
                { v: 100, suffix: "%", label: "AI-generated, credited to authors" },
                { v: 75, suffix: "%", label: "of every prompt sale goes to creators" },
                { v: 4, suffix: "", label: "moods — one channel per reality" },
              ].map((s, i) => (
                <Reveal key={s.label} delay={120 + i * 90}>
                  <div className="nr-glass-deep h-full rounded-3xl p-5">
                    <p className="text-[2rem] font-extrabold tracking-tight text-[#0a0a0a]">
                      <CountUp value={s.v} suffix={s.suffix} />
                    </p>
                    <p className="mt-1.5 text-[0.78rem] font-bold leading-snug text-[#10161d]/60">{s.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="scroll-mt-24 pb-24 sm:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">how it works</p>
            <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
              Scroll. Spot. <span className="nrld-irid">Steal the prompt.</span>
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01 — watch",
                title: "Scroll the feed",
                text: "Full-screen AI video, one swipe at a time. The ranking engine listens to real attention — views, clicks and shares move the strongest clips up. No account, no paywall, just watch.",
              },
              {
                step: "02 — spot",
                title: "Pick your reality",
                text: "Every clip carries a mood badge: SWAG, WELCOME TO THE FUTURE, CREEPY or UFO. Follow a mood and the feed becomes a channel for exactly the future you signed up for.",
              },
              {
                step: "03 — create",
                title: "Take the prompt",
                text: "Every video hides its recipe. Copy free prompts in one tap, or unlock premium ones straight from their authors — then open your generator and make your own version of reality.",
              },
            ].map((c, i) => (
              <Reveal key={c.step} delay={i * 110}>
                <Tilt className="h-full rounded-3xl">
                  <div className="nr-glass-deep flex h-full flex-col rounded-3xl p-7">
                    <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#5b9bd5]">{c.step}</p>
                    <h3 className="mt-3 text-[1.25rem] font-extrabold tracking-tight text-[#0a0a0a]">{c.title}</h3>
                    <p className="mt-3 text-[0.88rem] font-semibold leading-relaxed text-[#10161d]/70">{c.text}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PROMPTS / MARKETPLACE ================= */}
      <section id="prompts" className="scroll-mt-24 bg-gradient-to-b from-[#eef5fb] to-white py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">the prompt marketplace</p>
            <h2 className="mt-3 max-w-2xl text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
              Every clip hides a prompt. <span className="nrld-irid">Unlock it.</span>
            </h2>
          </Reveal>

          <div className="mt-8 grid items-center gap-12 lg:grid-cols-2">
            <Reveal delay={80}>
              <p className="text-[1rem] font-semibold leading-relaxed text-[#10161d]/75">
                no reality. doubles as a marketplace for video prompts. Free prompts copy
                straight from the card. Premium prompts unlock with a single payment in USDT
                through <a href="https://2328.io" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#3d7db8] underline decoration-[#a8cfea] decoration-2 underline-offset-4 hover:text-[#0a0a0a]">2328.io</a> —
                no subscription, no account: pay once, get the full prompt instantly, keep it forever.
              </p>

              <ul className="mt-7 space-y-3.5">
                {[
                  ["Instant unlock", "the full prompt appears the moment the payment confirms — priced transparently in USDT."],
                  ["Fair split, shown upfront", "creators keep 75% of every sale; the 25% platform commission is never hidden."],
                  ["No subscription, no account", "one payment, one prompt, yours forever. Copy it and go create."],
                  ["Built for micro-payments", "checkout runs on 2328.io crypto payments in USDT."],
                ].map(([b, t]) => (
                  <li key={b} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#5b9bd5] to-[#e39fd0]" />
                    <p className="text-[0.9rem] font-semibold leading-relaxed text-[#10161d]/75">
                      <span className="font-extrabold text-[#0a0a0a]">{b}</span> — {t}
                    </p>
                  </li>
                ))}
              </ul>

              <a
                href="/market"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-5 py-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
              >
                <span className="nrld-live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#e39fd0]" aria-hidden />
                enter the prompt market — loki drop is live
              </a>
            </Reveal>

            {/* интерактивный мок unlock-карточки (светлая тема) */}
            <Reveal delay={160}>
              <Tilt className="rounded-3xl" max={5}>
                <div className="group overflow-hidden rounded-3xl border border-[#a8cfea]/60 bg-white shadow-[0_24px_70px_rgba(61,125,184,0.18)]">
                  <div className="relative flex aspect-[16/10] flex-col items-center justify-center overflow-hidden p-6">
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(120% 120% at 20% 0%, #dcebf7 0%, transparent 50%), radial-gradient(100% 100% at 90% 100%, #e9ddf0 0%, transparent 55%), linear-gradient(160deg, #f4f9fd 0%, #e8f1f9 100%)",
                      }}
                    />
                    {/* «видео»-глушь: тихие блики */}
                    <div aria-hidden className="absolute -left-10 top-8 h-32 w-40 rounded-full bg-[#5b9bd5]/15 blur-2xl" />
                    <div aria-hidden className="absolute bottom-6 right-0 h-28 w-36 rounded-full bg-[#e39fd0]/15 blur-2xl" />

                    <p className="relative max-w-sm text-center text-[0.82rem] font-bold leading-relaxed text-[#10161d]/80 blur-[7px] transition-all duration-700 group-hover:blur-0">
                      cinematic aerial shot of a bioluminescent forest at dusk, volumetric fog,
                      fireflies drifting between giant trees, 35mm, hyper-detailed, slow dolly
                      forward — ar 9:16
                    </p>
                    <span className="nr-glass mt-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-[#0a0a0a]">
                      <IconLock /> hover to preview
                    </span>
                  </div>

                  <div className="flex items-center gap-3 border-t border-[#10161d]/8 bg-white px-5 py-4">
                    <div className="mr-auto">
                      <p className="text-[0.8rem] font-extrabold tracking-tight text-[#0a0a0a]">@promptsmith</p>
                      <p className="text-[0.66rem] font-bold text-[#10161d]/45">premium prompt · instant unlock</p>
                    </div>
                    <span className="rounded-full bg-[#0a0a0a] px-4 py-2 text-[0.72rem] font-extrabold tracking-tight text-white">
                      unlock · 3 USDT
                    </span>
                  </div>
                </div>
              </Tilt>
              <p className="mt-4 text-center text-[0.74rem] font-bold text-[#10161d]/50">
                In the real feed the payment confirms and the prompt is yours forever.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= FOR CREATORS ================= */}
      <section id="creators" className="scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
            <Reveal>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">for creators</p>
              <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
                Make it. List it. <span className="nrld-irid">Keep 75%.</span>
              </h2>
              <p className="mt-6 text-[1rem] font-semibold leading-relaxed text-[#10161d]/75">
                If you generate AI video, no reality. is shelf space for your work. Your clips
                are featured with a deep link back to your Threads post, your prompt can be
                listed at your own price, and your rights stay 100% yours — we are a
                distributor, not a rights holder.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="/creators"
                  className="nr-btn-glow inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04]"
                >
                  creator agreement
                  <IconArrow className="h-3.5 w-3.5" />
                </a>
                <a
                  href="/terms"
                  className="nr-glass inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-[#0a0a0a] transition-transform duration-300 hover:scale-[1.03]"
                >
                  terms of service
                </a>
              </div>
            </Reveal>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {[
                ["Own price, own wallet", "list your prompt at any price in USDT and receive payouts straight to your own crypto wallet."],
                ["75 / 25, no asterisks", "three quarters of every unlock is yours; the platform commission is fixed and shown before you publish."],
                ["Traffic that reaches you", "deep links /v/… send viewers straight to the feed — and every card credits your Threads post."],
                ["Your rights stay yours", "revocable license only for hosting and showcasing. Removal takes five working days, no questions."],
              ].map(([t, d], i) => (
                <Reveal key={t} delay={i * 90}>
                  <Tilt className="h-full rounded-3xl" max={5}>
                    <div className="nr-glass-deep h-full rounded-3xl p-6">
                      <p className="text-[0.92rem] font-extrabold tracking-tight text-[#0a0a0a]">{t}</p>
                      <p className="mt-2 text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/70">{d}</p>
                    </div>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= TEAM (светлая перламутровая секция) ================= */}
      <section id="team" className="scroll-mt-24 px-3 pb-24 sm:px-5 sm:pb-32">
        <div className="overflow-hidden rounded-[2.5rem] border border-[#a8cfea]/50 bg-gradient-to-br from-[#eef5fb] via-[#f5f0fb] to-[#e9f3f9]">
          <div className="grid items-center gap-10 px-7 py-16 sm:px-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#3d7db8]">the crew</p>
              <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
                One crew.
                <br />
                Every time zone.
              </h2>
              <p className="mt-6 text-[0.98rem] font-semibold leading-relaxed text-[#10161d]/70">
                no reality. is not an office — it is a constellation. Our curators, editors
                and engineers are scattered across different corners of the planet: Moscow,
                New York, Tokyo, Berlin, São Paulo, Singapore, Dubai, Sydney.
              </p>
              <p className="mt-4 text-[0.98rem] font-semibold leading-relaxed text-[#10161d]/70">
                The feed is handed off between time zones as the sun moves — when one of us
                goes to sleep, someone else wakes up and keeps watching the machines dream.
                That is why the feed never sleeps either. Drag the planet: our hubs are on it.
              </p>
              <p className="mt-6 text-[0.78rem] font-extrabold uppercase tracking-[0.22em] text-[#3d7db8]/80">
                decentralized by design — distributed across the planet
              </p>
            </Reveal>

            <Reveal delay={140}>
              <Globe className="mx-auto aspect-square w-full max-w-[26rem]" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= PARTNER OF THE WEEK ================= */}
      <Partner />

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-24 pb-24 sm:pb-32">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <p className="text-center text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">faq</p>
            <h2 className="mt-3 text-center text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
              Questions people <span className="nrld-irid">actually ask</span>.
            </h2>
          </Reveal>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="nrld-faq-item nr-glass-deep group rounded-2xl px-6 py-4 open:shadow-[0_10px_40px_rgba(61,125,184,0.18)]">
                  <summary className="flex items-center gap-4">
                    <h3 className="text-[0.95rem] font-extrabold tracking-tight text-[#0a0a0a]">{f.q}</h3>
                    <span className="nrld-faq-icon ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white" aria-hidden>
                      <IconPlus />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-xl text-[0.88rem] font-semibold leading-relaxed text-[#10161d]/70">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOCIALS ================= */}
      <section id="connect" className="scroll-mt-24 bg-gradient-to-b from-white to-[#eef5fb] py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-center text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#5b9bd5]">elsewhere</p>
            <h2 className="mt-3 text-center text-[2rem] font-extrabold leading-tight tracking-tight text-[#0a0a0a] sm:text-[2.6rem]">
              Follow the <span className="nrld-irid">signal</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[0.95rem] font-semibold leading-relaxed text-[#10161d]/70">
              Behind-the-scenes drops, the best clip of the week and prompt giveaways — pick
              your channel.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {SOCIALS.map((s, i) => (
              <Reveal key={s.key} delay={i * 100}>
                <Tilt className="h-full rounded-3xl" max={8}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nr-glass-deep group flex h-full flex-col rounded-3xl p-7 transition-transform duration-300"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a0a0a] text-white">
                      <IconSocial keyName={s.key} />
                    </span>
                    <p className="mt-4 text-[1.05rem] font-extrabold tracking-tight text-[#0a0a0a]">{s.label}</p>
                    <p className="text-[0.8rem] font-bold text-[#3d7db8]">{s.handle}</p>
                    <p className="mt-2.5 flex-1 text-[0.82rem] font-semibold leading-relaxed text-[#10161d]/65">{s.blurb}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[0.75rem] font-extrabold tracking-tight text-[#0a0a0a]/70 transition-colors group-hover:text-[#0a0a0a]">
                      open
                      <IconArrow className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </a>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[#a8cfea]/40 bg-white pb-10 pt-14">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <p className="nr-logo text-[1.2rem] font-extrabold tracking-tight">no reality.</p>
              <p className="mt-2 text-[0.8rem] font-bold text-[#10161d]/55">{SITE.tagline}</p>
              <p className="mt-4 max-w-xs text-[0.72rem] font-semibold leading-relaxed text-[#10161d]/45">
                Independent curation project. Not affiliated with Meta Platforms or Threads.
                All clips belong to their authors.
              </p>
            </div>
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-[#10161d]/45">explore</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                {FOOTER_LINKS.map((n) => (
                  <a key={n.href} href={n.href} className="text-[0.82rem] font-bold text-[#10161d]/70 transition-colors hover:text-[#0a0a0a]">
                    {n.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-[#10161d]/45">elsewhere</p>
              <div className="mt-3 flex flex-col gap-2">
                {SOCIALS.map((s) => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[0.82rem] font-bold text-[#10161d]/70 transition-colors hover:text-[#0a0a0a]">
                    <IconSocial keyName={s.key} />
                    {s.label} <span className="text-[#3d7db8]">{s.handle}</span>
                  </a>
                ))}
                <a href="/feed" className="text-[0.82rem] font-bold text-[#10161d]/70 transition-colors hover:text-[#0a0a0a]">
                  the feed →
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#a8cfea]/30 pt-6 sm:flex-row">
            <p className="text-[0.72rem] font-bold text-[#10161d]/45">© 2026 no reality. All rights reserved.</p>
            <p className="text-[0.72rem] font-bold text-[#10161d]/45">
              made by a decentralized crew across the planet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
