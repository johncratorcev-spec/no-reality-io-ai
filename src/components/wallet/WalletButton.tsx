"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import {
  hydrateFavorites,
  useFavoritesStore,
} from "@/lib/favorites";

/* ================================================================
   ACCOUNT-кнопка в шапке (v8).

   Крипто-кошелёк больше не метод входа: идентичность — мгновенный
   аккаунт (cookie nr_uid) + СВОЯ ФОРМА (email + пароль, Supabase,
   без подтверждения почты: есть аккаунт — вошёл, почта уникальна —
   профиль создан) + опциональный Google Sign-In (email в /api/me).

   Гостю показываем кнопку «email» (всегда) и «G google» (если ключи
   настроены); авторизованному — чип с email и дропдаун: баланс,
   бейджи, избранное, пригласительная ссылка, выход.
   ================================================================ */

function emailShort(email: string): string {
  const [name] = email.split("@");
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

interface ProfileData {
  refCode: string | null;
  inviteUrl: string | null;
  bonusCredits: number;
  badges: string[];
}

export default function WalletButton() {
  const { account, ready, refresh } = useAccount();
  const favs = useFavoritesStore();
  const [open, setOpen] = useState(false);

  /* v8: форма email+пароль (своя форма на Supabase) — guest-режим */
  const [pwEmail, setPwEmail] = useState("");
  const [pwPassword, setPwPassword] = useState("");
  const [pwState, setPwState] = useState<"idle" | "busy" | "done">("idle");
  const [pwMsg, setPwMsg] = useState("");

  /* v7: Google Sign-In — статус сервера (кнопка прячется без ключей) */
  const [googleEnabled, setGoogleEnabled] = useState(false);
  /* task 44: бонусы/бейджи профиля + доступность Magic Link */
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [magicEnabled, setMagicEnabled] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicState, setMagicState] = useState<"idle" | "sending" | "sent">("idle");
  const [copied, setCopied] = useState(false);

  /* Google-кнопка спрашивается при маунте (v7 fix: не внутри open-эффекта,
     иначе гость никогда её не увидит) */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/auth/google/status", { cache: "no-store" });
        if (!r.ok || !alive) return;
        const d = (await r.json()) as { enabled?: boolean };
        if (alive) setGoogleEnabled(Boolean(d.enabled));
      } catch {
        /* google остаётся выключенным */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* панель открыта — профиль (бонусы/бейджи/invite) + флаг Magic Link +
     свежее избранное */
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as {
            refCode?: string | null;
            inviteUrl?: string | null;
            bonusCredits?: number;
            badges?: string[];
          };
          setProfile({
            refCode: d.refCode ?? null,
            inviteUrl: d.inviteUrl ?? null,
            bonusCredits: d.bonusCredits ?? 0,
            badges: Array.isArray(d.badges) ? d.badges : [],
          });
        }
      } catch {
        /* без профиля просто без бонусной строки */
      }
      try {
        const r = await fetch("/api/auth/magic/status", { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as { enabled?: boolean };
          setMagicEnabled(Boolean(d.enabled));
        }
      } catch {
        /* magic остаётся выключенным */
      }
    })();
    void hydrateFavorites();
  }, [open]);

  const sendMagic = async () => {
    if (!magicEmail.trim() || magicState !== "idle") return;
    setMagicState("sending");
    try {
      const r = await fetch("/api/auth/magic/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: magicEmail.trim() }),
      });
      if (r.ok) setMagicState("sent");
      else setMagicState("idle");
    } catch {
      setMagicState("idle");
    }
  };

  const copyInvite = async () => {
    if (!profile?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(profile.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard может быть запрещён — просто не копируем */
    }
  };

  /* v8: вход/регистрация своей формой — сервер сам разберётся:
     email есть → сверит пароль и впустит; почта уникальна → создаст профиль */
  const submitPassword = async () => {
    if (pwState !== "idle" || !pwEmail.trim() || !pwPassword) return;
    setPwState("busy");
    setPwMsg("");
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: pwEmail.trim(), password: pwPassword }),
      });
      const d = (await r.json()) as {
        ok?: boolean;
        isNew?: boolean;
        error?: string;
      };
      if (r.ok && d.ok) {
        setPwState("done");
        setPwMsg("");
        setOpen(false);
        await refresh();
        window.location.reload();
        return;
      }
      setPwState("idle");
      if (d.error === "wrong_password") setPwMsg("wrong password — this email already has an account");
      else if (d.error === "bad_password") setPwMsg("password: 8+ characters");
      else if (d.error === "bad_email") setPwMsg("check the email address");
      else if (d.error === "too_many_requests") setPwMsg("too many attempts — wait a minute");
      else setPwMsg("auth failed — try again");
    } catch {
      setPwState("idle");
      setPwMsg("network blinked — try again");
    }
  };

  /* v7.1: выход — сброс nr_uid/nr_email; google-аккаунт вернётся по email */
  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      /* best-effort */
    }
    setOpen(false);
    await refresh();
    window.location.reload();
  }, [refresh]);

  /* ---------- рендер ---------- */
  if (!ready) {
    return (
      <span
        aria-hidden
        className="inline-block h-6 w-16 animate-pulse rounded-full bg-white/10"
      />
    );
  }

  const email = account?.email ?? null;

  return (
    <div className="relative">
      {email ? (
        /* ----- google/magic-сессия: чип + дропдаун аккаунта ----- */
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95"
            aria-expanded={open}
            title={`account — ${email}`}
          >
            <span aria-hidden className="text-[0.8rem] font-black">G</span>
            {emailShort(email)}
          </button>

          {open && (
            <div className="nr-glass-deep absolute bottom-[calc(100%+8px)] right-0 z-50 w-64 rounded-2xl p-4 text-[#10161d]">
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                google account
              </p>
              <p className="mt-1.5 break-all font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
                {email}
              </p>

              {/* ---------- бонусы и бейджи (task 44 §6) ---------- */}
              {profile && (profile.bonusCredits > 0 || profile.badges.length > 0) && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5">
                  {profile.badges.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-[#6d4fc2]"
                    >
                      ◈ {b}
                    </span>
                  ))}
                  {profile.bonusCredits > 0 && (
                    <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-[#c2410c]">
                      ❄ {profile.bonusCredits} free
                    </span>
                  )}
                </p>
              )}

              {/* ---------- избранное (task 43) ---------- */}
              {favs.ready && favs.items.length > 0 && (
                <>
                  <p className="mt-3 flex items-center justify-between text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                    <span>♥ favorites</span>
                    <span className="text-[#6d4fc2]/60">{favs.items.length}</span>
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {favs.items.slice(0, 5).map((f) => (
                      <li key={f.postCode}>
                        <a
                          href={`/v/${f.postCode}`}
                          className="block truncate rounded-lg px-2 py-1 text-[0.66rem] font-bold text-[#10161d]/75 transition-colors hover:bg-[#10161d]/5 hover:text-[#10161d]"
                        >
                          {f.title || f.author || `/v/${f.postCode}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {favs.items.length > 5 && (
                    <a
                      href="/pnl"
                      className="mt-1 block text-right text-[0.6rem] font-extrabold text-[#6d4fc2]/70 transition-colors hover:text-[#6d4fc2]"
                    >
                      all favorites →
                    </a>
                  )}
                </>
              )}

              {/* ---------- пригласительная ссылка ---------- */}
              {profile?.inviteUrl && (
                <>
                  <p className="mt-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                    your invite link
                  </p>
                  <p className="mt-1.5 break-all font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
                    {profile.inviteUrl}
                  </p>
                  <p className="mt-2 text-[0.6rem] font-semibold leading-snug text-[#10161d]/50">
                    anyone who pays through it earns you{" "}
                    <span className="text-[#6d4fc2]">20%</span> of the invoice.
                  </p>
                  <button
                    onClick={copyInvite}
                    className="mt-3 rounded-full bg-[#10161d]/5 px-3.5 py-1.5 text-[0.66rem] font-extrabold text-[#10161d] ring-1 ring-[#10161d]/15 transition-colors hover:bg-[#10161d]/10"
                  >
                    {copied ? "copied ✓" : "copy invite"}
                  </button>
                </>
              )}

              {/* ---------- Magic Link (task 44 §6): email-вход как дополнение ---------- */}
              {magicEnabled && (
                <>
                  <p className="mt-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                    email sign-in
                  </p>
                  {magicState === "sent" ? (
                    <p className="mt-1.5 text-[0.64rem] font-semibold leading-snug text-[#1d7a3e]">
                      link sent ✓ — check your inbox, it works once and expires in
                      15 minutes.
                    </p>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="email"
                        inputMode="email"
                        value={magicEmail}
                        onChange={(e) => setMagicEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void sendMagic();
                        }}
                        placeholder="you@mail.com"
                        aria-label="Email for magic sign-in link"
                        className="min-w-0 flex-1 rounded-xl bg-[#10161d]/10 px-3 py-2 text-[0.66rem] font-semibold text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[#a8cfea]"
                      />
                      <button
                        onClick={() => void sendMagic()}
                        disabled={magicState === "sending" || !magicEmail.trim()}
                        className="rounded-xl bg-[#10161d]/5 px-3 py-2 text-[0.62rem] font-extrabold text-[#10161d] ring-1 ring-[#10161d]/15 transition-colors hover:bg-[#10161d]/10 disabled:opacity-50"
                      >
                        {magicState === "sending" ? "…" : "send link"}
                      </button>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={() => void signOut()}
                className="mt-3 block text-[0.62rem] font-bold text-[#10161d]/40 transition-colors hover:text-[#10161d]/75"
              >
                sign out
              </button>
            </div>
          )}
        </>
      ) : (
        /* ----- гость: своя форма email+пароль (всегда) + Google (если настроен) ----- */
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOpen((v) => !v)}
            title="sign in or create account with email"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#1f2937] ring-1 ring-[#e5e7eb] transition-all duration-300 hover:scale-105 hover:bg-[#f9fafb] active:scale-95"
            aria-expanded={open}
          >
            <span aria-hidden className="text-[0.8rem] font-black">@</span>
            email
          </button>
          {googleEnabled && (
            <a
              href="/api/auth/google/start"
              title="sign in with Google"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#1f2937] ring-1 ring-[#e5e7eb] transition-all duration-300 hover:scale-105 hover:bg-[#f9fafb] active:scale-95"
            >
              <span aria-hidden className="text-[0.8rem] font-black">G</span>
              google
            </a>
          )}

          {open && (
            <div className="nr-glass-deep absolute bottom-[calc(100%+8px)] right-0 z-50 w-64 rounded-2xl p-4 text-[#10161d]">
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                email sign-in
              </p>
              <p className="mt-1 text-[0.62rem] font-semibold leading-snug text-[#10161d]/55">
                account exists — you&apos;re in; new email — profile is created.
                no confirmation letters.
              </p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={pwEmail}
                onChange={(e) => setPwEmail(e.target.value)}
                placeholder="you@mail.com"
                aria-label="Email"
                className="mt-2 w-full rounded-xl bg-[#10161d]/10 px-3 py-2 text-[0.68rem] font-semibold text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[#a8cfea]"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={pwPassword}
                onChange={(e) => setPwPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitPassword();
                }}
                placeholder="password (8+)"
                aria-label="Password"
                className="mt-1.5 w-full rounded-xl bg-[#10161d]/10 px-3 py-2 text-[0.68rem] font-semibold text-white ring-1 ring-white/15 outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[#a8cfea]"
              />
              <button
                onClick={() => void submitPassword()}
                disabled={pwState === "busy" || !pwEmail.trim() || pwPassword.length < 8}
                className="mt-2 w-full rounded-xl bg-[#6d4fc2] px-3 py-2 text-[0.68rem] font-extrabold text-white transition-colors hover:bg-[#5d3fb0] disabled:opacity-50"
              >
                {pwState === "busy" ? "…" : "enter / create"}
              </button>
              {pwMsg && (
                <p className="mt-1.5 text-[0.62rem] font-bold leading-snug text-[#c2410c]">
                  {pwMsg}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
