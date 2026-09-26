import { LangSwitch } from "@/lib/i18n";
import Menu from "@/components/menu/Menu";

export default function Header() {
  return (
    <header className="relative z-50 h-[var(--nr-header-h)] shrink-0 bg-[#0B0910]/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center px-5">
        <a
          href="/"
          className="nrld-logo select-none text-[1.3rem] font-extrabold leading-none tracking-tight"
        >
          no reality.
        </a>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* REC: лента живая */}
          <span
            aria-hidden
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#FF003C]"
            style={{ boxShadow: "0 0 8px rgba(255,0,60,.8)" }}
          />

          {/* язык: RU/EN с первого дня */}
          <LangSwitch />

          {/* все разделы + кошелёк — в бургере */}
          <Menu />
        </div>
      </div>
      {/* шов под шапкой: кровь */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-70"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,0,60,.75) 30%, rgba(217,164,65,.4) 60%, transparent 100%)",
        }}
      />
    </header>
  );
}
