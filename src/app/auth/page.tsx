import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "./AuthForm";

export const metadata: Metadata = {
  title: "enter — no-reality.",
  description: "closed launch — sign in or redeem your promo code",
  robots: { index: false, follow: false },
};

/**
 * v9 — ОТДЕЛЬНЫЙ экран входа/регистрации закрытого запуска.
 * Неавторизованных сюда перекидывает middleware (src/middleware.ts):
 * гость без nr_auth не видит ни ленту, ни беттинг — только эту дверь.
 *
 * Форма своя (email + пароль на Supabase, без письма-подтверждения):
 *  - email уже с аккаунтом → пароль → вход;
 *  - email новый + промокод → аккаунт создан;
 *  - email новый без промо → лист ожидания.
 */
export default function AuthPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08070b] px-4 py-10 text-white">
      {/* фоновое свечение в палитре сайта */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 42% at 50% 0%, rgba(91,155,213,0.16) 0%, rgba(8,7,11,0) 60%), radial-gradient(48% 34% at 82% 88%, rgba(109,79,194,0.13) 0%, rgba(8,7,11,0) 65%)",
        }}
      />
      <Suspense fallback={<div className="animate-pulse text-xs font-bold uppercase tracking-[0.3em] text-white/40">loading…</div>}>
        <AuthForm />
      </Suspense>
    </main>
  );
}
