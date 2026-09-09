"use client";

import { motion } from "framer-motion";

export default function Header() {
  return (
    <header className="relative z-50 h-[var(--nr-header-h)] shrink-0 bg-white">
      <div className="mx-auto flex h-full max-w-6xl items-center px-5">
        <motion.a
          href="/"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="nr-logo select-none text-[1.35rem] font-extrabold leading-none tracking-tight"
        >
          no reality.
        </motion.a>

        {/* деликатный живой индикатор — чёрный */}
        <motion.span
          aria-hidden
          className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0a0a0a]"
          style={{ boxShadow: "0 0 10px 2px rgba(16,22,29,.35)" }}
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {/* мягкая перламутровая линия под шапкой */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-80"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(91,155,213,.55) 25%, rgba(168,207,234,.65) 55%, rgba(61,125,184,.45) 85%, transparent 100%)",
        }}
      />
    </header>
  );
}
