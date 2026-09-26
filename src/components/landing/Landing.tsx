"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Reveal from "./Reveal";
import Tilt from "./Tilt";
import CountUp from "./CountUp";
import HeroCanvas from "./HeroCanvas";
import Partner from "./Partner";
import { CrowInHat, JokerCard, JokerFace } from "./Characters";
import Menu from "@/components/menu/Menu";
import { FAQ_ITEMS } from "./faq";
import { SITE, SOCIALS } from "@/lib/site";
import "./landing.css";

/* ================================================================
   no reality. — лендинг-главная. ПОЛНЫЙ РЕДИЗАЙН.
   Кровавый карнавал: ночь, кровь #FF003C, строго белый текст,
   Manrope. 3D-сцены: джокер-монета, флип REAL/SYNTH, веер карт,
   вороны в шляпах. Тяжёлая анимация — ванильная (WebGL, CSS, IO).
   ================================================================ */

const NAV = [
  { href: "#about", label: "about" },
  { href: "#how", label: "how it works" },
  { href: "#bet", label: "the bet" },
  { href: "#jokers", label: "the deck" },
  { href: "#crew", label: "crew" },
  { href: "#faq", label: "faq" },
];

const FOOTER_LINKS = [
  ...NAV,
  { href: "/market", label: "◆ prompt market" },
  { href: "/future", label: "◑ in future" },
  { href: "/feed", label: "▸ feed" },
];

/** плавающие бейджи-«спутники» героя: параллакс + CSS-float */
const CHIPS = [
  { depth: 1.7, rot: "-6deg", dur: "6.5s", delay: "0.3s", pos: "left-[6%] top-[24%] hidden md:block", kind: "real" },
  { depth: 1.15, rot: "5deg", dur: "8s", delay: "1.1s", pos: "right-[7%] top-[19%] hidden sm:block", kind: "synth" },
  { depth: 2.1, rot: "4deg", dur: "7.2s", delay: "0.7s", pos: "left-[11%] bottom-[24%] hidden sm:block", kind: "seam" },
  { depth: 0.85, rot: "-4deg", dur: "9s", delay: "1.6s", pos: "right-[12%] bottom-[27%] hidden md:block", kind: "pool" },
] as const;

