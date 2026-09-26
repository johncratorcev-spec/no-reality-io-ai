"use client";

import { Send } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="relative z-50 h-11 shrink-0 border-t border-white/10 bg-[#0B0910]/90 backdrop-blur-md">
      {/* шов: кровь */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,0,60,.7) 35%, rgba(217,164,65,.35) 70%, transparent)",
        }}
      />

      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-5">
        <p className="hidden text-[0.66rem] font-bold uppercase tracking-[0.14em] text-white/45 sm:block sm:text-[0.7rem]">
          {t.footer.tagline}
        </p>

        <div className="flex items-center gap-4">
          <a
            href="/bet"
            className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-white/50 transition-colors hover:text-white sm:text-[0.7rem]"
          >
            {lang === "ru" ? "рафлы" : "raffles"}
          </a>
          <a
            href="/real-or-synth"
            className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-white/50 transition-colors hover:text-white sm:text-[0.7rem]"
          >
            {lang === "ru" ? "что это" : "about"}
          </a>
          <a
            href="/terms"
            className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-white/50 transition-colors hover:text-white sm:text-[0.7rem]"
          >
            terms
          </a>
          <a
            href="/creators"
            className="hidden text-[0.64rem] font-bold uppercase tracking-[0.1em] text-white/50 transition-colors hover:text-white sm:block sm:text-[0.7rem]"
          >
            creators
          </a>
          <a
            href="https://t.me/smartluvon_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[0.7rem] font-bold tracking-tight text-white sm:text-[0.75rem]"
          >
            telegram
            <Send
              className="h-3 w-3 text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              style={{ filter: "drop-shadow(0 0 5px rgba(255,0,60,.6))" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
