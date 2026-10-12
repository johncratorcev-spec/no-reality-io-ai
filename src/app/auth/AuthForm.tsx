"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

/* ================================================================
   AuthForm v20 — Supabase Auth (ТЗ §2): magic-код на email + Google
   (PKCE через Supabase). Старый passport-Google удалён полностью.

   ГРЕЙСФОЛЛБЭК: /api/auth/status рисует кнопки только под настроенные
   двери; Supabase упал/не настроен → честное «вход подключается»,
   НИКОГДА не 500. Сайт остаётся смотрибельным гостем.

   Turnstile (если включён NEXT_PUBLIC_TURNSTILE_SITE_KEY) — невидимый
   виджет, токен уходит в /otp/send.
   ================================================================ */

/* защита от open redirect: только относительные пути этого сайта */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/bet";
}

interface AuthStatus {
  supabase: boolean;
  otp: boolean;
  google: boolean;
  turnstile: boolean;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const ERR_TEXT: Record<string, string> = {
  rate_limited: "too many attempts — wait a bit",
  auth_state: "session expired — try again",
  auth_denied: "consent was cancelled — try again",
  auth_failed: "sign-in failed — try again",
  auth_unavailable: "sign-in is temporarily unavailable — we are on it",
  auth_profile: "account must have a verified email",
  bad_email: "that email doesn't look right",
  bad_code: "wrong or expired code — check the letter",
  otp_rate_limited: "email limit reached — try again in an hour",
  captcha_failed: "captcha not passed — try again",
  email_mismatch: "the code was sent to a different email",
};

export default function AuthForm() {
  const params = useSearchParams();
  const next = sanitizeNext(params.get("next"));

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [msg, setMsg] = useState(() => {
    const a = params.get("auth") || "";
    return a ? ERR_TEXT[a] || "sign-in failed — try again" : "";
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const tsContainer = useRef<HTMLDivElement>(null);
  const tsWidgetId = useRef<string | null>(null);

  /* статус дверей входа */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/auth/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = (await r.json()) as AuthStatus;
        if (alive) setStatus(d);
      } catch {
        /* статус недоступен — форма покажет «подключается» */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Turnstile-виджет (только если включён) */
  useEffect(() => {
    if (!status?.turnstile) return;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
    if (!siteKey) return;
    const ensure = () => {
      if (!tsContainer.current || tsWidgetId.current) return;
      try {
        tsWidgetId.current =
          window.turnstile?.render(tsContainer.current, {
            sitekey: siteKey,
            theme: "dark",
            size: "compact",
          }) ?? null;
      } catch {
        /* виджет не загрузился — сервер вернёт captcha_failed, повтор */
      }
    };
    if (window.turnstile) {
      ensure();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = ensure;
    document.head.appendChild(s);
  }, [status?.turnstile]);

  const turnstileToken = (): string | null => {
    const el = tsContainer.current?.querySelector<HTMLInputElement>("input[name^=\"cf-turnstile\"]");
    return el?.value ?? null;
  };

  const sendCode = useCallback(async () => {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: turnstileToken() }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setMsg(ERR_TEXT[d.error || ""] || "couldn't send the code — try again");
        window.turnstile?.reset(tsWidgetId.current || undefined);
        return;
      }
      setStage("code");
      setTimeout(() => codeRef.current?.focus(), 60);
    } catch {
      setMsg("network hiccup — try again");
    } finally {
      setBusy(false);
    }
  }, [email]);

  const verify = useCallback(async () => {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setMsg(ERR_TEXT[d.error || ""] || "wrong or expired code");
        return;
      }
      window.location.href = next;
    } catch {
      setMsg("network hiccup — try again");
    } finally {
      setBusy(false);
    }
  }, [email, code, next]);

  const doorsOpen = Boolean(status?.otp || status?.google);

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
          watching is free — betting needs an account. one code or one tap with
          google and you get <span className="text-[#a8cfea]">100 EYE</span> to
          call your first verdict. no passwords, ever.
        </p>

        {msg && <p className="nr-au-err mt-4 text-[0.72rem] font-bold">{msg}</p>}

        {status === null ? (
          <div className="nr-au-up mt-6 flex items-center justify-center gap-2 text-[0.7rem] font-bold text-white/35" style={{ animationDelay: "220ms" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            opening the doors…
          </div>
        ) : !doorsOpen ? (
          <div
            className="nr-au-up mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-center text-[0.66rem] font-bold text-white/45"
            style={{ animationDelay: "220ms" }}
          >
            sign-in is being connected —
            <br />
            it opens the moment the keys are set.
            <br />
            <span className="text-white/25">the feed stays free to watch.</span>
          </div>
        ) : (
          <div className="nr-au-up mt-6" style={{ animationDelay: "220ms" }}>
            {stage === "email" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && email) void sendCode();
                }}
              >
                <label htmlFor="nr-email" className="mb-1.5 block text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/40">
                  email — one code, no password
                </label>
                <input
                  id="nr-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@somewhere.tld"
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3.5 text-[0.9rem] font-bold text-white placeholder:text-white/25 focus:border-[#a8cfea]/60 focus:outline-none"
                />
                <div ref={tsContainer} className="mt-3 flex justify-center" />
                <button
                  type="submit"
                  disabled={busy || !email}
                  aria-busy={busy}
                  className="nr-au-google mt-3 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MailCheck className="h-4 w-4" aria-hidden />}
                  {busy ? "sending…" : "send me a code"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && code.length === 6) void verify();
                }}
              >
                <p className="mb-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/40">
                  code sent to <span className="text-white/70">{email}</span>
                </p>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3.5 text-center text-[1.3rem] font-black tracking-[0.45em] text-white placeholder:text-white/20 focus:border-[#a8cfea]/60 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || code.length !== 6}
                  aria-busy={busy}
                  className="nr-au-google mt-3 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MailCheck className="h-4 w-4" aria-hidden />}
                  {busy ? "checking…" : "enter the seam"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStage("email");
                    setCode("");
                    setTimeout(() => emailRef.current?.focus(), 60);
                  }}
                  className="mt-2.5 w-full text-center text-[0.66rem] font-bold text-white/35 transition-colors hover:text-white/70"
                >
                  change email / resend
                </button>
              </form>
            )}

            {status.google && stage === "email" && (
              <>
                <div className="my-4 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-white/30">or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <a
                  href={`/api/auth/supabase/google/start?next=${encodeURIComponent(next)}`}
                  onClick={() => setBusy(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3.5 text-sm font-extrabold transition-colors hover:bg-white/[0.09]"
                  aria-busy={busy}
                >
                  <span aria-hidden className="text-base font-black text-[#4285f4]">G</span>
                  continue with google
                </a>
              </>
            )}
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
          by entering you agree to the terms — EYE points only, no money inside
          the game; points are earned by watching, calling it right, sharing
          and adding clips. EYE never leaves the game — value exits only
          through the season snapshot.
        </p>
      </div>
    </div>
  );
}