function ChipBadge({ kind }: { kind: "real" | "synth" | "seam" | "pool" }) {
  const base = "rounded-full px-3.5 py-1.5 text-[0.62rem] font-extrabold tracking-[0.18em] uppercase";
  if (kind === "real")
    return <span className={`${base} nrld-glass text-white`}>● real</span>;
  if (kind === "synth")
    return <span className={`${base} nrld-btn-blood text-white`}>● synth</span>;
  if (kind === "seam")
    return <span className={`${base} nrld-stamp text-white`}>the seam</span>;
  return (
    <span className={`${base} nrld-glass inline-flex items-center gap-2 text-white`}>
      bank <span className="nrld-blood-text">$128</span>
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

/* --- демо-флип REAL/SYNTH --------------------------------------- */
function FlipDemo() {
  const [flipped, setFlipped] = useState(false);
  const [side, setSide] = useState<"real" | "synth">("real");
  const [stack, setStack] = useState(128);

  /* автопрокрутка флипа — как шарманка; reduced-motion: только по клику */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setFlipped((v) => !v), 3400);
    return () => window.clearInterval(id);
  }, []);

  const call = (s: "real" | "synth") => {
    setSide(s);
    setFlipped(s === "synth");
    setStack((v) => v + 1);
  };

  return (
    <div className="nrld-flip-scene mx-auto w-full max-w-[15.5rem]">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Demo card — now showing ${flipped ? "SYNTH" : "REAL"}. Press to flip.`}
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFlipped((v) => !v)}
        className={`nrld-flip ${flipped ? "is-flipped" : ""} aspect-[9/15] cursor-pointer select-none`}
      >
        {/* ЛИЦО — REAL */}
        <div className="nrld-flip-face nrld-panel absolute inset-0 flex flex-col rounded-[1.6rem] p-5">
          <div className="flex items-center justify-between text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-white/50">
            <span>clip 047</span>
            <span className="inline-flex items-center gap-1.5 text-white">
              <span className="nrld-live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#FF003C]" aria-hidden />
              live
            </span>
          </div>
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0B0910]">
            <CrowInHat hat="top" glasses="round" className="nrld-crow h-32 w-32" />
            <p className="nrld-blood-text mt-3 text-[2.4rem] font-extrabold leading-none tracking-tight">REAL</p>
            <p className="mt-2 text-[0.66rem] font-bold uppercase tracking-[0.24em] text-white/50">this actually happened</p>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/55">
              <span>bank</span>
              <span className="text-white">${stack}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="nrld-timer-bar h-full rounded-full bg-[#FF003C]" />
            </div>
          </div>
        </div>

        {/* РУБАХА — SYNTH */}
        <div className="nrld-flip-face nrld-flip-face is-back nrld-panel-blood absolute inset-0 flex flex-col rounded-[1.6rem] p-5">
          <div className="flex items-center justify-between text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-white/50">
            <span>clip 047</span>
            <span className="text-white">verdict</span>
          </div>
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-[#FF003C]/25 bg-[#120a10]">
            <JokerFace className="h-32 w-32" />
            <p className="nrld-blood-text mt-3 text-[2.4rem] font-extrabold leading-none tracking-tight">SYNTH</p>
            <p className="mt-2 text-[0.66rem] font-bold uppercase tracking-[0.24em] text-white/50">a machine dreamed it</p>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/55">
              <span>bank</span>
              <span className="text-white">${stack}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="nrld-timer-bar h-full rounded-full bg-[#FF003C]" style={{ animationDelay: "-3.4s" }} />
            </div>
          </div>
        </div>
      </div>

      {/* кнопки вызова */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => call("real")}
          className="nrld-btn-ghost rounded-full py-3 text-[0.8rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.03] active:scale-95"
        >
          real
        </button>
        <button
          type="button"
          onClick={() => call("synth")}
          className="nrld-btn-blood rounded-full py-3 text-[0.8rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.03] active:scale-95"
        >
          synth
        </button>
      </div>
      <p className="mt-3 text-center text-[0.68rem] font-bold text-white/45">
        you called <span className="text-white">{side}</span> — the bank pays the winning side
      </p>
    </div>
  );
}

/* ================================================================ */

export default function Landing() {
  const heroRef = useRef<HTMLElement | null>(null);
  const floatRefs = useRef<Array<HTMLDivElement | null>>([]);

  /* параллакс плавающих элементов героя: внешний div — параллакс (JS),
     внутренний — CSS-float; слои не конфликтуют */
  const onHeroMove = (e: ReactPointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const r = hero.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;

    floatRefs.current.forEach((el) => {
      if (!el) return;
      const depth = Number(el.dataset.depth || "1");
      el.style.transform = `translate3d(${(nx * depth * 30).toFixed(1)}px, ${(ny * depth * 22).toFixed(1)}px, 0)`;
    });
  };
  const onHeroLeave = () => {
    floatRefs.current.forEach((el) => {
      if (el) el.style.transform = "";
    });
  };

  return (
    <div className="nrld-page min-h-dvh">
      {/* ================= NAV ================= */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="nrld-glass mx-auto mt-3 flex h-12 max-w-5xl items-center gap-1 rounded-full px-4 sm:px-5">
          <a href="/" className="nrld-logo mr-auto text-[1.05rem] font-extrabold leading-none tracking-tight">
            no reality.
          </a>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Sections">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-[0.78rem] font-bold tracking-tight text-white/60 transition-colors hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a
            href="/feed"
            className="nrld-btn-blood ml-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.75rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]"
          >
            watch the feed
            <IconArrow className="h-3 w-3" />
          </a>
          {/* разделы сайта — в бургере (виден и на мобиле) */}
          <div className="ml-1">
            <Menu variant="dark" />
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

        {/* парящие бейджи (3D-параллакс) */}
        {CHIPS.map((c, i) => (
          <div
            key={c.kind}
            ref={(el) => {
              floatRefs.current[i] = el;
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

        {/* 3D-джокер-монета слева */}
        <div aria-hidden className="nrld-coin-scene absolute left-[4%] top-[30%] z-10 hidden lg:block">
          <div className="nrld-float" style={{ "--nrld-rot": "-8deg", "--nrld-dur": "7.5s", "--nrld-delay": "0.4s" } as React.CSSProperties}>
            <div className="relative h-52 w-36 will-change-transform">
              <div className="nrld-coin absolute inset-0">
                <div className="nrld-coin-face">
                  <div className="nrld-panel-blood h-52 w-36 rounded-2xl p-2">
                    <JokerFace className="h-full w-full" />
                  </div>
                </div>
                <div className="nrld-coin-face is-back">
                  <div className="nrld-panel h-52 w-36 rounded-2xl p-2">
                    <JokerCard label="REAL" accent="#D9A441" className="h-full w-full" />
                  </div>
                </div>
              </div>
            </div>
            <div className="nrld-coin-shadow mx-auto mt-4 h-6 w-28 rounded-full" />
          </div>
        </div>

        {/* ворон-куратор справа */}
        <div aria-hidden className="absolute right-[5%] top-[26%] z-10 hidden lg:block">
          <div className="nrld-float" style={{ "--nrld-rot": "6deg", "--nrld-dur": "8.5s", "--nrld-delay": "1.2s" } as React.CSSProperties}>
            <CrowInHat hat="top" glasses="round" className="nrld-crow h-64 w-56" />
          </div>
        </div>

        <div className="relative z-20 mx-auto max-w-3xl px-5 pb-16 pt-28 text-center">
          <p className="nrld-hero-in mb-5 inline-flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/55" style={{ animationDelay: "0.1s" }}>
            <span className="nrld-live-dot inline-block h-1.5 w-1.5 rounded-full bg-[#FF003C]" aria-hidden />
            synthetic cinema · bet the seam
          </p>

          <h1 className="nrld-hero-in nrld-glitch text-[3.4rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-white sm:text-[5rem]" style={{ animationDelay: "0.2s" }}>
            no reality.
            <span className="sr-only"> — watch what shouldn’t exist. bet the seam.</span>
          </h1>

          <p className="nrld-hero-in mt-4 text-[1.5rem] font-extrabold tracking-tight text-white sm:text-[2.2rem]" style={{ animationDelay: "0.35s" }}>
            Watch what <span className="nrld-blood-text">shouldn’t exist.</span>
          </p>

          <p className="nrld-hero-in mx-auto mt-5 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-white/70 sm:text-base" style={{ animationDelay: "0.5s" }}>
            A vertical feed of synthetic cinema: every clip is either REAL footage or a
            machine dream. Swipe, call it, put $1–5 on the seam — the bank resolves in
            under a minute.
          </p>

          <div className="nrld-hero-in mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.65s" }}>
            <a
              href="/feed"
              className="nrld-btn-blood group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.9rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-[0.97]"
            >
              bet the seam
              <IconArrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
            <a
              href="#how"
              className="nrld-btn-ghost inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.9rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.03] active:scale-[0.97]"
            >
              how it works
            </a>
          </div>
        </div>

        {/* hint: скролль вниз */}
        <div aria-hidden className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2">
          <div className="flex h-9 w-6 items-start justify-center rounded-full border border-white/25 pt-1.5">
            <span className="nrld-hint-dot block h-2 w-1 rounded-full bg-white/60" />
          </div>
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <div className="nrld-marquee overflow-hidden border-y border-white/10 bg-[#0B0910]/80 py-3.5" aria-hidden>
        <div className="nrld-marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {["swag", "welcome to the future", "creepy", "ufo", "real or synth", "bet the seam", "the bank never sleeps", "47+ curated clips"].map((w) => (
                <span key={`${copy}-${w}`} className="flex items-center text-[0.72rem] font-extrabold uppercase tracking-[0.32em] text-white/45">
                  <span className="px-5">{w}</span>
                  <span className="text-[#FF003C]/80">✦</span>
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
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">what is no reality.?</p>
            <h2 className="mt-3 max-w-2xl text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
              A discovery feed for <span className="nrld-blood-text">synthetic cinema</span>.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <Reveal delay={80}>
              <p className="text-[1rem] font-semibold leading-relaxed text-white/75">
                no reality. is a curation project for AI-generated video: a living feed of
                clips discovered across Threads, sorted into four recurring moods — SWAG,
                WELCOME TO THE FUTURE, CREEPY and UFO. Every card credits its author and links
                back to the original post, every video carries a shareable deep link, and the
                ranking re-orders itself around real human attention.
              </p>
              <p className="mt-5 text-[1rem] font-semibold leading-relaxed text-white/75">
                We are not a generation tool and not another infinite feed. A decentralized
                crew of crows watches the machine output around the clock so you don’t have
                to: only the clips that make you stop scrolling make it in. The result is a
                short, dense, addictive channel of what AI video actually looks like right now.
              </p>
            </Reveal>

            <div className="grid grid-cols-2 gap-3.5 self-start">
              {[
                { v: 47, suffix: "+", label: "curated clips in the feed" },
                { v: 100, suffix: "%", label: "credited to their authors" },
                { v: 20, suffix: "%", label: "of the rake goes to the referrer" },
                { v: 4, suffix: "", label: "moods — one channel per reality" },
              ].map((s, i) => (
                <Reveal key={s.label} delay={120 + i * 90}>
                  <div className="nrld-panel h-full rounded-3xl p-5">
                    <p className="text-[2rem] font-extrabold tracking-tight text-white">
                      <CountUp value={s.v} suffix={s.suffix} />
                    </p>
                    <p className="mt-1.5 text-[0.78rem] font-bold leading-snug text-white/55">{s.label}</p>
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
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">how it works</p>
            <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
              Swipe. Call it. <span className="nrld-blood-text">Take the bank.</span>
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "01 — watch",
                title: "Scroll the seam",
                text: "Full-screen clips, one swipe at a time — 15 to 60 seconds each, ~70% synthesized, ~30% terrifyingly real. No account, no paywall, just watch.",
              },
              {
                step: "02 — call it",
                title: "REAL or SYNTH",
                text: "Every clip hides its nature. Trust your eye: real footage or a machine dream. Four moods — SWAG, FUTURE, CREEPY, UFO — mark the channel you’re walking into.",
              },
              {
                step: "03 — bet",
                title: "Put $1–5 on it",
                text: "Back your call with a dollar or five. The pool locks, the verdict drops in under a minute, the winning side splits the bank. Lose — and the clip haunts you for free.",
              },
            ].map((c, i) => (
              <Reveal key={c.step} delay={i * 110}>
                <Tilt className="h-full rounded-3xl">
                  <div className="nrld-panel flex h-full flex-col rounded-3xl p-7">
                    <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#FF003C]">{c.step}</p>
                    <h3 className="mt-3 text-[1.25rem] font-extrabold tracking-tight text-white">{c.title}</h3>
                    <p className="mt-3 text-[0.88rem] font-semibold leading-relaxed text-white/65">{c.text}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= THE BET (демо-флип) ================= */}
      <section id="bet" className="scroll-mt-24 px-3 pb-24 sm:px-5 sm:pb-32">
        <div className="nrld-panel-blood mx-auto max-w-5xl overflow-hidden rounded-[2.5rem]">
          <div className="grid items-center gap-12 px-7 py-16 sm:px-12 lg:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">the bet</p>
              <h2 className="mt-3 max-w-xl text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
                One coin. Two realities. <span className="nrld-blood-text">Pick wrong.</span>
              </h2>
              <p className="mt-6 max-w-lg text-[1rem] font-semibold leading-relaxed text-white/75">
                The bank is alive: every bet feeds the pool, the pool pays the winning side,
                the house keeps a thin rake. A round opens with the clip and closes with the
                verdict — REAL or SYNTH, flipped like a coin in front of everyone.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  ["Anonymous by default", "no account to watch, no account to bet — the seam doesn’t ask who you are."],
                  ["Under a minute", "the round locks, the verdict drops, the pool splits. Dopamine on schedule."],
                  ["Bring an eye — keep 20%", "your referral code earns 20% of the rake from every friend you drag through the seam."],
                ].map(([b, t]) => (
                  <li key={b} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF003C]" />
                    <p className="text-[0.9rem] font-semibold leading-relaxed text-white/70">
                      <span className="font-extrabold text-white">{b}</span> — {t}
                    </p>
                  </li>
                ))}
              </ul>
              <a
                href="/feed"
                className="nrld-btn-blood mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
              >
                open the feed
                <IconArrow className="h-3.5 w-3.5" />
              </a>
            </Reveal>

            <Reveal delay={140}>
              <FlipDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= THE DECK (джокеры) ================= */}
      <section id="jokers" className="scroll-mt-24 pb-24 sm:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-center text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">the deck</p>
            <h2 className="mt-3 text-center text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
              Every mood is a <span className="nrld-blood-text">joker</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[0.95rem] font-semibold leading-relaxed text-white/65">
              Four jokers run the floor. Each one deals a different kind of wrong — pick your
              poison and the feed becomes a channel for exactly that reality.
            </p>
          </Reveal>

          <div className="nrld-fan-scene mt-14 flex items-end justify-center">
            {[
              { label: "SWAG", accent: "#FF003C", rot: "-20deg", ty: "10px", tz: "0px" },
              { label: "FUTURE", accent: "#D9A441", rot: "-7deg", ty: "-6px", tz: "40px" },
              { label: "CREEPY", accent: "#7B2CBF", rot: "7deg", ty: "-6px", tz: "40px" },
              { label: "UFO", accent: "#00F0FF", rot: "20deg", ty: "10px", tz: "0px" },
            ].map((c, i) => (
              <Reveal key={c.label} delay={i * 90} className="-mx-5 sm:-mx-7">
                <div
                  className="nrld-fan-card w-32 sm:w-40"
                  style={{ transform: `rotate(${c.rot}) translateY(${c.ty}) translateZ(${c.tz})` }}
                >
                  <JokerCard label={c.label} accent={c.accent} className="h-auto w-full" />
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-12 text-center text-[0.78rem] font-extrabold uppercase tracking-[0.22em] text-white/45">
              house deck · reshuffled nightly · the joker always watches
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= CREW (вороны-кураторы) ================= */}
      <section id="crew" className="scroll-mt-24 px-3 pb-24 sm:px-5 sm:pb-32">
        <div className="nrld-panel mx-auto max-w-5xl rounded-[2.5rem]">
          <div className="grid items-center gap-10 px-7 py-16 sm:px-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">the crew</p>
              <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
                Crows in hats.
                <br />
                <span className="nrld-blood-text">Eyes like knives.</span>
              </h2>
              <p className="mt-6 text-[0.98rem] font-semibold leading-relaxed text-white/70">
                no reality. is not an office — it is a roost. Our curators are crows in good
                hats and better glasses, scattered across every time zone: Moscow, New York,
                Tokyo, Berlin, São Paulo, Singapore, Dubai, Sydney.
              </p>
              <p className="mt-4 text-[0.98rem] font-semibold leading-relaxed text-white/70">
                The feed is handed off between time zones as the sun moves — when one crow
                sleeps, another wakes and keeps watching the machines dream. Nothing synthetic
                slips past a bird that collects shiny things for a living.
              </p>
              <p className="mt-6 text-[0.78rem] font-extrabold uppercase tracking-[0.22em] text-white/45">
                decentralized by design — the roost never sleeps
              </p>
            </Reveal>

            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
              {[
                { hat: "top" as const, glasses: "round" as const, dur: "6.8s", delay: "0.2s", red: false },
                { hat: "bowler" as const, glasses: "monocle" as const, dur: "8.2s", delay: "0.9s", red: true },
                { hat: "fez" as const, glasses: "shade" as const, dur: "7.6s", delay: "1.5s", red: false },
              ].map((c, i) => (
                <Reveal key={c.hat} delay={120 + i * 110}>
                  <div
                    className="nrld-float relative"
                    style={{ "--nrld-rot": i === 1 ? "0deg" : i === 0 ? "-5deg" : "5deg", "--nrld-dur": c.dur, "--nrld-delay": c.delay } as React.CSSProperties}
                  >
                    <div aria-hidden className="nrld-crow-ring absolute inset-x-[-18%] inset-y-[-10%] rounded-full" />
                    <CrowInHat hat={c.hat} glasses={c.glasses} redEyes={c.red} className="nrld-crow relative h-auto w-full" />
                  </div>
                </Reveal>
              ))}
              <p className="col-span-3 mt-2 text-center text-[0.68rem] font-bold uppercase tracking-[0.2em] text-white/40">
                the curators · three shifts, one roost
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PARTNER OF THE WEEK ================= */}
      <Partner />

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-24 pb-24 sm:pb-32">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <p className="text-center text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">faq</p>
            <h2 className="mt-3 text-center text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
              Questions people <span className="nrld-blood-text">actually ask</span>.
            </h2>
          </Reveal>

          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="nrld-faq-item nrld-panel group rounded-2xl px-6 py-4">
                  <summary className="flex items-center gap-4">
                    <h3 className="text-[0.95rem] font-extrabold tracking-tight text-white">{f.q}</h3>
                    <span className="nrld-faq-icon nrld-btn-blood ml-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" aria-hidden>
                      <IconPlus />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-xl text-[0.88rem] font-semibold leading-relaxed text-white/65">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOCIALS ================= */}
      <section id="connect" className="scroll-mt-24 pb-24 sm:pb-32">
        <div className="mx-auto max-w-5xl px-5">
          <Reveal>
            <p className="text-center text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-white/50">elsewhere</p>
            <h2 className="mt-3 text-center text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
              Follow the <span className="nrld-blood-text">signal</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[0.95rem] font-semibold leading-relaxed text-white/65">
              Behind-the-scenes drops, the best eye of the week and drop alerts — pick your
              channel.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {SOCIALS.map((s, i) => (
              <Reveal key={s.key} delay={i * 100}>
                <Tilt className="h-full rounded-3xl" max={8}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nrld-panel group flex h-full flex-col rounded-3xl p-7 transition-transform duration-300"
                  >
                    <span className="nrld-btn-blood inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                      <IconSocial keyName={s.key} />
                    </span>
                    <p className="mt-4 text-[1.05rem] font-extrabold tracking-tight text-white">{s.label}</p>
                    <p className="text-[0.8rem] font-bold text-[#FF003C]">{s.handle}</p>
                    <p className="mt-2.5 flex-1 text-[0.82rem] font-semibold leading-relaxed text-white/60">{s.blurb}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-[0.75rem] font-extrabold tracking-tight text-white/70 transition-colors group-hover:text-white">
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
      <footer className="border-t border-white/10 bg-[#0B0910] pb-10 pt-14">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <p className="nrld-logo text-[1.2rem] font-extrabold tracking-tight">no reality.</p>
              <p className="mt-2 text-[0.8rem] font-bold text-white/55">{SITE.tagline}</p>
              <p className="mt-4 max-w-xs text-[0.72rem] font-semibold leading-relaxed text-white/40">
                Independent curation project. Not affiliated with Meta Platforms or Threads.
                All clips belong to their authors. Skill game + rake — play with your eyes.
              </p>
            </div>
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-white/45">explore</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                {FOOTER_LINKS.map((n) => (
                  <a key={n.href} href={n.href} className="text-[0.82rem] font-bold text-white/65 transition-colors hover:text-white">
                    {n.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.28em] text-white/45">elsewhere</p>
              <div className="mt-3 flex flex-col gap-2">
                {SOCIALS.map((s) => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[0.82rem] font-bold text-white/65 transition-colors hover:text-white">
                    <IconSocial keyName={s.key} />
                    {s.label} <span className="text-[#FF003C]">{s.handle}</span>
                  </a>
                ))}
                <a href="/feed" className="text-[0.82rem] font-bold text-white/65 transition-colors hover:text-white">
                  the feed →
                </a>
              </div>
            </div>
          </div>

          <div className="nrld-drip mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
            <p className="text-[0.72rem] font-bold text-white/45">© 2026 no reality. All rights reserved.</p>
            <p className="text-[0.72rem] font-bold text-white/45">
              made by a roost of crows across the planet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
