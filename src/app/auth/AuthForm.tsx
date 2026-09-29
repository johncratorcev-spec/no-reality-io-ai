"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/* ================================================================
   v9 — форма входа/регистрации закрытого запуска.

   ЕДИНСТВЕННАЯ дверь сайта: middleware перекидывает сюда всех
   без nr_auth. Сценарии сервера /api/auth/password:
     - email существует → пароль → вход (registered→bet);
     - email новый + промокод → аккаунт (registered);
     - email новый без промо → waitlisted (лист ожидания).
   Google-вход: промокод из формы едет в cookie через
   /api/auth/google/start?promo=… → гейт на callback'е.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
        <p className="font-[family-name:var(--font-manrope)] text-lg font-black tracking-tight">
          no-reality<span className="text-[#5b9bd5]">.</span>
        </p>
        <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight">
          you&apos;re on
          <br />
          the list
        </h1>
        <p className="mt-3 text-[0.8rem] font-semibold leading-relaxed text-white/55">
          {waitReason === "promo_used"
            ? "this promo code has already been used — your email is saved on the waiting list."
            : waitReason === "invalid_code"
              ? "that code didn't work — your email is saved on the waiting list."
              : "your email is saved. we open the doors in waves — you'll get your code."}
        </p>
        <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed text-white/55">
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
          className="mt-4 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 font-mono text-sm tracking-widest text-white uppercase outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:border-[#5b9bd5]"
        />
        {msg && <p className="mt-2 text-[0.72rem] font-bold text-[#ff9d7a]">{msg}</p>}
        <button
          onClick={() => void redeemAfterWaitlist()}
          disabled={busy || !promo.trim()}
          className="mt-3 w-full rounded-xl bg-[#6d4fc2] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#5d3fb0] disabled:opacity-40"
        >
          {busy ? "…" : "redeem code"}
        </button>
        <button
          onClick={() => {
            setPhase("form");
            setMsg("");
            setPromo("");
          }}
          className="mt-3 block w-full text-center text-[0.72rem] font-bold text-white/40 transition-colors hover:text-white/70"
        >
          back
        </button>
      </div>
    );
  }

  /* ---------- форма ---------- */
  return (
    <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
      <p className="font-[family-name:var(--font-manrope)] text-lg font-black tracking-tight">
        no-reality<span className="text-[#5b9bd5]">.</span>
      </p>
      <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight">
        closed launch
      </h1>
      <p className="mt-2 text-[0.8rem] font-semibold leading-relaxed text-white/55">
        account exists — you&apos;re in. new email — enter your promo code, no
        code means the waiting list. no confirmation letters, ever.
      </p>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@mail.com"
        aria-label="Email"
        className="mt-5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-[#5b9bd5]"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        placeholder="password (8+)"
        aria-label="Password"
        className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-[#5b9bd5]"
      />

      {/* промокод — сворачиваемый, чтобы не путать тех, кто просто входит */}
      {!promoOpen ? (
        <button
          onClick={() => setPromoOpen(true)}
          className="mt-3 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-[#a8cfea] transition-colors hover:text-white"
        >
          ◆ i have a promo code
        </button>
      ) : (
        <input
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          placeholder="NR-XXXX-XXXX-XXXX"
          aria-label="Promo code"
          autoCapitalize="characters"
          className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 font-mono text-sm tracking-widest text-white uppercase outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:border-[#a8cfea]"
        />
      )}

      {msg && <p className="mt-3 text-[0.72rem] font-bold text-[#ff9d7a]">{msg}</p>}

      <button
        onClick={() => void submit()}
        disabled={busy || !email.trim() || password.length < 8}
        className="mt-4 w-full rounded-xl bg-[#6d4fc2] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#5d3fb0] disabled:opacity-40"
      >
        {busy ? "…" : "enter / redeem"}
      </button>

      {googleEnabled && (
        <>
          <div className="mt-5 flex items-center gap-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-white/30">
            <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
          </div>
          <a
            href={`/api/auth/google/start?next=${encodeURIComponent(next)}${
              promo.trim() ? `&promo=${encodeURIComponent(promo.trim())}` : ""
            }`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-[#1f2937] transition-colors hover:bg-[#f1f5f9]"
          >
            <span aria-hidden className="text-base font-black text-[#4285f4]">G</span>
            continue with google
          </a>
        </>
      )}

      <p className="mt-5 text-[0.66rem] font-semibold leading-relaxed text-white/30">
        by entering you agree to the terms — virtual coins only, no money
        inside the game; paid boosts and deposits run through separate
        crypto invoices.
      </p>
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
