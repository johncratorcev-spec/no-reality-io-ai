"use client";

import { motion } from "framer-motion";
import { Send } from "lucide-react";

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.5 }}
      className="relative z-50 h-11 shrink-0 border-t border-white/70"
      style={{
        background: "rgba(255,255,255,0.66)",
        backdropFilter: "blur(20px) saturate(1.7)",
        WebkitBackdropFilter: "blur(20px) saturate(1.7)",
      }}
    >
      {/* мягкое свечение верхней кромки */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(124,58,239,.55) 30%, rgba(217,70,239,.6) 60%, rgba(245,158,11,.45) 85%, transparent)",
        }}
      />

      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
        <p className="text-[0.7rem] font-semibold tracking-tight text-[#1b1523]/55 sm:text-[0.78rem]">
          your only limit is mind
        </p>

        <a
          href="https://t.me/your_betfriend"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 text-[0.7rem] font-bold tracking-tight sm:text-[0.78rem]"
        >
          <span className="bg-clip-text text-transparent [background-image:var(--nr-grad)]">
            @your_betfriend
          </span>
          <Send
            className="h-3 w-3 text-[#d946ef] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            style={{ filter: "drop-shadow(0 0 6px rgba(217,70,239,.6))" }}
          />
        </a>
      </div>
    </motion.footer>
  );
}
