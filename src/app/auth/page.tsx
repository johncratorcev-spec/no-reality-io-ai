import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "./AuthForm";

export const metadata: Metadata = {
  title: "enter — no-reality.",
  description:
    "watch everything free — sign in to predict REAL or SYNTH. promo code members get in instantly, everyone else joins the waiting list.",
  robots: { index: false, follow: false },
};

const TICKER = [
  { verdict: "SYNTHETIC", tone: "bad" },
  { verdict: "REAL FOOTAGE", tone: "good" },
  { verdict: "SYNTHETIC", tone: "bad" },
  { verdict: "REAL FOOTAGE", tone: "good" },
  { verdict: "SYNTHETIC", tone: "bad" },
  { verdict: "REAL FOOTAGE", tone: "good" },
] as const;

/**
 * v10 — ПРЕМИУМ-экран входа/регистрации.
 *
 * Сайт ОТКРЫТ: гости смотрят ленту и предикшены без аккаунта, беттинг —
 * за авторизацией. Этот экран — быстрая дверь: пароль/промо (Supabase,
 * без письма-подтверждения) или Google. Сцена: aurora-фон, вращающееся
 * градиентное кольцо карточки, вердикт-тикер, орбы — всё на CSS.
 */
export default function AuthPage() {
  return (
    <main className="nr-au-scene relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08070b] px-4 py-10 text-white">
      {/* ---------- фон: aurora-блобы + conic-свип + зерно ---------- */}
      <div aria-hidden className="nr-au-aurora pointer-events-none absolute inset-0" />
      <div aria-hidden className="nr-au-conic pointer-events-none absolute inset-0" />
      <div aria-hidden className="nr-au-grain pointer-events-none absolute inset-0" />

      {/* ---------- десктоп: левая бренд-панель ---------- */}
      <aside
        aria-hidden
        className="pointer-events-none relative z-10 mr-16 hidden w-[26rem] shrink-0 select-none lg:block"
      >
        <p className="nr-au-up font-[family-name:var(--font-manrope)] text-xl font-black tracking-tight" style={{ animationDelay: "40ms" }}>
          no-reality<span className="nr-au-cyan">.</span>
        </p>

        <h2
          className="nr-au-up mt-6 text-[3.4rem] font-black leading-[0.98] tracking-tight"
          style={{ animationDelay: "120ms" }}
        >
          trust
          <br />
          your
          <br />
          <span
            style={{
              background: "linear-gradient(92deg, #c8ff00 0%, #f2ede4 45%, #ff003c 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            eye
          </span>
          .
        </h2>

        <p
          className="nr-au-up mt-6 max-w-sm text-[0.86rem] font-semibold leading-relaxed text-white/55"
          style={{ animationDelay: "220ms" }}
        >
          watch the clip. call it REAL or SYNTH. the pari-mutuel bank pays the
          sharp eye in under a minute — winners split the pool.
        </p>

        {/* разделение REAL / SYNTH с живыми краями */}
        <div className="nr-au-up mt-8 max-w-sm" style={{ animationDelay: "300ms" }}>
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            <div
              className="h-1/2-full w-1/2"
              style={{
                background: "linear-gradient(90deg, rgba(200,255,0,0.9), rgba(200,255,0,0.35))",
                boxShadow: "0 0 18px rgba(200,255,0,0.35)",
                width: "50%",
                height: "100%",
              }}
            />
            <div
              style={{
                background: "linear-gradient(90deg, rgba(255,0,60,0.35), rgba(255,0,60,0.9))",
                boxShadow: "0 0 18px rgba(255,0,60,0.35)",
                width: "50%",
                height: "100%",
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[0.6rem] font-black uppercase tracking-[0.24em]">
            <span style={{ color: "rgba(200,255,0,0.75)" }}>real</span>
            <span className="text-white/30">you decide</span>
            <span style={{ color: "rgba(255,92,122,0.8)" }}>synth</span>
          </div>
        </div>

        {/* вердикт-тикер: бегущая строка прошлых вердиктов */}
        <div className="nr-au-up mt-10 max-w-sm overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] py-3" style={{ animationDelay: "380ms" }}>
          <div className="nr-au-ticker flex w-max items-center gap-8 px-4">
            {[...TICKER, ...TICKER, ...TICKER].map((v, i) => (
              <span
                key={i}
                className="flex items-center gap-2 whitespace-nowrap text-[0.62rem] font-black uppercase tracking-[0.2em]"
                style={{ color: v.tone === "good" ? "rgba(200,255,0,0.7)" : "rgba(255,92,122,0.75)" }}
              >
                <span
                  className="inline-block h-1 w-1 rounded-full"
                  style={{ background: v.tone === "good" ? "#c8ff00" : "#ff003c" }}
                />
                it was {v.verdict}
              </span>
            ))}
          </div>
        </div>
      </aside>

      {/* ---------- форма ---------- */}
      <div className="relative z-10 w-full max-w-sm">
        <Suspense
          fallback={
            <div className="animate-pulse text-xs font-bold uppercase tracking-[0.3em] text-white/40">
              loading…
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
