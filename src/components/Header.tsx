import Menu from "@/components/menu/Menu";

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
          {/* деликатный живой индикатор */}
          <span
            aria-hidden
            className="nr-anim-dot h-1.5 w-1.5 rounded-full bg-[#0a0a0a]"
            style={{ boxShadow: "0 0 10px 2px rgba(16,22,29,.35)" }}
          />

          {/* все разделы + кошелёк — в стилизованном бургере */}
          <div className="nr-anim-fade-down">
            <Menu />
          </div>
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
