import { Send } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="nr-anim-fade-in relative z-50 h-11 shrink-0 border-t border-white/70"
      style={{
        animationDelay: "0.5s",
        background: "rgba(255,255,255,0.66)",
        backdropFilter: "blur(20px) saturate(1.7)",
        WebkitBackdropFilter: "blur(20px) saturate(1.7)",
      }}
    >
      {/* мягкая перламутровая линия */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(91,155,213,.5) 30%, rgba(168,207,234,.6) 60%, rgba(61,125,184,.4) 85%, transparent)",
        }}
      />

      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
        <p className="text-[0.7rem] font-semibold tracking-tight text-[#10161d]/55 sm:text-[0.78rem]">
          your only limit is mind
        </p>

        <a
          href="https://t.me/your_betfriend"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 text-[0.7rem] font-bold tracking-tight text-[#0a0a0a] sm:text-[0.78rem]"
        >
          @your_betfriend
          <Send
            className="h-3 w-3 text-[#0a0a0a] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            style={{ filter: "drop-shadow(0 0 5px rgba(16,22,29,.35))" }}
          />
        </a>
      </div>
    </footer>
  );
}
