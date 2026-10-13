"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";

/* ================================================================
   AuthForm v22 — email + ПАРОЛЬ, чистая логика БД (без внешнего IdP).

   Парольный роут сам разбирается с входом/регистрацией: новый email
   = аккаунт создаётся мгновенно (+100 EYE welcome). Пока на сервере
   задан NR_ACCESS_KEY — третье поле: ключ доступа (вход существующих
   — без ключа).

   Минимализм: одна форма, три поля максимум, ноль лишних шагов.
   Turnstile (если включён NEXT_PUBLIC_TURNSTILE_SITE_KEY) — невидимый
   виджет, токен уходит в /password.
   ================================================================ */

/* защита от open redirect: только относительные пути этого сайта */
function sanitizeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) return raw;
  return "/bet";
}

interface AuthStatus {
  password: boolean;
  keyRequired: boolean;
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
  auth_unavailable: "sign-in is temporarily unavailable — we are on it",
  bad_email: "that email doesn't look right",
  weak_password: "password needs at least 6 characters",
  invalid_credentials: "wrong email or password",
  bad_key: "wrong key — grab the fresh one from the crew",
  captcha_failed: "captcha not passed — try again",
};

export default function AuthForm() {
  const params = useSearchParams();
  const next = sanitizeNext(params.get("next"));

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState(() => {
    const a = params.get("auth") || "";
    return a ? ERR_TEXT[a] || "sign-in failed — try again" : "";
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const tsContainer = useRef<HTMLDivElement>(null);
  const tsWidgetId = useRef<string | null>(null);

  /* статус двери (ключ/капча) */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/auth/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = (await r.json()) as AuthStatus;
        if (alive) setStatus(d);
      } catch {
        /* статус недоступен — форма всё равно рабочая (парольная дверь
           живёт в нашей БД и не зависит от внешних сервисов) */
        if (alive) setStatus({ password: true, keyRequired: false, turnstile: false });
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
    const el = tsContainer.current?.querySelector<HTMLInputElement>(
      "input[name^=\"cf-turnstile\"]"
    );
    return el?.value ?? null;
  };

  /* ---- единственный путь: email + пароль (вход или мгновенная регистрация) ---- */
  const submit = useCallback(async () => {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          key: key || undefined,
          turnstileToken: turnstileToken(),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setMsg(ERR_TEXT[d.error || ""] || "sign-in failed — try again");
        window.turnstile?.reset(tsWidgetId.current || undefined);
        return;
      }
      window.location.href = next;
    } catch {
      setMsg("network hiccup — try again");
    } finally {
      setBusy(false);
    }
  }, [email, password, key, next]);

  const keyRequired = Boolean(status?.keyRequired);

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
          email + password — 15 seconds and you are in. new here? the account
          opens instantly and <span className="text-[#a8cfea]">100 EYE</span>{" "}
          land on your balance for the first verdict.
        </p>

        {msg && <p className="nr-au-err mt-4 text-[0.72rem] font-bold">{msg}</p>}

        {status === null ? (
          <div
            className="nr-au-up mt-6 flex items-center justify-center gap-2 text-[0.7rem] font-bold text-white/35"
            style={{ animationDelay: "220ms" }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            opening the doors…
          </div>
        ) : (
          <div className="nr-au-up mt-6" style={{ animationDelay: "220ms" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy && email && password.length >= 6 && (!keyRequired || key.trim())) {
                  void submit();
                }
              }}
            >
              <label
                htmlFor="nr-email"
                className="mb-1.5 block text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/40"
              >
                email
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
              <label
                htmlFor="nr-pass"
                className="mb-1.5 mt-3 block text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/40"
              >
                password
              </label>
              <input
                id="nr-pass"
                ref={passRef}
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3.5 text-[0.9rem] font-bold text-white placeholder:text-white/25 focus:border-[#a8cfea]/60 focus:outline-none"
              />
              {keyRequired && (
                <>
                  <label
                    htmlFor="nr-key"
                    className="mb-1.5 mt-3 block text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/40"
                  >
                    key
                  </label>
                  <input
                    id="nr-key"
                    ref={keyRef}
                    type="text"
                    autoComplete="off"
                    required
                    maxLength={64}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="invite key"
                    className="w-full rounded-xl border border-white/12 bg-black/40 px-4 py-3.5 text-[0.9rem] font-bold text-white placeholder:text-white/25 focus:border-[#a8cfea]/60 focus:outline-none"
                  />
                </>
              )}
              <div ref={tsContainer} className="mt-3 flex justify-center" />
              <button
                type="submit"
                disabled={busy || !email || password.length < 6 || (keyRequired && !key.trim())}
                aria-busy={busy}
                className="nr-au-google mt-3 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden />
                )}
                {busy ? "checking…" : "play · +100 EYE"}
              </button>
            </form>
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
