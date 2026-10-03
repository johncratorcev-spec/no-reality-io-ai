"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

/* ================================================================
   AuthForm v16 — премиум-форма входа. ЕДИНСТВЕННАЯ ДВЕРЬ — Google
   (passport-google-oauth20): Telegram-виджет, email+пароль и
   magic-link удалены. Регистрация и вход одним нажатием.

   Ошибки, принесённые с callback'а (?auth=…), известны на первом
   рендере — считаем их синхронно в инициализаторе.
   Все анимации — CSS (nr-au-*): вход-каскад, вращающееся градиентное
   кольцо карточки, свип на кнопке, свечения фокуса.
   ================================================================ */

/* защита от open redirect: только относительные пути этого сайта */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/bet";
}

export default function AuthForm() {
  const params = useSearchParams();
  const next = sanitizeNext(params.get("next"));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(() => {
    const a = params.get("auth") || "";
    if (!a) return "";
    return a === "rate_limited"
      ? "too many attempts — wait a bit"
      : a === "google_state"
        ? "session expired — try again"
        : a === "google_profile"
          ? "google account must have a verified email"
          : a === "google_denied"
            ? "google consent was cancelled — try again"
            : "google sign-in failed — try again";
  });
  const [googleEnabled, setGoogleEnabled] = useState(false);

  /* статус Google (кнопка только с настроенными ключами) */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/auth/google/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = (await r.json()) as { enabled?: boolean };
        if (alive) setGoogleEnabled(Boolean(d.enabled));
        else return;
      } catch {
        /* без google */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="nr-au-ring">
      <div className="nr-au-card-inner rounded-[29px] p-7">
        <p
          className="nr-au-up font-[family-name:var(--font-manrope)] text-lg font-black tracking-tight"
          style={{ animationDelay: "40ms" }}
        >
          no-reality<span className="nr-au-cyan">.</span>
        </p>
        <h1
          className="nr-au-up mt-4 text-[1.7rem] font-black leading-[1.05] tracking-tight"
          style={{ animationDelay: "100ms" }}
        >
          the eye
          <br />
          decides<span className="nr-au-cyan">.</span>
        </h1>
        <p
          className="nr-au-up mt-2.5 text-[0.8rem] font-semibold leading-relaxed text-white/55"
          style={{ animationDelay: "160ms" }}
        >
          watching is free — betting needs an account. one tap with google and
          you get <span className="text-[#a8cfea]">100 EYE</span> to call your
          first verdict. no passwords, no confirmation letters, ever.
        </p>

        {msg && <p className="nr-au-err mt-4 text-[0.72rem] font-bold">{msg}</p>}

        {googleEnabled ? (
          <a
            href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
            onClick={() => setBusy(true)}
            className="nr-au-up nr-au-google mt-6 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold"
            style={{ animationDelay: "220ms" }}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <span aria-hidden className="text-base font-black text-[#4285f4]">G</span>
            )}
            {busy ? "opening google…" : "continue with google"}
          </a>
        ) : (
          <div
            className="nr-au-up mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-center text-[0.66rem] font-bold text-white/45"
            style={{ animationDelay: "220ms" }}
          >
            google sign-in is being connected —
            <br />
            it opens the moment the keys are set.
          </div>
        )}

        {/* сайт открыт — гость может вернуться смотреть */}
        <a
          href={next && next !== "/auth" ? next : "/"}
          className="nr-au-up mt-5 flex items-center justify-center gap-1.5 text-[0.68rem] font-bold text-white/35 transition-colors hover:text-white/70"
          style={{ animationDelay: "300ms" }}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          keep watching without an account
        </a>

        <p
          className="nr-au-up mt-3 text-[0.62rem] font-semibold leading-relaxed text-white/25"
          style={{ animationDelay: "350ms" }}
        >
          by entering you agree to the terms — EYE points only, no money
          inside the game; points are earned by watching, calling it right
          and adding clips. not for sale during season 1.
        </p>
      </div>
    </div>
  );
}
