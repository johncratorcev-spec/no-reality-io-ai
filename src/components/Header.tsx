import WalletButton from "@/components/wallet/WalletButton";

export default function Header() {
  return (
    <header className="relative z-50 h-[var(--nr-header-h)] shrink-0 bg-white">
      <div className="mx-auto flex h-full max-w-6xl items-center px-5">
        <a
          href="/"
          className="nr-logo nr-anim-fade-down select-none text-[1.35rem] font-extrabold leading-none tracking-tight"
        >
          no reality.
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* витрина промптов */}
          <a
            href="/market"
            className="nr-anim-fade-down group inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95"
          >
            <span
              className="inline-block transition-transform duration-300 group-hover:rotate-12"
              aria-hidden
            >
              ✦
            </span>
            prompt market
          </a>

          {/* ссылка на страницу коллаборации — всегда под рукой */}
          <a
            href="/collab"
            className="nr-anim-fade-down group inline-flex items-center gap-1.5 rounded-full bg-[#fff3e8] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#c26d3f] transition-all duration-300 hover:scale-105 hover:bg-[#ffe7d2] active:scale-95"
          >
            <span className="inline-block transition-transform duration-300 group-hover:-rotate-12" aria-hidden>
              🐾
            </span>
            collab
          </a>

          {/* MetaMask-сессия (MVP) */}
          <div className="nr-anim-fade-down">
            <WalletButton />
          </div>

          {/* деликатный живой индикатор — чёрный */}
          <span
            aria-hidden
            className="nr-anim-dot h-1.5 w-1.5 rounded-full bg-[#0a0a0a]"
            style={{ boxShadow: "0 0 10px 2px rgba(16,22,29,.35)" }}
          />
        </div>
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
