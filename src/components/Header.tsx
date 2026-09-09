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

        {/* деликатный живой индикатор справа */}
        <motion.span
          aria-hidden
          className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d946ef]"
          style={{ boxShadow: "0 0 12px 3px rgba(217,70,239,.65)" }}
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      {/* мягкая радужная линия под шапкой */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-70"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(124,58,239,.5) 25%, rgba(217,70,239,.55) 55%, rgba(245,158,11,.45) 85%, transparent 100%)",
        }}
      />
    </header>
  );
}
