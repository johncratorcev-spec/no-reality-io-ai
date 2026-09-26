import { LangSwitch } from "@/lib/i18n";
import Menu from "@/components/menu/Menu";

export default function Header() {
  return (
    <header className="relative z-50 h-[var(--nr-header-h)] shrink-0 bg-[#0b0b10]">
      <div className="mx-auto flex h-full max-w-7xl items-center px-5">
        <a
          href="/"
          className="vhz-display vhz-cmyk select-none text-[1.3rem] font-extrabold leading-none tracking-tight"
        >
          no reality.
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* REC: лента живая */}
          <span className="vhz-rec-dot" aria-hidden />

          {/* язык: RU/EN с первого дня */}
          <LangSwitch />

          {/* все разделы + кошелёк — в бургере */}
          <Menu />
        </div>
      </div>
      {/* шов под шапкой: кислотная CMY-плёнка */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-90"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,212,0,.55) 25%, rgba(255,43,166,.55) 50%, rgba(0,229,255,.5) 75%, transparent 100%)",
        }}
      />
    </header>
  );
}
