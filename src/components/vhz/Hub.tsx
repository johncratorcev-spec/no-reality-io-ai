"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Send } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLang } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { HUB_FAQ } from "@/lib/hubFaq";
import { MOODS } from "@/lib/moods";
import { myShareRef, withRef } from "@/lib/shareRef";
import { track } from "@/lib/bet/trackClient";
import { DreamMachine, OracleEye, Reveal, WatcherEyes } from "./Mascots";

/* ================================================================
   no reality. — ХАБ-ЛЕНДИНГ (v3, VHS-zine).
   Позиционирование: интерактивный хаб AI-контента и предсказаний.
   Коллаж-структура: тикер → герой с машиной снов → цикл (watch/call/
   resolve) → настроения → слепой суд → реф-петля → FAQ → CTA.
   Моушн: только transform/opacity, 200–700ms, reduced-motion учтён.
   ================================================================ */

const ROT = ["-1.4deg", "1.1deg", "-0.7deg", "1.6deg"];

function Ticker({ lines }: { lines: readonly string[] }) {
  const row = (
    <span className="vhz-mono flex shrink-0 items-center gap-8 pr-8 text-[0.78rem] font-semibold tracking-[0.18em] whitespace-nowrap text-[var(--vhz-dim)] uppercase">
      {lines.map((l, i) => (
        <span key={i} className="flex items-center gap-8">
          <span aria-hidden className="text-[var(--vhz-yellow)]">
            {MOODS[i % 4].glyph}
          </span>
          {l}
        </span>
      ))}
    </span>
  );
  return (
    <div className="vhz-ticker relative z-10 py-2" aria-hidden>
      <div className="vhz-ticker-track">
        {row}
        {row}
      </div>
    </div>
  );
}

function HeroStat({ n, cap }: { n: string; cap: string }) {
  return (
    <div className="vhz-panel-ghost px-4 py-3">
      <div className="vhz-display text-xl font-extrabold text-[var(--vhz-yellow)]">{n}</div>
      <div className="vhz-mono mt-0.5 text-[0.62rem] tracking-[0.18em] text-[var(--vhz-faint)] uppercase">
        {cap}
      </div>
    </div>
  );
}

