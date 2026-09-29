"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

/* ================================================================
   AuthForm v10 — премиум-форма входа/регистрации.

   Сайт ОТКРЫТ (v10): лента/страницы смотрятся без аккаунта, эта форма —
   дверь к БЕТТИНГУ. Сценарии сервера /api/auth/password:
     - email существует → пароль → вход (registered→next);
     - email новый + промокод → аккаунт (registered);
     - email новый без промо → waitlisted (лист ожидания).
   Google-вход: промокод из формы едет в cookie через
   /api/auth/google/start?promo=… → callback.

   Все анимации — CSS (nr-au-*): вход-каскад, вращающееся градиентное
   кольцо карточки, свип на кнопке, свечения фокуса.
   ================================================================ */

type Phase = "form" | "waitlisted";

export default function AuthForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/bet";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [promo, setPromo] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [waitReason, setWaitReason] = useState<string>("");
  const [msg, setMsg] = useState("");
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
      } catch {
        /* без google */
      }
    })();
    /* пришёл с callback'а google (?waitlisted=1) или с ошибкой (?auth=…) */
    if (params.get("waitlisted") === "1") {
      setPhase("waitlisted");
      setWaitReason(params.get("reason") || "no_code");
      setEmail(params.get("email") || "");
    } else if (params.get("auth")) {
      const a = params.get("auth") || "";
      setMsg(
        a === "rate_limited"
          ? "too many attempts — wait a bit"
          : a === "google_state"
            ? "session expired — try again"
            : a === "google_profile"
              ? "google account must have a verified email"
              : "google sign-in failed — try again"
      );
    }
  }, []);

  const go = (path: string) => {
    window.location.href = path;
  };

  const submit = async () => {
    if (busy || !email.trim() || password.length < 8) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          promo: promoOpen && promo.trim() ? promo.trim() : undefined,
        }),
      });
      const d = (await r.json()) as {
        ok?: boolean;
        status?: string;
        reason?: string;
        error?: string;
      };
      if (r.ok && d.ok && (d.status === "registered" || d.status === "login")) {
        go(next);
        return;
      }
      if (r.ok && d.ok && d.status === "waitlisted") {
        setWaitReason(d.reason || "no_code");
        setPhase("waitlisted");
        setBusy(false);
        return;
      }
      setBusy(false);
      if (d.error === "wrong_password")
        setMsg("wrong password — this email already has an account");
      else if (d.error === "bad_password") setMsg("password: 8+ characters");
      else if (d.error === "bad_email") setMsg("check the email address");
      else if (d.error === "too_many_requests")
        setMsg("too many attempts — wait a bit and retry");
      else setMsg("something blinked — try again");
    } catch {
      setBusy(false);
      setMsg("network blinked — try again");
    }
  };

  /* ---------- лист ожидания ---------- */
  if (phase === "waitlisted") {
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
            className="nr-au-up mt-4 text-2xl font-black leading-tight tracking-tight"
            style={{ animationDelay: "100ms" }}
          >
            you&apos;re on
            <br />
            the list
          </h1>
          <p
            className="nr-au-up mt-3 text-[0.8rem] font-semibold leading-relaxed text-white/55"
            style={{ animationDelay: "160ms" }}
          >
            {waitReason === "promo_used"
              ? "this promo code has already been used — your email is saved on the waiting list."
              : waitReason === "invalid_code"
                ? "that code didn't work — your email is saved on the waiting list."
                : "your email is saved. we open the doors in waves — you'll get your code."}
          </p>
          <p
            className="nr-au-up mt-2 text-[0.8rem] font-semibold leading-relaxed text-white/55"
            style={{ animationDelay: "220ms" }}
          >
            got a code? redeem it right now and skip the line:
          </p>

          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && promo.trim()) void redeemAfterWaitlist();
            }}
            placeholder="NR-XXXX-XXXX-XXXX"
            aria-label="Promo code"
            autoCapitalize="characters"
            className="nr-au-input nr-au-up mt-4 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
            style={{ animationDelay: "280ms" }}
          />
          {msg && <p className="nr-au-err mt-2 text-[0.72rem] font-bold">{msg}</p>}
          <button
            onClick={() => void redeemAfterWaitlist()}
            disabled={busy || !promo.trim()}
            className="nr-au-cta nr-au-up mt-3 w-full px-4 py-3 text-sm font-extrabold disabled:opacity-40"
            style={{ animationDelay: "340ms" }}
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {busy ? "…" : "redeem code"}
            </span>
          </button>
          <button
            onClick={() => {
              setPhase("form");
              setMsg("");
              setPromo("");
            }}
            className="nr-au-up mt-3 block w-full text-center text-[0.72rem] font-bold text-white/40 transition-colors hover:text-white/70"
            style={{ animationDelay: "400ms" }}
          >
            back
          </button>
        </div>
      </div>
    );
  }

  /* ---------- форма ---------- */
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
          watching is free — betting needs an account. account exists
          {" — "}you&apos;re in. new email — enter your promo code, no code
          means the waiting list. no confirmation letters, ever.
        </p>

        <div className="nr-au-up mt-5" style={{ animationDelay: "220ms" }}>
          <label className="sr-only" htmlFor="nr-au-email">Email</label>
          <input
            id="nr-au-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@mail.com"
            className="nr-au-input"
          />
        </div>
        <div className="nr-au-up mt-2" style={{ animationDelay: "270ms" }}>
          <label className="sr-only" htmlFor="nr-au-password">Password</label>
          <input
            id="nr-au-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="password (8+)"
            className="nr-au-input"
          />
        </div>

        {/* промокод — сворачиваемый, чтобы не путать тех, кто просто входит */}
        {!promoOpen ? (
          <button
            onClick={() => setPromoOpen(true)}
            className="nr-au-up nr-au-promo mt-3 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-[#a8cfea] transition-colors hover:text-white"
            style={{ animationDelay: "320ms" }}
          >
            ◆ i have a promo code
          </button>
        ) : (
          <div className="nr-au-up mt-3" style={{ animationDelay: "60ms" }}>
            <label className="sr-only" htmlFor="nr-au-promo">Promo code</label>
            <input
              id="nr-au-promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="NR-XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              className="nr-au-input nr-au-input-promo font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
            />
          </div>
        )}

        {msg && <p className="nr-au-err mt-3 text-[0.72rem] font-bold">{msg}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy || !email.trim() || password.length < 8}
          className="nr-au-cta nr-au-up mt-4 w-full px-4 py-3.5 text-sm font-extrabold disabled:opacity-40"
          style={{ animationDelay: "370ms" }}
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "…" : "enter / redeem"}
          </span>
        </button>

        {googleEnabled && (
          <>
            <div
              className="nr-au-up mt-5 flex items-center gap-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-white/30"
              style={{ animationDelay: "420ms" }}
            >
              <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
            </div>
            <a
              href={`/api/auth/google/start?next=${encodeURIComponent(next)}${
                promo.trim() ? `&promo=${encodeURIComponent(promo.trim())}` : ""
              }`}
              className="nr-au-up nr-au-google mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold"
              style={{ animationDelay: "470ms" }}
            >
              <span aria-hidden className="text-base font-black text-[#4285f4]">G</span>
              continue with google
            </a>
          </>
        )}

        {/* v10: сайт открыт — гость может вернуться смотреть */}
        <a
          href={next && next !== "/auth" ? next : "/"}
          className="nr-au-up mt-5 flex items-center justify-center gap-1.5 text-[0.68rem] font-bold text-white/35 transition-colors hover:text-white/70"
          style={{ animationDelay: "520ms" }}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          keep watching without an account
        </a>

        <p
          className="nr-au-up mt-3 text-[0.62rem] font-semibold leading-relaxed text-white/25"
          style={{ animationDelay: "570ms" }}
        >
          by entering you agree to the terms — virtual coins only, no money
          inside the game; paid boosts and deposits run through separate
          crypto invoices.
        </p>
      </div>
    </div>
  );

  /* повторная попытка с экрана листа ожидания: тот же роут, но
     отправляем сохранённый email/пароль + новый код */
  async function redeemAfterWaitlist() {
    if (busy || !promo.trim()) return;
    if (!email.trim() || password.length < 8) {
      setPhase("form");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, promo: promo.trim() }),
      });
      const d = (await r.json()) as { ok?: boolean; status?: string; error?: string };
      if (r.ok && d.ok && (d.status === "registered" || d.status === "login")) {
        go(next);
        return;
      }
      setBusy(false);
      if (d.error === "too_many_requests") setMsg("too many attempts — wait a bit");
      else if (d.error === "wrong_password") setMsg("wrong password for this email");
      else setMsg("code didn't work — still on the list");
    } catch {
      setBusy(false);
      setMsg("network blinked — try again");
    }
  }
}
