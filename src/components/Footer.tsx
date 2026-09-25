import { Send } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="nr-anim-fade-in relative z-50 h-11 shrink-0 border-t border-[#F2EDE4]/10"
      style={{
        animationDelay: "0.5s",
        background: "rgba(10,10,15,0.8)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
      }}
    >
      {/* шов: кровь → глитч */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,0,60,.55) 30%, rgba(123,44,191,.5) 60%, rgba(0,240,255,.35) 85%, transparent)",
        }}
      />

      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-5">
        <p className="hidden text-[0.7rem] font-semibold tracking-tight text-[#F2EDE4]/55 sm:block sm:text-[0.78rem]">
          bet the seam
        </p>

        <div className="flex items-center gap-4">
          <a
            href="/terms"
            className="text-[0.68rem] font-semibold tracking-tight text-[#F2EDE4]/50 transition-colors hover:text-[#F2EDE4] sm:text-[0.75rem]"
          >
            terms
          </a>
          <a
            href="/creators"
            className="text-[0.68rem] font-semibold tracking-tight text-[#F2EDE4]/50 transition-colors hover:text-[#F2EDE4] sm:text-[0.75rem]"
          >
            for creators
          </a>
          <a
            href="https://t.me/smartluvon_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[0.7rem] font-bold tracking-tight text-[#F2EDE4] sm:text-[0.78rem]"
          >
            telegram
            <Send
              className="h-3 w-3 text-[#F2EDE4] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              style={{ filter: "drop-shadow(0 0 5px rgba(255,0,60,.5))" }}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
