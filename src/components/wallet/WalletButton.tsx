"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
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

interface SeasonData {
  name: string;
  daysLeft: number;
  snapshotLabel: string;
  snapshotDate: string;
}

export default function WalletButton() {
  const { account, ready, refresh } = useAccount();
  const favs = useFavoritesStore();
  const [open, setOpen] = useState(false);

  /* v9: статус Google больше не нужен в шапке — гостевой блок уведён на
     /auth (там свой статус-фетч); здесь остаётся только аккаунт-чип */
  /* task 44: бонусы/бейджи профиля + доступность Magic Link */
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [magicEnabled, setMagicEnabled] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicState, setMagicState] = useState<"idle" | "sending" | "sent">("idle");
  const [copied, setCopied] = useState(false);

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
        const r = await fetch("/api/season", { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as { season?: SeasonData };
          if (d.season) setSeason(d.season);
        }
      } catch {
        /* сезон — не критично */
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

  /* v7.1: выход — сброс nr_uid/nr_auth; google-аккаунт вернётся по email */
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
  const name = account?.name ?? null;
  /* чип: email (google/пароль) или Telegram-имя; гость — кнопка входа */
  const chipLabel = email ? emailShort(email) : name ? (name.length > 14 ? `${name.slice(0, 13)}…` : name) : null;

  return (
    <div className="relative">
      {chipLabel ? (
        /* ----- сессия (google/email/telegram): чип + дропдаун аккаунта ----- */
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95"
            aria-expanded={open}
            title={`account — ${email || name}`}
          >
            {email ? (
              <span aria-hidden className="text-[0.8rem] font-black">G</span>
            ) : (
              <Send aria-hidden className="h-3 w-3 text-[#229ED9]" />
            )}
            {chipLabel}
          </button>

          {open && (
            <div className="nr-glass-deep absolute bottom-[calc(100%+8px)] right-0 z-50 w-64 rounded-2xl p-4 text-[#10161d]">
              <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                account
              </p>
              <p className="mt-1.5 break-all font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
                {email || name}
              </p>

              {/* ---------- v11: серая строка сезона (приказ — профиль) ---------- */}
              {season && (
                <p className="mt-3 text-[0.62rem] font-semibold leading-snug text-[#10161d]/45">
                  {season.name} · snapshot in{" "}
                  {season.daysLeft > 0 ? `${season.daysLeft} day${season.daysLeft === 1 ? "" : "s"}` : "today"}
                  {" · "}
                  {season.snapshotLabel}
                </p>
              )}

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
        /* ----- гость: v10 — сайт открыт, беттинг за авторизацией.
           Кнопка ведёт на премиум-экран входа с next=текущая страница. ----- */
        <a
          href={`/auth?next=${encodeURIComponent(
            typeof window !== "undefined" && window.location.pathname
              ? `${window.location.pathname}${window.location.search}`
              : "/bet"
          )}`}
          title="sign in to bet"
          className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-white transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(120deg, #6d4fc2 0%, #8b5fd6 50%, #6d4fc2 100%)",
            backgroundSize: "200% 100%",
            boxShadow: "0 0 18px rgba(109,79,194,0.35)",
          }}
        >
          <span
            aria-hidden
            className="nr-auth-shimmer absolute inset-0"
          />
          <span aria-hidden className="relative text-[0.8rem] font-black">@</span>
          <span className="relative">enter</span>
        </a>
      )}
    </div>
  );
}
