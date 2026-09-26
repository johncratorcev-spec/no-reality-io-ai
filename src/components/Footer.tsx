"use client";

import { Send } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function Footer() {
  const { lang, t } = useLang();
  return (
    <footer
      className="relative z-50 h-11 shrink-0 border-t border-[#f4f2ec]/10"
      style={{
        background: "rgba(11,11,16,0.82)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
      }}
    >
      {/* шов: CMY-плёнка */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,212,0,.45) 30%, rgba(255,43,166,.45) 60%, rgba(0,229,255,.35) 85%, transparent)",
        }}
      />

      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-5">
        <p className="vhz-mono hidden text-[0.66rem] tracking-[0.14em] text-[#f4f2ec]/55 uppercase sm:block sm:text-[0.72rem]">
          {t.footer.tagline}
        </p>

        <div className="flex items-center gap-4">
          <a
            href="/real-or-synth"
            className="vhz-mono text-[0.64rem] tracking-[0.1em] text-[#f4f2ec]/50 uppercase transition-colors hover:text-[#f4f2ec] sm:text-[0.7rem]"
          >
            {lang === "ru" ? "что это" : "about"}
          </a>
          <a
            href="/terms"
            className="vhz-mono text-[0.64rem] tracking-[0.1em] text-[#f4f2ec]/50 uppercase transition-colors hover:text-[#f4f2ec] sm:text-[0.7rem]"
          >
            terms
          </a>
          <a
            href="/creators"
            className="vhz-mono hidden text-[0.64rem] tracking-[0.1em] text-[#f4f2ec]/50 uppercase transition-colors hover:text-[#f4f2ec] sm:block sm:text-[0.7rem]"
          >
            creators
          </a>
          <a
            href="https://t.me/smartluvon_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[0.7rem] font-bold tracking-tight text-[#f4f2ec] sm:text-[0.75rem]"
          >
            telegram
            <Send
              className="h-3 w-3 text-[#f4f2ec] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              style={{ filter: "drop-shadow(0 0 5px rgba(255,212,0,.55))" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
