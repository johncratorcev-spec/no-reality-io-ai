"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, Eye, Coins, Timer, X } from "lucide-react";
import { track } from "@/lib/bet/trackClient";

/**
 * Onboarding предикшен-ленты (v5): короткий overlay при первом заходе
 * на /bet — 4 шага, пропускается одним тапом. Показывается один раз
 * (localStorage nr-onboarded), на deep-link ?noboard=1 не показывается.
 */

const KEY = "nr-onboarded";

const STEPS = [
  {
    icon: Eye,
    t: "смотри клип",
    d: "кадр без подписей и лайков — только сам шов между живым и машинным",
  },
  {
    icon: Coins,
    t: "жми REAL или SYNTH",
    d: "твой вердикт, сумма 10–50 EYE — ставка падает в общий банк",
  },
  {
    icon: Wallet,
    t: "войди — дадим монеты",
    d: "100 EYE за аккаунт, daily-бонус PASS — ставки идут с внутреннего баланса",
  },
  {
    icon: Timer,
    t: "банк делится за минуту",
    d: "куратор вскрывает правду — победившая сторона делит весь пул",
  },
] as const;

export default function OnboardingOverlay() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        if (
          localStorage.getItem(KEY) === "1" ||
          new URLSearchParams(window.location.search).has("noboard")
        ) {
          return;
        }
        setStep(0);
        document.body.style.overflow = "hidden";
      } catch {
        /* приватный режим — не показываем */
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, []);

  const close = useCallback((kind: "done" | "skip") => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    document.body.style.overflow = "";
    setStep(null);
    track(kind === "done" ? "onboarding_done" : "onboarding_skip");
  }, []);

  useEffect(() => {
    document.body.style.overflow = step != null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [step]);

  if (step == null) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-label="how the raffles work"
      className="absolute inset-0 z-[60] flex items-end justify-center bg-[rgba(4,3,8,0.82)] px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
      onClick={() => close("skip")}
    >
      <div
        className="nb-panel w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[0.6rem] font-black uppercase tracking-[0.3em]"
            style={{ color: "rgba(242,237,228,.45)" }}
          >
            how it works · {step + 1}/{STEPS.length}
          </p>
          <button
            onClick={() => close("skip")}
            aria-label="skip onboarding"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          key={step}
          className="mt-5 flex flex-col items-center text-center"
          style={{ animation: "nb-rise-in 320ms cubic-bezier(.2,.8,.2,1) both" }}
        >
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: "rgba(255,0,60,.12)",
              border: "1px solid rgba(255,0,60,.35)",
            }}
          >
            <Icon className="h-7 w-7" style={{ color: "var(--nb-blood)" }} aria-hidden />
          </span>
          <p className="mt-4 text-[1.15rem] font-black tracking-tight" style={{ color: "var(--nb-bone)" }}>
            {s.t}
          </p>
          <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed" style={{ color: "rgba(242,237,228,.6)" }}>
            {s.d}
          </p>
        </div>

        {/* прогресс */}
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 22 : 8,
                background: i <= step ? "var(--nb-poison)" : "rgba(242,237,228,.2)",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => (last ? close("done") : setStep((v) => (v ?? 0) + 1))}
          className="nb-btn mt-5 w-full rounded-full py-3.5 text-[0.85rem] font-black"
          style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
        >
          {last ? "начать угадывать" : "дальше"}
        </button>
        <button
          onClick={() => close("skip")}
          className="mt-2 w-full text-[0.68rem] font-bold"
          style={{ color: "rgba(242,237,228,.4)" }}
        >
          пропустить
        </button>
      </div>
    </div>
  );
}
