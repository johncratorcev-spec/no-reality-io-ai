"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LangSwitch, useLang } from "@/lib/i18n";
import { HwBat, HwCoin, HwFilters, HwHand, HwMoon, HwPumpkin, HwSkull } from "./hwArt";
import "./halloween-landing.css";

/* ================================================================
   v19 — лендинг «судная ночь»: анимированный онбординг из 6 сцен
   (герой → смотри → назови → ставь → делёж → дверь входа),
   органично ведущий на /auth. Векторы — rough-SVG, скримеры —
   редкие (≤2 за визит, 240мс), всё движение — transform/opacity,
   prefers-reduced-motion полностью гасит (включая скримеры).
   ================================================================ */

const LAST = 5;

export default function HalloweenLanding({
  snapshotLabel,
  hasSeason,
  dayOf,
}: {
  snapshotLabel: string;
  hasSeason: boolean;
  dayOf: number;
}) {
  const { t, lang } = useLang();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [verdict, setVerdict] = useState<"real" | "synth" | null>(null);
  const [stake, setStake] = useState<number | null>(null);
  const [flyChip, setFlyChip] = useState<number | null>(null);
  const [fed, setFed] = useState(false);
  const [shake, setShake] = useState(false);
  const [scream, setScream] = useState(false);
  const [bats, setBats] = useState(0);
  const stepRef = useRef(0);
  const liveRef = useRef(true);

  useEffect(() => {
    return () => {
      liveRef.current = false;
    };
  }, []);

  /* ---- навигация ---- */
  const go = useCallback((n: number, d: 1 | -1 = 1) => {
    const next = Math.max(0, Math.min(LAST, n));
    if (next === stepRef.current) return;
    stepRef.current = next;
    setDir(d);
    setStep(next);
    /* стая мышей — только при движении вперёд */
    if (d === 1 && next > 0) setBats((k) => k + 1);
  }, []);

  /* ---- мыши: перезапуск анимации и размонтуирование ---- */
  useEffect(() => {
    if (!bats) return;
    const id = window.setTimeout(() => liveRef.current && setBats(0), 1900);
    return () => window.clearTimeout(id);
  }, [bats]);

  /* ---- скримеры: максимум 2 за визит, никогда при reduced-motion ---- */
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch {
      return;
    }
    let count = 0;
    let t2: number | undefined;
    const fire = () => {
      if (!liveRef.current) return;
      count += 1;
      setScream(true);
      setShake(true);
      window.setTimeout(() => liveRef.current && setScream(false), 260);
      window.setTimeout(() => liveRef.current && setShake(false), 470);
      if (count < 2) {
        t2 = window.setTimeout(fire, 17000 + Math.random() * 9000);
      }
    };
    const t1 = window.setTimeout(fire, 9000 + Math.random() * 5000);
    return () => {
      window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
  }, []);

  /* ---- клавиатура: стрелки ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(stepRef.current + 1);
      else if (e.key === "ArrowLeft") go(stepRef.current - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  /* ---- ставка: чип летит в тыкву ---- */
  const pickStake = (v: number, i: number) => {
    if (flyChip !== null) return;
    setStake(v);
    setFlyChip(i);
    window.setTimeout(() => {
      if (!liveRef.current) return;
      setFlyChip(null);
      setFed(true);
    }, 640);
  };

  const snapshotLine = hasSeason
    ? t.land.snapshotOn.replace("{d}", snapshotLabel)
    : t.land.snapshotIn;

  return (
    <div className={`hwl${shake ? " hwl-shake" : ""}`}>
      <HwFilters />

      {/* ---------- верхняя планка ---------- */}
      <header className="hwl-top">
        <Link href="/" className="hwl-brand">
          no reality.
          <span aria-hidden className="hw-pumpkin">
            🎃
          </span>
        </Link>
        <span className="hwl-pill">
          <i aria-hidden />
          {t.hwl.pill}
        </span>
        <span className="hwl-spacer" />
        <LangSwitch />
        <Link href="/auth" className="hwl-enter-ghost">
          {t.hwl.heroGhost.replace("already playing? ", "").replace("уже играешь? ", "")}
        </Link>
      </header>

      {/* ---------- сцены ---------- */}
      <main className="hwl-stage">
        {step === 0 && (
          <section key="s0" className="hwl-scene hwl-in-r">
            <span className="hwl-pill hwl-pill-hero">
              <i aria-hidden />
              {t.hwl.pill}
            </span>
            <div className="hwl-hero-art" aria-hidden>
              <HwMoon className="hwl-moon" />
              <HwSkull className="hwl-hero-skull hwl-draw" />
              <HwHand className="hwl-hero-hand" />
            </div>
            <h1 className="hwl-h1">
              {t.hwl.heroT1}
              <span className="hwl-h1-mid">{t.hwl.heroT2}</span>
              <span className="hwl-h1-synth">{t.hwl.heroT3}</span>
              <span style={{ color: "#ff003c" }}>.</span>
            </h1>
            <p className="hwl-d" style={{ marginTop: "1rem" }}>
              {t.hwl.heroSub}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button type="button" className="hw-btn hwl-cta-breathe" onClick={() => go(1)}>
                🎃 {t.hwl.heroCta}
              </button>
              <Link href="/auth" className="hw-ghost">
                {t.hwl.heroGhost}
              </Link>
            </div>
            <p className="hwl-fine">{t.hwl.hint}</p>
          </section>
        )}

        {step === 1 && (
          <section key="s1" className={`hwl-scene ${dir > 0 ? "hwl-in-r" : "hwl-in-l"}`}>
            <div className="hwl-tv hw-box" aria-hidden>
              <div className="hwl-static" />
              <div className="hwl-tv-eyes">
                <i />
                <i />
              </div>
              <span className="hwl-tv-tag">{lang === "ru" ? "нет сигнала" : "no signal"}</span>
            </div>
            <p className="hwl-kicker">{t.hwl.s1k}</p>
            <h2 className="hwl-h2">{t.hwl.s1t}</h2>
            <p className="hwl-d">{t.hwl.s1d}</p>
          </section>
        )}

        {step === 2 && (
          <section key="s2" className={`hwl-scene ${dir > 0 ? "hwl-in-r" : "hwl-in-l"}`}>
            <div style={{ position: "relative", width: "100%" }}>
              {verdict && <span className="hwl-stamp">⚖ {t.hwl.s2stamp}</span>}
              <HwSkull className="mx-auto mb-4 w-24 opacity-90 sm:w-28" eyeColor={verdict ? "#ff2a52" : "#ff7a1a"} />
            </div>
            <p className="hwl-kicker">{t.hwl.s2k}</p>
            <h2 className="hwl-h2">{t.hwl.s2t}</h2>
            <p className="hwl-d">{t.hwl.s2d}</p>
            <div className="hwl-call-row">
              <button
                type="button"
                className={`hw-call real hw-box${verdict === "real" ? " picked" : verdict ? " dimmed" : ""}`}
                onClick={() => setVerdict("real")}
              >
                👁 {t.hwl.s2real}
              </button>
              <button
                type="button"
                className={`hw-call synth hw-box-b${verdict === "synth" ? " picked" : verdict ? " dimmed" : ""}`}
                onClick={() => setVerdict("synth")}
              >
                🤖 {t.hwl.s2synth}
              </button>
            </div>
            {verdict && (
              <p className="hwl-verdict-note">
                {verdict === "real" ? "👁" : "🤖"} {verdict === "real" ? t.hwl.s2real : t.hwl.s2synth} → {t.hwl.next}…
              </p>
            )}
          </section>
        )}

        {step === 3 && (
          <section key="s3" className={`hwl-scene ${dir > 0 ? "hwl-in-r" : "hwl-in-l"}`}>
            <div className={`hwl-bank${fed ? " hwl-fed" : ""}`}>
              <HwPumpkin className={`hwl-bank-pumpkin${flyChip !== null ? " hwl-chew" : ""}`} />
              <span className="hwl-bank-mouth" aria-hidden />
            </div>
            <p className="hwl-kicker">{t.hwl.s3k}</p>
            <h2 className="hwl-h2">{t.hwl.s3t}</h2>
            <p className="hwl-d">{t.hwl.s3d}</p>
            <p className="hwl-fine" style={{ marginTop: "0.9rem" }}>
              {t.hwl.s3pick}
            </p>
            <div className="hwl-chips">
              {[10, 25, 50].map((v, i) => (
                <button
                  key={v}
                  type="button"
                  className={`hwl-chip${stake === v ? " picked" : ""}${flyChip === i ? " flying" : ""}`}
                  style={flyChip === i ? ({ "--fly-x": `${(i - 1) * 2.4}rem` } as React.CSSProperties) : undefined}
                  onClick={() => pickStake(v, i)}
                  aria-label={`${v} EYE`}
                >
                  <HwCoin className="hw-coin" />
                  {v} EYE
                </button>
              ))}
            </div>
            {stake !== null && flyChip === null && (
              <p className="hwl-stake-note">
                ✔ {stake} EYE → 🎃 · {t.hwl.next.toLowerCase()} →
              </p>
            )}
          </section>
        )}

        {step === 4 && (
          <section key="s4" className={`hwl-scene ${dir > 0 ? "hwl-in-r" : "hwl-in-l"}`}>
            <p className="hwl-kicker">{t.hwl.s4k}</p>
            <h2 className="hwl-h2">{t.hwl.s4t}</h2>
            <p className="hwl-d">{t.hwl.s4d}</p>
            <div className="hwl-split">
              <div className="hwl-pot hw-box-b win">
                <span className="hwl-pot-label">🔥 {t.hwl.s4win}</span>
                <span className="hwl-pot-amount">{t.hwl.s4winAmt}</span>
                <span className="hwl-rain" aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <i
                      key={i}
                      style={
                        {
                          left: `${10 + i * 15}%`,
                          "--dx": `${(i % 2 === 0 ? 1 : -1) * (6 + i * 3)}px`,
                          animationDelay: `${i * 0.24}s`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              </div>
              <div className="hwl-pot hw-box lose">
                <span className="hwl-pot-label">💀 {t.hwl.s4lose}</span>
                <span className="hwl-pot-amount">0 EYE</span>
              </div>
            </div>
            <HwHand className="hwl-split-hand hwl-draw" />
          </section>
        )}

        {step === LAST && (
          <section key="s5" className={`hwl-scene ${dir > 0 ? "hwl-in-r" : "hwl-in-l"}`}>
            <div className="hwl-door-wrap" aria-hidden>
              <div className="hwl-door">
                <HwSkull className="hwl-door-skull" />
                <span className="hwl-door-knob" />
              </div>
            </div>
            <h2 className="hwl-h2">{t.hwl.fT}</h2>
            <p className="hwl-d">{t.hwl.fD}</p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <Link href="/auth" className="hw-btn hwl-cta-breathe">
                {t.hwl.fCta}
              </Link>
              <Link href="/feed" className="hw-ghost">
                {t.hwl.fGhost}
              </Link>
            </div>
            <p className="hwl-fine">
              {t.hwl.fFine} · {snapshotLine}
              {dayOf > 0 && dayOf <= 7 ? ` · ${t.land.dayOf.replace("{n}", String(dayOf))}` : ""}
            </p>
          </section>
        )}
      </main>

      {/* ---------- нижняя планка ---------- */}
      <nav className="hwl-bottom" aria-label="onboarding">
        <button
          type="button"
          className={`hwl-back${step > 0 ? " show" : ""}`}
          onClick={() => go(step - 1, -1)}
          aria-label={t.hwl.ariaBack}
        >
          ← {t.hwl.back}
        </button>
        <div className="hwl-dots" role="tablist" aria-label="steps">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={step === i}
              aria-label={`${t.hwl.ariaDot} ${i + 1}`}
              className={`hwl-dot${step === i ? " on" : ""}`}
              onClick={() => go(i, i > step ? 1 : -1)}
            />
          ))}
        </div>
        {step < LAST ? (
          <>
            <Link href="/auth" className="hwl-skip">
              {t.hwl.skip}
            </Link>
            <button type="button" className="hwl-next" onClick={() => go(step + 1)} aria-label={t.hwl.ariaNext}>
              {t.hwl.next} →
            </button>
          </>
        ) : (
          <span className="hwl-skip" style={{ opacity: 0.35 }}>
            🎃
          </span>
        )}
      </nav>

      {/* ---------- стая мышей (переходы сцен) ---------- */}
      {bats > 0 && (
        <div key={bats} className="hwl-bats" aria-hidden>
          <HwBat className="hwl-bat b1" />
          <HwBat className="hwl-bat b2" />
          <HwBat className="hwl-bat b3" />
          <HwBat className="hwl-bat b4" />
        </div>
      )}

      {/* ---------- скример ---------- */}
      {scream && (
        <div className="hwl-scream" aria-hidden>
          <HwSkull eyeColor="#ff003c" />
        </div>
      )}
    </div>
  );
}
