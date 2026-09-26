"use client";

import { ArrowUpRight } from "lucide-react";
import Reveal from "./Reveal";
import { PARTNER_OF_WEEK } from "@/lib/site";
import { playMeow } from "@/lib/meow";

/* ================================================================
   Partner of the week — кастомный баннер под @pawcrewdaily.
   Кошачья тема: уши на карточке, плавающие лапки, баннер-арт
   с рыжим экипажем. Тёплая кремовая палитра + мягкие ease-анимации.
   Клик на «follow the crew» (переход на их профиль) мяукает.
   ================================================================ */

export default function Partner() {
  return (
    <section id="partner" className="scroll-mt-24 px-3 pb-24 sm:px-5 sm:pb-32">
      <Reveal>
        <div className="nrld-cat-card relative mx-auto max-w-5xl overflow-visible rounded-[2.5rem]">
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

          <div className="grid items-center gap-10 px-7 py-14 sm:px-12 lg:grid-cols-[1.15fr_1fr]">
            {/* текстовая часть */}
            <div>
              <p className="nrld-cat-eyebrow">🐾 partner of the week</p>
              <h2 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-tight text-white sm:text-[2.6rem]">
                {PARTNER_OF_WEEK.name}
                <span className="nrld-cat-accent">.</span>
              </h2>
              <p className="mt-2 text-[0.8rem] font-extrabold uppercase tracking-[0.2em] text-[#FF003C]">
                {PARTNER_OF_WEEK.handle} · {PARTNER_OF_WEEK.kind}
              </p>
              <p className="mt-5 max-w-xl text-[0.95rem] font-semibold leading-relaxed text-white/70">
                {PARTNER_OF_WEEK.blurb}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={PARTNER_OF_WEEK.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playMeow}
                  className="nrld-cat-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.82rem] font-extrabold tracking-tight text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
                >
                  follow the crew
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <span className="text-[0.72rem] font-bold text-white/45">
                  curated by humans, approved by cats
                </span>
              </div>
            </div>

            {/* баннер-арт: рыжий экипаж партнёра, мягко дышит/плавает */}
            <div className="mx-auto w-full max-w-[24rem]">
              <div
                role="img"
                aria-label="The paw crew daily — a pile of fluffy ginger cats on a warm cream background"
                className="nrld-cat-photo"
              >
                <img
                  src="/partner/pawcrew-banner.png"
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
                {/* их пост закреплён первым в ленте */}
                <a
                  href="/feed"
                  onClick={playMeow}
                  className="nrld-cat-pin absolute -left-4 top-5 inline-flex -rotate-6 items-center gap-1.5 rounded-full bg-[#FF003C] px-3.5 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(255,0,60,0.45)] transition-transform duration-300 hover:rotate-0 hover:scale-105"
                >
                  🐾 pinned in the feed
                </a>
              </div>
              <p className="mt-4 text-center text-[0.7rem] font-bold tracking-[0.18em] text-white/40">
                the crew, stacked and judgment-free
              </p>
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
