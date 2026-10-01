"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

/* ================================================================
   AuthForm v12 — премиум-форма входа. СЕКРЕТНЫЕ КОДЫ УБРАНЫ:
   ни промо-кодов, ни листа ожидания — сайт открыт.

   Двери входа:
     1. Telegram Login Widget (главная дверь кампании Season 1);
     2. email + пароль — прямая регистрация (POST /api/auth/password);
     3. Google (кнопка только с настроенными ключами).

   Telegram: username бота приходит С СЕРВЕРА (getMe по токену из env,
   авто-резолв) — виджет рисуется только под реально подключённого бота,
   иначе показываем честную заметку вместо кнопки.
   Все анимации — CSS (nr-au-*): вход-каскад, вращающееся градиентное
   кольцо карточки, свип на кнопке, свечения фокуса.
   ================================================================ */

/* Telegram Login Widget коллит этот глобал с объектом пользователя */
declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function AuthForm({ botUsername }: { botUsername?: string }) {
  const params = useSearchParams();
  const next = params.get("next") || "/bet";

  /* виджет Telegram рисует «Bot domain invalid» на хостах, которых нет
     в /setdomain бота — на localhost/чужих превью-доменах слот прячем.
     Решение принимаем ПОСЛЕ гидратации (отложенный тик), чтобы SSR и
     первый клиентский рендер совпадали байт в байт */
  const [tgHostOk, setTgHostOk] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const host = window.location.hostname;
      setTgHostOk(!/^(localhost|127\.|0\.0\.0\.0)$/.test(host));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const TG_BOT = (botUsername || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  /* ошибка, принесённая с callback'а google (?auth=…) — известна на
     первом рендере, поэтому считаем её синхронно в инициализаторе */
  const [msg, setMsg] = useState(() => {
    const a = params.get("auth") || "";
    if (!a) return "";
    return a === "rate_limited"
      ? "too many attempts — wait a bit"
      : a === "google_state"
        ? "session expired — try again"
        : a === "google_profile"
          ? "google account must have a verified email"
          : "google sign-in failed — try again";
  });
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [tgReady, setTgReady] = useState(false);
  const tgBox = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

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
  }, []);

  const go = (path: string) => {
    window.location.href = path;
  };

  /* ---------- Telegram Login Widget (главная дверь кампании) ---------- */
  useEffect(() => {
    if (!TG_BOT || !tgHostOk) return;
    window.onTelegramAuth = (user: Record<string, unknown>) => {
      setMsg("");
      setBusy(true);
      void (async () => {
        try {
          const r = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(user),
          });
          const d = (await r.json()) as { ok?: boolean; error?: string };
          if (r.ok && d.ok) {
            go(nextRef.current);
            return;
          }
          setBusy(false);
          setMsg(
            d.error === "too_many_requests"
              ? "too many attempts — wait a bit"
              : "telegram sign-in failed — try again"
          );
        } catch {
          setBusy(false);
          setMsg("network blinked — try again");
        }
      })();
    };
    /* виджет — это их script с data-атрибутами; вставляем в контейнер */
    const box = tgBox.current;
    if (!box || box.childElementCount > 0) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", TG_BOT);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "14");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    s.onload = () => setTgReady(true);
    box.appendChild(s);
    /* если скрипт заблокирован (нет связи с telegram.org) — покажем подсказку */
    const t = setTimeout(() => {
      if (tgBox.current && tgBox.current.childElementCount <= 1) setTgReady(false);
    }, 4000);
    return () => clearTimeout(t);
  }, [TG_BOT, tgHostOk]);

  const submit = async () => {
    if (busy || !email.trim() || password.length < 8) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const d = (await r.json()) as {
        ok?: boolean;
        status?: string;
        error?: string;
      };
      if (r.ok && d.ok && (d.status === "registered" || d.status === "login")) {
        go(next);
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
          watching is free — betting needs an account. sign in with telegram
          and get <span className="text-[#a8cfea]">100 EYE</span> to call your
          first verdict. no confirmation letters, ever.
        </p>

        {/* ---------- Telegram — главный вход (первым) ---------- */}
        {TG_BOT && tgHostOk && (
          <div className="nr-au-up mt-5" style={{ animationDelay: "200ms" }}>
            <div
              ref={tgBox}
              className="flex min-h-[48px] items-center justify-center"
              aria-label="Telegram sign-in button"
            />
            {!tgReady && (
              <p className="mt-1 text-center text-[0.62rem] font-semibold text-white/30">
                loading the telegram button…
              </p>
            )}
          </div>
        )}
        {TG_BOT && tgHostOk && (
          <div
            className="nr-au-up mt-4 flex items-center gap-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-white/30"
            style={{ animationDelay: "230ms" }}
          >
            <span className="h-px flex-1 bg-white/10" />or by email<span className="h-px flex-1 bg-white/10" />
          </div>
        )}
        {TG_BOT && !tgHostOk && (
          <p className="nr-au-up mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-center text-[0.66rem] font-bold text-white/45" style={{ animationDelay: "200ms" }}>
            telegram sign-in works on no-reality.fun —
            <br />here use email or google.
          </p>
        )}
        {!TG_BOT && (
          <p className="nr-au-up mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-center text-[0.66rem] font-bold text-white/45" style={{ animationDelay: "200ms" }}>
            telegram sign-in is being connected —
            <br />use email below for now.
          </p>
        )}

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

        {msg && <p className="nr-au-err mt-3 text-[0.72rem] font-bold">{msg}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy || !email.trim() || password.length < 8}
          className="nr-au-cta nr-au-up mt-4 w-full px-4 py-3.5 text-sm font-extrabold disabled:opacity-40"
          style={{ animationDelay: "370ms" }}
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? "…" : "enter"}
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
              href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
              className="nr-au-up nr-au-google mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold"
              style={{ animationDelay: "470ms" }}
            >
              <span aria-hidden className="text-base font-black text-[#4285f4]">G</span>
              continue with google
            </a>
          </>
        )}

        {/* сайт открыт — гость может вернуться смотреть */}
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
          by entering you agree to the terms — EYE points only, no money
          inside the game; points are earned by watching, calling it right
          and adding clips. not for sale during season 1.
        </p>
      </div>
    </div>
  );
}
