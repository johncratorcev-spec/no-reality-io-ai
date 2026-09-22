"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useWalletSession } from "@/lib/use-wallet";
import { peekCryoWallet } from "@/lib/cryo/wallet";
import type { CryoPnlSummary } from "@/lib/cryo/core";
import { hookCryoAudioUnlock, playCryoSfx } from "@/lib/cryo/audio";
import { hydrateFavorites, useFavoritesStore } from "@/lib/favorites";

/* ================================================================
   PNL WALLET (task 42, пункт 8) — позиции, выплаты, клейм USDC.

   Identity: сессия Phantom (cookie) или гостевой demo-адрес из
   localStorage (peekCryoWallet — без поп-апов). Данные —
   GET /api/cryo/pnl, клейм — POST /api/cryo/claim.
   ================================================================ */

function short(w: string): string {
  return w.length > 14 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
}

type Flash = { id: number; text: string } | null;

export default function PnlWallet() {
  const { wallet: sessionWallet, provider, ready, connecting, connect } =
    useWalletSession();
  const favs = useFavoritesStore();
  const [guestWallet, setGuestWallet] = useState<string | null>(null);
  const [pnl, setPnl] = useState<CryoPnlSummary | null>(null);
  const [dbDown, setDbDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* гостевой адрес (demo-позиции) — read-only, без поп-апов */
  useEffect(() => {
    void peekCryoWallet().then((w) => setGuestWallet(w));
    void hydrateFavorites();
    hookCryoAudioUnlock();
  }, []);

  const wallet = sessionWallet ?? guestWallet;

  const load = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(
        `/api/cryo/pnl?wallet=${encodeURIComponent(wallet)}`,
        { cache: "no-store" }
      );
      if (r.status === 503) {
        setDbDown(true);
        setPnl(null);
      } else if (r.ok) {
        const d = (await r.json()) as CryoPnlSummary & { wallet?: string | null };
        if (!d.wallet) {
          setPnl(null);
        } else {
          setPnl(d);
          setDbDown(false);
        }
      } else {
        setPnl(null);
      }
    } catch {
      setDbDown(true);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const claim = useCallback(
    async (postCode: string) => {
      if (!wallet || claiming) return;
      setClaiming(postCode);
      try {
        const r = await fetch("/api/cryo/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postCode, wallet }),
        });
        if (r.ok) {
          const d = (await r.json()) as { payout?: string };
          void playCryoSfx("coin", { volume: 0.9 });
          const text = `+$${d.payout ?? "0.00"} USDC → ${short(wallet)}`;
          setFlash({ id: Date.now(), text });
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(null), 4200);
          void load();
        }
      } catch {
        /* сеть — попробует следующий цикл опроса */
      } finally {
        setClaiming(null);
      }
    },
    [wallet, claiming, load]
  );

  if (!ready) {
    return (
      <div className="nr-glass-deep mx-auto max-w-md animate-pulse rounded-3xl px-8 py-12 text-center text-[0.8rem] font-bold text-[#10161d]/40">
        loading wallet…
      </div>
    );
  }

  /* ---------- нет кошелька: CTA ---------- */
  if (!wallet) {
    return (
      <div className="nr-glass-deep mx-auto max-w-md rounded-3xl px-8 py-12 text-center">
        <p className="text-[1.05rem] font-extrabold tracking-tight">
          connect a wallet to see your pnl
        </p>
        <p className="mx-auto mt-2 max-w-xs text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/55">
          Phantom keeps your prediction positions, payouts and claims in one
          place. MetaMask works too.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="mt-6 rounded-full bg-[#0a0a0a] px-6 py-3 text-[0.8rem] font-extrabold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
        >
          🦇 {connecting ? "connecting…" : "connect wallet"}
        </button>
      </div>
    );
  }

  /* ---------- БД недоступна ---------- */
  if (dbDown) {
    return (
      <div className="nr-glass-deep mx-auto max-w-md rounded-3xl px-8 py-12 text-center">
        <p className="text-[0.95rem] font-extrabold">stats unavailable</p>
        <p className="mt-2 text-[0.78rem] font-semibold text-[#10161d]/55">
          the ledger is unreachable right now — your positions are safe.
          try again in a minute.
        </p>
      </div>
    );
  }

  /* ---------- пусто ---------- */
  if (!loading && !pnl) {
    return (
      <div className="nr-glass-deep mx-auto max-w-md rounded-3xl px-8 py-12 text-center">
        <p className="text-[0.95rem] font-extrabold">no positions yet</p>
        <p className="mx-auto mt-2 max-w-xs text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/55">
          when a clip freezes in the feed, call the ending — your positions
          and payouts will live here.
        </p>
        <a
          href="/feed"
          className="mt-6 inline-block rounded-full bg-[#0a0a0a] px-6 py-3 text-[0.8rem] font-extrabold text-white transition-transform hover:scale-105 active:scale-95"
        >
          ▸ open the feed
        </a>
      </div>
    );
  }

  const s = pnl;
  const netPositive = (s?.net ?? 0) >= 0;

  return (
    <div className="relative">
      {/* кошелёк + обновление */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="nr-glass-deep inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-[0.72rem] font-bold text-[#10161d]/80">
          <span aria-hidden>{provider === "phantom" ? "🦇" : "👻"}</span>
          {short(wallet!)}
          <em className="not-italic text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-[#3d7db8]">
            {provider === "phantom" ? "phantom" : "guest demo"}
          </em>
        </span>
        <button
          onClick={() => void load()}
          className="nr-glass-deep rounded-full px-4 py-2 text-[0.66rem] font-extrabold text-[#10161d]/60 transition-colors hover:text-[#10161d]"
        >
          refresh
        </button>
        {flash && (
          <span
            key={flash.id}
            className="nr-glass-deep rounded-full px-4 py-2 font-mono text-[0.7rem] font-extrabold text-[#1d7a3e] ring-1 ring-[#7fd6a0]"
          >
            {flash.text}
          </span>
        )}
      </div>

      {/* агрегаты */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "staked", v: `$${(s?.staked ?? 0).toFixed(2)}`, c: "#10161d" },
          { k: "claimable", v: `$${(s?.claimable ?? 0).toFixed(2)}`, c: "#b8860b" },
          { k: "claimed", v: `$${(s?.claimed ?? 0).toFixed(2)}`, c: "#1d7a3e" },
          {
            k: "net pnl",
            v: `${netPositive ? "+" : "−"}$${Math.abs(s?.net ?? 0).toFixed(2)}`,
            c: netPositive ? "#1d7a3e" : "#c0392b",
          },
        ].map((x) => (
          <div
            key={x.k}
            className="nr-glass-deep rounded-2xl px-4 py-4 text-center"
          >
            <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.2em] text-[#10161d]/45">
              {x.k}
            </p>
            <p
              className="mt-1.5 font-mono text-[1.05rem] font-extrabold"
              style={{ color: x.c }}
            >
              {x.v}
            </p>
          </div>
        ))}
      </div>

      {/* позиции */}
      <div className="mt-5 space-y-3">
        {s?.items.map((it) => {
          // task 44: подпись исхода — нарративная опция (optionLabel)
          const sideLabel = it.optionLabel ?? (it.side === "yes" ? it.labelYes : it.labelNo);
          const isWin =
            it.status === "resolved" && it.result === it.side && (parseFloat(it.payout || "0") > 0);
          const isLoss = it.status === "resolved" && (it.result !== it.side || !(parseFloat(it.payout || "0") > 0));
          const claimableNow =
            it.status === "resolved" && isWin && !it.claimed;
          return (
            <div
              key={it.postCode}
              className="nr-glass-deep flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-5 py-4"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: it.accent }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.82rem] font-extrabold tracking-tight">
                  {it.question}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#10161d]/50">
                  <span style={{ color: it.accent }}>
                    you called {sideLabel}
                  </span>
                  <span>· ${it.amount} USDC</span>
                  <span>
                    ·{" "}
                    {it.status === "live" ? (
                      <span className="text-[#2b6cb0]">● live</span>
                    ) : it.status === "expired" ? (
                      "expired"
                    ) : isWin ? (
                      <span className="text-[#1d7a3e]">won</span>
                    ) : isLoss ? (
                      <span className="text-[#c0392b]">lost</span>
                    ) : (
                      it.status
                    )}
                  </span>
                  {it.claimed && it.payout && (
                    <span className="text-[#1d7a3e]">· extracted ${it.payout}</span>
                  )}
                </p>
              </div>
              {claimableNow ? (
                <button
                  onClick={() => void claim(it.postCode)}
                  disabled={claiming === it.postCode}
                  className="rounded-full bg-[#0a0a0a] px-4 py-2 text-[0.66rem] font-extrabold text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {claiming === it.postCode
                    ? "extracting…"
                    : `[ extract +$${it.payout} ]`}
                </button>
              ) : (
                <span
                  className={`font-mono text-[0.8rem] font-extrabold ${
                    isWin ? "text-[#1d7a3e]" : isLoss ? "text-[#10161d]/30" : "text-[#10161d]/50"
                  }`}
                >
                  {isWin ? `+$${it.payout}` : isLoss ? "+$0.00" : "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[0.64rem] font-semibold leading-relaxed text-[#10161d]/40">
        pari-mutuel: winners split the pool minus 3% · demo positions are
        marked guest · real claims land in your USDC wallet.
      </p>

      {/* ---------- избранное (task 43) ---------- */}
      {favs.ready && favs.items.length > 0 && (
        <section className="mt-8" aria-label="Favorites">
          <p className="flex items-center justify-between text-[0.6rem] font-extrabold uppercase tracking-[0.22em] text-[#10161d]/45">
            <span>♥ favorites</span>
            <span>{favs.items.length}</span>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {favs.items.map((f) => (
              <a
                key={f.postCode}
                href={`/v/${f.postCode}`}
                className="nr-glass-deep group flex items-center gap-3 rounded-xl px-4 py-3 transition-transform hover:scale-[1.01]"
              >
                <Heart
                  className="h-3.5 w-3.5 shrink-0 text-[#ff4d6d]"
                  fill="currentColor"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.74rem] font-extrabold tracking-tight text-[#10161d]/85 group-hover:text-[#10161d]">
                    {f.title || f.author || `/v/${f.postCode}`}
                  </span>
                  {f.author && f.title && (
                    <span className="block truncate text-[0.6rem] font-bold text-[#10161d]/45">
                      {f.author}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="text-[0.62rem] font-extrabold text-[#3d7db8]/70 transition-transform group-hover:translate-x-0.5"
                >
                  ▸
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
