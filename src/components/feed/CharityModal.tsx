"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, Heart, Home, PawPrint, ShieldCheck, X } from "lucide-react";
import { PARTNER_OF_WEEK } from "@/lib/site";

/* ================================================================
   CharityModal — модалка благотворительной акции «make world
   better»: куда идут деньги. Портал в body (карточка видео с
   трансформами ловит fixed), летающие лапки, шиммер-заголовок,
   бейдж 100%, шаги «как это работает». Без таймера — по решению
   пользователя таймер 72ч убран.
   ================================================================ */

const STEP_ICON = { heart: Heart, coins: Coins, home: Home } as const;

/** Летающие лапки и сердечки на фоне — чистый CSS, без библиотек. */
const FLOATERS = [
  { emoji: "🐾", left: "5%", top: "12%", size: "1.5rem", delay: "0s", dur: "7s" },
  { emoji: "🐾", left: "84%", top: "9%", size: "1.1rem", delay: "1.2s", dur: "8.5s" },
  { emoji: "🧡", left: "88%", top: "58%", size: "1.2rem", delay: "0.6s", dur: "7.8s" },
  { emoji: "🐾", left: "8%", top: "66%", size: "1rem", delay: "2s", dur: "9s" },
  { emoji: "🐾", left: "46%", top: "4%", size: "0.85rem", delay: "3s", dur: "8s" },
  { emoji: "🧡", left: "26%", top: "84%", size: "0.95rem", delay: "1.6s", dur: "7.4s" },
] as const;

export default function CharityModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const drive = PARTNER_OF_WEEK.charityDrive;
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  /* esc + блокировка скролла фона + фокус на крестик */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Charity drive — every paw counts"
    >
      {/* фон: тёмный + блюр */}
      <div className="nr-charity-backdrop absolute inset-0" onClick={onClose} />

      <div className="nr-charity-card relative max-h-[calc(100dvh-2rem)] w-full max-w-[21rem] overflow-y-auto rounded-[2rem] p-6 text-center">
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#3d2314]/8 text-[#6b4a33] transition-all duration-200 hover:rotate-90 hover:bg-[#3d2314]/15"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* летающие лапки */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          {FLOATERS.map((f, i) => (
            <span
              key={i}
              className="nr-charity-float absolute select-none"
              style={{
                left: f.left,
                top: f.top,
                fontSize: f.size,
                animationDelay: f.delay,
                animationDuration: f.dur,
              }}
            >
              {f.emoji}
            </span>
          ))}
        </div>

        {/* контент */}
        <div className="relative">
          <p className="text-[0.58rem] font-black uppercase tracking-[0.22em] text-[#c26d3f]">
            {drive.eyebrow}
          </p>
          <h2 className="nr-charity-shimmer mt-1 text-[1.65rem] font-black leading-tight">
            {drive.title}
          </h2>

          <p className="mx-auto mt-4 max-w-[19rem] text-[0.68rem] font-semibold leading-relaxed text-[#5b3013]">
            {drive.body}
          </p>

          {/* бейдж 100% */}
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#3d2314] px-3.5 py-1.5 text-[0.6rem] font-extrabold text-[#ffd9b3] shadow-md shadow-[#3d2314]/25">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {drive.badge}
          </div>

          {/* как это работает */}
          <div className="mt-4 flex flex-col gap-1.5 text-left">
            {drive.steps.map((s) => {
              const Icon = STEP_ICON[s.icon];
              return (
                <div
                  key={s.text}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/60 px-3 py-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c26d3f]/15 text-[#c26d3f]">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-[0.64rem] font-bold text-[#5b3013]">
                    {s.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            onClick={onClose}
            className="nr-donate-btn mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[0.75rem] font-extrabold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-95"
          >
            <PawPrint className="h-4 w-4" aria-hidden />
            {drive.cta}
          </button>

          <p className="mt-2.5 text-[0.52rem] font-semibold text-[#6b4a33]/55">
            settled on-chain via 2328.io · every cent to the shelters
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
