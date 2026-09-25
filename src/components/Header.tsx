import Menu from "@/components/menu/Menu";

export default function Header() {
  return (
    <header className="relative z-50 h-[var(--nr-header-h)] shrink-0 bg-[#0A0A0F]">
      <div className="mx-auto flex h-full max-w-6xl items-center px-5">
        <a
          href="/"
          className="nr-logo nr-anim-fade-down select-none text-[1.35rem] font-extrabold leading-none tracking-tight"
        >
          no reality.
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* деликатный живой индикатор — кровь */}
          <span
            aria-hidden
            className="nr-anim-dot h-1.5 w-1.5 rounded-full bg-[#FF003C]"
            style={{ boxShadow: "0 0 10px 2px rgba(255,0,60,.45)" }}
          />

          {/* все разделы + кошелёк — в стилизованном бургере */}
          <div className="nr-anim-fade-down">
            <Menu />
          </div>
        </div>
      </div>
      {/* шов под шапкой: кровь → глитч → кость */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-90"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,0,60,.65) 25%, rgba(123,44,191,.6) 50%, rgba(0,240,255,.45) 75%, transparent 100%)",
        }}
      />
    </header>
  );
}