export default function Hub() {
  const { lang, t } = useLang();
  const [copied, setCopied] = useState(false);
  const [tc, setTc] = useState("00:00:00");

  /* таймкод героя: живёт, как кассета (rAF-free, 1 Гц) */
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setTc(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const shareHub = useCallback(async () => {
    const url = withRef(SITE.url + "/?utm_source=share&utm_medium=hub");
    track("share_click", "hub");
    try {
      if (navigator.share) {
        await navigator.share({ title: SITE.name, text: t.ref.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* юзер отменил — не беда */
    }
    void myShareRef;
  }, [t]);

  return (
    <div className="vhz-page min-h-dvh">
      <div className="vhz-tracking" aria-hidden />
      <Header />

      <Ticker lines={t.ticker} />

      {/* ================= HERO ================= */}
      <main id="top">
        <section className="relative mx-auto max-w-6xl px-5 pt-10 pb-16 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="vhz-eyebrow vhz-kicker-line">{t.hero.kicker}</p>
              <h1 className="vhz-display vhz-cmyk vhz-glitchy mt-4 text-[2.5rem] leading-[1.02] font-extrabold sm:text-6xl">
                {t.hero.title1}
                <br />
                {t.hero.title2}
                <br />
                <span className="vhz-cmyk-acid">{t.hero.title3}</span>
              </h1>
              <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-[var(--vhz-dim)]">
                {t.hero.sub}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/feed" className="vhz-btn">
                  ▶ {t.hero.cta}
                </Link>
                <a href="#how" className="vhz-btn vhz-btn-ghost">
                  {t.hero.cta2}
                </a>
              </div>
              <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
                <HeroStat n={t.hero.stat1} cap={t.hero.stat1cap} />
                <HeroStat n={t.hero.stat2} cap={t.hero.stat2cap} />
                <HeroStat n={t.hero.stat3} cap={t.hero.stat3cap} />
              </div>
            </div>

            {/* коллаж: машина снов + стикеры REAL/SYNTH + REC/таймкод */}
            <div className="relative mx-auto w-full max-w-[420px]">
              <div className="vhz-tape -top-3 left-[8%]" style={{ ["--vhz-rot" as string]: "-7deg" }} />
              <div className="vhz-tape -top-2 right-[10%]" style={{ ["--vhz-rot" as string]: "5deg" }} />
              <div className="vhz-sticker relative p-5" style={{ ["--vhz-rot" as string]: "1.2deg" }}>
                <div className="vhz-mono flex items-center justify-between pb-3 text-[0.66rem] tracking-[0.2em] text-[var(--vhz-faint)] uppercase">
                  <span className="flex items-center gap-2">
                    <span className="vhz-rec-dot" aria-hidden /> {t.hero.rec}
                  </span>
                  <span className="text-[var(--vhz-green)]">{tc}</span>
                </div>
                <DreamMachine className="mx-auto h-auto w-full max-w-[300px]" accent="#00e5ff" />
                <div className="vhz-mono mt-3 flex items-center justify-between text-[0.68rem] tracking-[0.16em] text-[var(--vhz-faint)]">
                  <span className="text-[var(--vhz-magenta)]">SP ▸ real?</span>
                  <span className="text-[var(--vhz-cyan)]">CH ▸ synth?</span>
                </div>
              </div>
              {/* плавающие стикеры */}
              <div
                className="vhz-sticker vhz-display absolute -top-6 -left-4 px-3 py-1.5 text-sm font-extrabold text-[var(--vhz-yellow)] sm:-left-8"
                style={{ ["--vhz-rot" as string]: "-6deg" }}
              >
                REAL?
              </div>
              <div
                className="vhz-sticker vhz-display absolute -right-3 -bottom-5 px-3 py-1.5 text-sm font-extrabold text-[var(--vhz-cyan)] sm:-right-6"
                style={{ ["--vhz-rot" as string]: "4deg" }}
              >
                SYNTH?
              </div>
              <OracleEye
                className="absolute -top-14 -right-6 hidden h-24 w-24 opacity-90 sm:block"
                accent="#ff2ba6"
                size={96}
              />
            </div>
          </div>
        </section>

        {/* ================= HOW ================= */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <Reveal>
            <p className="vhz-eyebrow vhz-kicker-line">{t.how.kicker}</p>
            <h2 className="vhz-display vhz-cmyk mt-3 text-3xl font-extrabold sm:text-4xl">
              {t.how.title}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: t.how.s1t, body: t.how.s1d, accent: "var(--vhz-cyan)" },
              { n: "02", title: t.how.s2t, body: t.how.s2d, accent: "var(--vhz-yellow)" },
              { n: "03", title: t.how.s3t, body: t.how.s3d, accent: "var(--vhz-magenta)" },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <article className="vhz-sticker h-full p-6" style={{ ["--vhz-rot" as string]: ROT[i] }}>
                  <span className="vhz-stamp" style={{ color: s.accent }}>
                    {s.n}
                  </span>
                  <h3 className="vhz-display mt-4 text-lg font-extrabold">{s.title}</h3>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-[var(--vhz-dim)]">{s.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= MOODS ================= */}
        <section id="moods" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <Reveal>
            <p className="vhz-eyebrow vhz-kicker-line">{t.moods.kicker}</p>
            <h2 className="vhz-display vhz-cmyk mt-3 text-3xl font-extrabold sm:text-4xl">
              {t.moods.title}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MOODS.map((m, i) => (
              <Reveal key={m.key} delay={i * 90}>
                <Link
                  href={`/moods/${m.key}`}
                  className="vhz-sticker block h-full p-5"
                  style={{
                    ["--vhz-rot" as string]: ROT[i % ROT.length],
                    borderColor: i % 2 ? "var(--vhz-paper)" : m.color,
                  }}
                >
                  <div
                    className="vhz-display text-2xl font-extrabold"
                    style={{ color: m.color }}
                  >
                    {m.glyph} {m.ru.label}
                  </div>
                  <div className="vhz-mono mt-1 text-[0.7rem] tracking-[0.22em] text-[var(--vhz-faint)] uppercase">
                    {m.en.label}
                  </div>
                  <p className="mt-3 line-clamp-4 text-[0.86rem] leading-relaxed text-[var(--vhz-dim)]">
                    {lang === "ru" ? m.ru.blurb : m.en.blurb}
                  </p>
                  <span className="vhz-mono mt-4 inline-block text-[0.72rem] font-semibold tracking-[0.14em] text-[var(--vhz-yellow)] uppercase">
                    {t.moods.explore} ▸
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= BLIND COURT ================= */}
        <section id="blind" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <div className="vhz-panel relative overflow-hidden p-8 sm:p-12">
            <div className="vhz-tape -top-3 right-[16%]" style={{ ["--vhz-rot" as string]: "8deg" }} />
            <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <Reveal>
                <WatcherEyes className="mx-auto w-full max-w-[280px]" accent="#ff2ba6" size={280} />
              </Reveal>
              <Reveal delay={120}>
                <p className="vhz-eyebrow vhz-kicker-line">{t.blind.kicker}</p>
                <h2 className="vhz-display vhz-cmyk mt-3 text-3xl font-extrabold sm:text-4xl">
                  {t.blind.title}
                </h2>
                <p className="mt-5 max-w-xl leading-relaxed text-[var(--vhz-dim)]">{t.blind.body}</p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Link href="/feed?blind=1" className="vhz-btn vhz-btn-blood">
                    ⚖ {t.blind.toggle}
                  </Link>
                  <span className="vhz-mono text-[0.7rem] tracking-[0.16em] text-[var(--vhz-faint)] uppercase">
                    {t.blind.on} / {t.blind.off}
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= REF LOOP ================= */}
        <section id="ref" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal>
              <p className="vhz-eyebrow vhz-kicker-line">{t.ref.kicker}</p>
              <h2 className="vhz-display vhz-cmyk mt-3 text-3xl font-extrabold sm:text-4xl">
                {t.ref.title}
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-[var(--vhz-dim)]">{t.ref.body}</p>
              <button type="button" onClick={shareHub} className="vhz-btn mt-7">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "link copied" : t.ref.cta}
              </button>
            </Reveal>
            <Reveal delay={120}>
              <div className="vhz-sticker relative mx-auto max-w-[340px] p-6" style={{ ["--vhz-rot" as string]: "-1.2deg" }}>
                <div className="vhz-mono flex items-center justify-between text-[0.68rem] tracking-[0.2em] text-[var(--vhz-faint)] uppercase">
                  <span>referral tape</span>
                  <span className="text-[var(--vhz-green)]">20%</span>
                </div>
                {/* плёнка с кодами-сердцами: сколько глаз ты привёл */}
                <div className="vhz-mono mt-4 space-y-2.5 text-[0.82rem]">
                  {[
                    { code: "ra1b2c", pct: "20%", state: "live" },
                    { code: "rd4e5f", pct: "20%", state: "live" },
                    { code: "rg7h8i", pct: "20%", state: "wait" },
                  ].map((r) => (
                    <div key={r.code} className="flex items-center justify-between border-b border-dashed border-[var(--vhz-line)] pb-2">
                      <span className="text-[var(--vhz-dim)]">/r/{r.code}</span>
                      <span className="text-[var(--vhz-yellow)]">{r.pct} of rake</span>
                      <span className={r.state === "live" ? "text-[var(--vhz-green)]" : "text-[var(--vhz-faint)]"}>
                        {r.state === "live" ? "● live" : "○ pending"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="vhz-mono mt-4 text-[0.66rem] tracking-[0.12em] text-[var(--vhz-faint)] uppercase">
                  90 days attribution · pari-mutuel pool
                </p>
                <a
                  href="https://t.me/smartluvon_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vhz-mono mt-4 inline-flex items-center gap-2 text-[0.78rem] font-bold text-[var(--vhz-paper)] hover:text-[var(--vhz-yellow)]"
                >
                  <Send className="h-3.5 w-3.5" /> telegram drops
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-16 px-5 py-16">
          <Reveal>
            <p className="vhz-eyebrow vhz-kicker-line">{t.faq.kicker}</p>
            <h2 className="vhz-display vhz-cmyk mt-3 text-3xl font-extrabold sm:text-4xl">
              {t.faq.title}
            </h2>
          </Reveal>
          <div className="mt-9 space-y-4">
            {HUB_FAQ.map((f, i) => {
              const item = lang === "ru" ? { q: f.ru.q, a: f.ru.a } : { q: f.q, a: f.a };
              return (
                <details key={i} className="vhz-faq-item vhz-panel-ghost group p-5" {...(i === 0 ? { open: true } : {})}>
                  <summary className="flex items-start justify-between gap-4">
                    <span className="vhz-display text-[1.02rem] font-bold">{item.q}</span>
                    <span className="vhz-faq-icon vhz-display text-xl leading-none text-[var(--vhz-yellow)]">+</span>
                  </summary>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-[var(--vhz-dim)]">{item.a}</p>
                </details>
              );
            })}
          </div>
        </section>

        {/* ================= FINAL CTA ================= */}
        <section className="mx-auto max-w-6xl px-5 pt-4 pb-20">
          <Reveal>
            <div className="vhz-panel relative overflow-hidden p-10 text-center sm:p-14">
              <div className="vhz-tape -top-3 left-[12%]" style={{ ["--vhz-rot" as string]: "-5deg" }} />
              <OracleEye className="mx-auto h-20 w-20" accent="#ffd400" size={80} />
              <h2 className="vhz-display vhz-cmyk vhz-glitchy mt-5 text-3xl font-extrabold sm:text-5xl">
                {t.hero.title2}
              </h2>
              <p className="vhz-mono mx-auto mt-4 max-w-xl text-[0.82rem] leading-relaxed tracking-[0.08em] text-[var(--vhz-dim)] uppercase">
                {t.footer.tagline}
              </p>
              <Link href="/feed" className="vhz-btn mt-8">
                ▶ {t.common.open}
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
