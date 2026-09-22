"use client";

import { useEffect, useState } from "react";
import { useWalletSession } from "@/lib/use-wallet";
import {
  hydrateFavorites,
  resetFavoritesAfterAuth,
  useFavoritesStore,
} from "@/lib/favorites";

/* ================================================================
   Кнопка-кошелёк в шапке (task 42/43): connect Phantom (Solana,
   основной) или MetaMask (фолбэк) → сессия (cookie 30 дней) →
   в выпадашке pnl-кошелёк, избранное и пригласительная ссылка.

   Task 44: в выпадашке — бесплатные прогнозы и бейджи профиля;
   Magic Link вход (email) за серверным флагом /api/auth/magic/status.

   Сердце на карточке (task 43) диспатчит "nr-wallet-connect", когда
   зритель без сессии тапает «в избранное» — здесь ловим событие и
   открываем connect-флоу; после успеха перегидратуем избранное.
   ================================================================ */

function short(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export default function WalletButton() {
  const {
    wallet,
    provider,
    ready,
    connecting,
    error,
    inviteUrl,
    connect,
    disconnect,
  } = useWalletSession();
  const favs = useFavoritesStore();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  /* task 44: бонусы/бейджи профиля + доступность Magic Link */
  const [bonusCredits, setBonusCredits] = useState<number | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [magicEnabled, setMagicEnabled] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicState, setMagicState] = useState<"idle" | "sending" | "sent">("idle");

  /* сердце на карточке просит кошелёк → открываем connect-флоу */
  useEffect(() => {
    const onRequest = () => {
      if (wallet) return;
      void (async () => {
        await connect();
        // успешный коннект ставит cookie — перегидратуем избранное;
        // при неудаче hydrate просто снова выставит authNeeded
        resetFavoritesAfterAuth();
      })();
    };
    window.addEventListener("nr-wallet-connect", onRequest);
    return () => window.removeEventListener("nr-wallet-connect", onRequest);
  }, [wallet, connect]);

  /* панель открыта — догружаем свежий список избранного */
  useEffect(() => {
    if (open && wallet) void hydrateFavorites();
  }, [open, wallet]);

  /* панель открыта — профиль (бонусы/бейджи) + флаг Magic Link */
  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (r.ok) {
          const d = (await r.json()) as {
            bonusCredits?: number;
            badges?: string[];
          };
          setBonusCredits(d.bonusCredits ?? 0);
          setBadges(Array.isArray(d.badges) ? d.badges : []);
        }
      } catch {
        /* без профиля просто без бонусной строки */
      }
      try {
        const r = await fetch("/api/auth/magic/status", {
          cache: "no-store",
        });
        if (r.ok) {
          const d = (await r.json()) as { enabled?: boolean };
          setMagicEnabled(Boolean(d.enabled));
        }
      } catch {
        /* magic остаётся выключенным */
      }
    })();
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
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard может быть запрещён — просто не копируем */
    }
  };

  return (
    <div className="relative">
      {!ready ? (
        <span
          aria-hidden
          className="inline-block h-6 w-16 animate-pulse rounded-full bg-black/5"
        />
      ) : wallet ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95"
          aria-expanded={open}
          title={`wallet session — ${provider ?? "wallet"}`}
        >
          <span aria-hidden>{provider === "phantom" ? "🦇" : "🦊"}</span>
          {short(wallet)}
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95 disabled:opacity-60"
          title="sign in with Phantom or MetaMask"
        >
          <span aria-hidden>🦇</span>
          {connecting ? "connecting…" : "connect"}
        </button>
      )}

      {error && (
        <p className="nr-glass-deep absolute right-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl px-3 py-2 text-[0.62rem] font-semibold leading-snug text-[#c26d3f]">
          {error.includes("not found") || error.includes("No wallet") ? (
            <>
              {error}{" "}
              <a
                href="https://phantom.app/download/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                install Phantom
              </a>
              .
            </>
          ) : (
            error
          )}
        </p>
      )}

      {wallet && open && (
        <div className="nr-glass-deep absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl p-4 text-[#10161d]">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
            {provider === "phantom" ? "phantom wallet" : "metamask wallet"}
          </p>
          <p className="mt-1.5 font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
            {wallet}
          </p>
          <a
            href="/pnl"
            className="mt-3 flex items-center justify-between rounded-xl bg-[#e9f2fb] px-3.5 py-2 text-[0.7rem] font-extrabold text-[#2b6cb0] ring-1 ring-[#a8cfea] transition-colors hover:bg-[#dcecf9]"
          >
            <span>◇ pnl wallet</span>
            <span aria-hidden className="text-[0.62rem] font-bold text-[#2b6cb0]/60">
              positions · claims · reach
            </span>
          </a>

          {/* ---------- бонусы и бейджи (task 44 §6) ---------- */}
          {(bonusCredits !== null && (bonusCredits > 0 || badges.length > 0)) && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5">
              {badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-[#f3f0ff] px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-[#6d4fc2]"
                >
                  ◈ {b}
                </span>
              ))}
              {bonusCredits > 0 && (
                <span className="rounded-full bg-[#fff1e8] px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-[#c2410c]">
                  ❄ {bonusCredits} free
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
          {inviteUrl && (
            <>
              <p className="mt-3 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
                your invite link
              </p>
              <p className="mt-1.5 font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
                {inviteUrl ?? "…"}
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
                    className="min-w-0 flex-1 rounded-xl bg-[#10161d]/5 px-3 py-2 text-[0.66rem] font-semibold text-[#10161d] outline-none placeholder:text-[#10161d]/35 focus:ring-2 focus:ring-[#a8cfea]"
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
            onClick={disconnect}
            className="mt-3 block text-[0.62rem] font-bold text-[#10161d]/40 transition-colors hover:text-[#10161d]/75"
          >
            disconnect
          </button>
        </div>
      )}
    </div>
  );
}
