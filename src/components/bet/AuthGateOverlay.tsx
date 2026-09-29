"use client";

import { useEffect, useState } from "react";
import { Eye, Lock, Sparkles, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

/* ================================================================
   AuthGateOverlay (v10) — премиум-приглашение к входу.

   Гость видит ВСЁ: ленту, банк, таймер, шансы. Но тап по REAL/SYNTH
   поднимает этот стеклянный слой: что ты получишь (300 монет, daily,
   лидерборд) + одна кнопка на /auth?next=/bet. Сервер всё равно
   держит /api/bet за 401 auth_required — это чисто UX-слой.
   ================================================================ */

interface AuthGateOverlayProps {
  clipCode: string;
  side: "real" | "synth";
  onClose: () => void;
}

export default function AuthGateOverlay({ clipCode, side, onClose }: AuthGateOverlayProps) {
  const { t } = useLang();
  const [closing, setClosing] = useState(false);

  /* esc закрывает */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const leave = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };

  const go = () => {
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/auth?next=${encodeURIComponent(here || "/bet")}`;
  };

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center px-5 ${
        closing ? "nr-ag-out" : "nr-ag-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="sign in to bet"
      onClick={(e) => {
        if (e.target === e.currentTarget) leave();
      }}
      style={{ background: "rgba(6,5,10,0.66)", backdropFilter: "blur(10px)" }}
    >
      <div className="nr-ag-card relative w-full max-w-[21rem] overflow-hidden rounded-3xl p-6">
        {/* верхняя световая дуга в цвет выбранной стороны */}
        <div
          aria-hidden
          className="nr-ag-aura pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full"
          style={{
            background:
              side === "real"
                ? "radial-gradient(closest-side, rgba(200,255,0,0.4), transparent 70%)"
                : "radial-gradient(closest-side, rgba(255,0,60,0.42), transparent 70%)",
          }}
        />

        <button
          onClick={leave}
          aria-label="close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <p
          className="relative text-[0.58rem] font-black uppercase tracking-[0.32em]"
          style={{ color: "rgba(242,237,228,0.5)" }}
        >
          no-reality<span style={{ color: "var(--nb-glitch-b)" }}>.</span>
        </p>

        <h2
          className="relative mt-3 text-[1.45rem] font-black leading-[1.08] tracking-tight"
          style={{ color: "var(--nb-bone)" }}
        >
          {t.bet.gateTitle}
        </h2>
        <p
          className="relative mt-2 text-[0.78rem] font-semibold leading-relaxed"
          style={{ color: "rgba(242,237,228,0.6)" }}
        >
          {t.bet.gateSub}
        </p>

        {/* выгоды входа — компактный список с иконками */}
        <ul className="relative mt-4 space-y-2">
          <li className="nr-ag-row flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "rgba(200,255,0,0.1)",
                border: "1px solid rgba(200,255,0,0.3)",
                color: "var(--nb-poison)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-[0.74rem] font-bold" style={{ color: "rgba(242,237,228,0.82)" }}>
              {t.bet.gateCoins}
            </span>
          </li>
          <li className="nr-ag-row flex items-center gap-2.5" style={{ animationDelay: "60ms" }}>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "rgba(0,240,255,0.08)",
                border: "1px solid rgba(0,240,255,0.28)",
                color: "var(--nb-glitch-b)",
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </span>
            <span className="text-[0.74rem] font-bold" style={{ color: "rgba(242,237,228,0.82)" }}>
              {t.bet.gateDaily}
            </span>
          </li>
          <li className="nr-ag-row flex items-center gap-2.5" style={{ animationDelay: "120ms" }}>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "rgba(123,44,191,0.16)",
                border: "1px solid rgba(123,44,191,0.45)",
                color: "#c9a0ff",
              }}
            >
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="text-[0.74rem] font-bold" style={{ color: "rgba(242,237,228,0.82)" }}>
              {t.bet.gatePass}
            </span>
          </li>
        </ul>

        <button
          onClick={go}
          className="nr-ag-cta relative mt-5 w-full overflow-hidden rounded-xl px-4 py-3.5 text-[0.86rem] font-black tracking-wide"
          style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
        >
          {t.bet.gateCta}
        </button>
        <p
          className="relative mt-2.5 text-center text-[0.6rem] font-bold"
          style={{ color: "rgba(242,237,228,0.4)" }}
        >
          {t.bet.gateNote}
        </p>
      </div>
    </div>
  );
}
