"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { PARTNER_OF_WEEK } from "@/lib/site";

/* ================================================================
   Partner of the week — кастомный блок под @pawcrewdaily.
   Кошачья тема: уши на карточке, плавающие лапки, моргающие глаза,
   зрачки следят за курсором (vanilla rAF, без setState на кадр).
   Тёплая кремовая палитра + мягкие ease-анимации.
   ================================================================ */

/* следящие зрачки: pointermove → лёгкий сдвиг к курсору */
function useEyeTracking(cardRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const pupils = card.querySelectorAll<HTMLElement>(".nrld-cat-pupil");
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      tx = Math.max(-1, Math.min(1, dx * 2)) * 5; // ±5px
      ty = Math.max(-1, Math.min(1, dy * 2)) * 4;
    };

    const tick = () => {
      cx += (tx - cx) * 0.08; // мягкое пружинное догоняние
      cy += (ty - cy) * 0.08;
      pupils.forEach((p) => {
        p.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      });
      raf = requestAnimationFrame(tick);
    };

    card.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      card.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [cardRef]);
}

export default function Partner() {
  const cardRef = useRef<HTMLDivElement>(null);
  useEyeTracking(cardRef);

  return (
    <section id="partner" className="scroll-mt-24 px-3 pb-24 sm:px-5 sm:pb-32">
      <Reveal>
        <div
          ref={cardRef}
          className="nrld-cat-card relative mx-auto max-w-5xl overflow-visible rounded-[2.5rem]"
        >
          {/* уши на верхней кромке карточки */}
          <span className="nrld-cat-ear left-[14%]" aria-hidden />
          <span className="nrld-cat-ear right-[14%]" aria-hidden />

          {/* плавающие лапки */}
          {[
            ["left-[3%] top-[16%]", "0.9s", "-8deg", "7.5s"],
            ["right-[4%] top-[24%]", "0.5s", "9deg", "8.5s"],
            ["left-[8%] bottom-[14%]", "1.4s", "6deg", "9.5s"],
            ["right-[9%] bottom-[20%]", "0.2s", "-5deg", "8s"],
            ["right-[30%] top-[6%]", "1.1s", "3deg", "10s"],
          ].map(([pos, delay, rot, dur], i) => (
            <span
              key={i}
              aria-hidden
              className={`nrld-cat-paw nrld-float pointer-events-none absolute hidden sm:block ${pos}`}
              style={
                {
                  "--nrld-delay": delay,
                  "--nrld-rot": rot,
                  "--nrld-dur": dur,
                } as React.CSSProperties
              }
            >
              <PawIcon />
            </span>
          ))}

          <div className="grid items-center gap-10 px-7 py-14 sm:px-12 lg:grid-cols-[1.2fr_1fr]">
            {/* текстовая часть */}
            <div>
              <p className="nrld-cat-eyebrow">🐾 partner of the week</p>
              <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-[#3d2314] sm:text-[2.6rem]">
                {PARTNER_OF_WEEK.name}
                <span className="nrld-cat-accent">.</span>
              </h2>
              <p className="mt-2 text-[0.8rem] font-extrabold uppercase tracking-[0.2em] text-[#c26d3f]">
                {PARTNER_OF_WEEK.handle} · {PARTNER_OF_WEEK.kind}
              </p>
              <p className="mt-5 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-[#6b4a33]">
                {PARTNER_OF_WEEK.blurb}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={PARTNER_OF_WEEK.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nrld-cat-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
                >
                  follow the crew
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <span className="text-[0.72rem] font-bold text-[#6b4a33]/60">
                  curated by humans, approved by cats
                </span>
              </div>
            </div>

            {/* кошачья мордочка: моргает, зрачки следят за курсором */}
            <div className="mx-auto w-full max-w-[19rem]">
              <div className="nrld-cat-face" role="img" aria-label="Friendly cat mascot">
                {/* уши мордочки */}
                <span className="nrld-cat-face-ear left-[6%]" aria-hidden />
                <span className="nrld-cat-face-ear right-[6%]" aria-hidden />
                {/* глаза */}
                <span className="nrld-cat-eye left-[22%]">
                  <span className="nrld-cat-pupil" />
                </span>
                <span className="nrld-cat-eye right-[22%]">
                  <span className="nrld-cat-pupil" />
                </span>
                {/* нос + усы */}
                <span className="nrld-cat-nose" aria-hidden />
                <span className="nrld-cat-whisker left-[8%]" aria-hidden />
                <span className="nrld-cat-whisker left-[10%] top-[62%]" aria-hidden />
                <span className="nrld-cat-whisker right-[8%]" aria-hidden />
                <span className="nrld-cat-whisker right-[10%] top-[62%]" aria-hidden />
                {/* ротик */}
                <span className="nrld-cat-mouth" aria-hidden />
              </div>
              {/* клубок */}
              <div className="nrld-cat-yarn-wrap" aria-hidden>
                <svg viewBox="0 0 40 40" className="nrld-cat-yarn">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="#e8925a" strokeWidth="2.6" />
                  <path
                    d="M6 16 Q 20 10 34 16 M4 24 Q 20 18 36 24 M9 31 Q 20 26 31 31"
                    fill="none"
                    stroke="#e8925a"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path d="M34 30 Q 40 33 38 38" fill="none" stroke="#e8925a" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" aria-hidden>
      <ellipse cx="7" cy="8.2" rx="2.1" ry="2.9" fill="#e8925a" opacity="0.75" />
      <ellipse cx="12" cy="6.4" rx="2.1" ry="3" fill="#e8925a" opacity="0.75" />
      <ellipse cx="17" cy="8.2" rx="2.1" ry="2.9" fill="#e8925a" opacity="0.75" />
      <path
        d="M12 11.2c3.4 0 6.2 2.4 6.2 5.2 0 2.3-1.9 3.8-4 3.4-1.4-.3-2.9-.3-4.4 0-2.1.4-4-1.1-4-3.4 0-2.8 2.8-5.2 6.2-5.2Z"
        fill="#e8925a"
        opacity="0.75"
      />
    </svg>
  );
}
