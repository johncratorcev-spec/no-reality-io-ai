"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, TrendingUp, Users, Wallet } from "lucide-react";
import { useWalletSession } from "@/lib/use-wallet";

/* ================================================================
   Реферальная панель (v5): тёмная поверхность, прогресс заработка
   и видимая ссылка. 20% с рейка приведённых ставок И 20% с суммы
   оплаченных промптов — единый реестр ReferralEvent.
   ================================================================ */

interface RefData {
  connected: boolean;
  code: string | null;
  invitedPaid?: number;
  earnedUsdt?: string;
  recent?: Array<{ orderId: string; amountUsdt: string | null; payoutUsdt: string | null; at: string }>;
}

function short(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export default function ReferralPanel() {
  const { wallet, ready, connecting, error, connect, disconnect } = useWalletSession();
  const [copied, setCopied] = useState(false);
  const [ref, setRef] = useState<RefData | null>(null);

  const loadRef = useCallback(async () => {
    try {
      const r = await fetch("/api/me/referrals", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as RefData;
      setRef(d);
    } catch {
      /* не критично */
    }
  }, []);

  useEffect(() => {
    if (!wallet) return;
    const raf = requestAnimationFrame(() => {
      void loadRef();
    });
    return () => cancelAnimationFrame(raf);
  }, [wallet, loadRef]);

  const inviteUrl = ref?.code
    ? `${typeof window !== "undefined" ? window.location.origin : "https://no-reality.fun"}/bet?ref=${ref.code}`
    : null;

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён */
    }
  };

  const earned = Number(ref?.earnedUsdt ?? 0);
  /* прогресс: $10 заработка = 100% шкалы (визуальная цель, не потолок выплат) */
  const progress = Math.min(100, Math.round((earned / 10) * 100));

  return (
    <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[rgba(16,13,22,0.72)] p-6 backdrop-blur-md sm:p-10">
      <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#FF5C7A]">
        invite &amp; earn
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        bring an eye — keep <span className="text-[#C8FF00]">20%</span>
      </h2>
      <p className="mt-3 max-w-xl text-[0.86rem] font-semibold leading-relaxed text-white/55">
        connect your wallet, share your personal invite link and get 20% of
        every paid invoice through it — raffle stakes AND prompt drops. paid
        out in USDT, no caps, no tricks.
      </p>

      {/* ---------- прогресс заработка ---------- */}
      {wallet && ref && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,10,15,0.6)] p-4">
            <p className="inline-flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-[0.18em] text-white/45">
              <TrendingUp className="h-3 w-3" aria-hidden />
              заработано всего
            </p>
            <p className="mt-2 text-[1.7rem] font-black leading-none text-[#C8FF00]">
              ${ref.earnedUsdt ?? "0.00"}
            </p>
            {/* шкала прогресса: $10 = 100% */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${progress}%`, background: "var(--nb-poison, #C8FF00)" }}
              />
            </div>
            <p className="mt-1.5 text-[0.6rem] font-bold text-white/35">
              {progress >= 100 ? "шкала закрыта — дальше без предела" : "цена круга: каждые $10 — новая шкала"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[rgba(10,10,15,0.6)] p-4">
            <p className="inline-flex items-center gap-1.5 text-[0.6rem] font-black uppercase tracking-[0.18em] text-white/45">
              <Users className="h-3 w-3" aria-hidden />
              оплаченных приведений
            </p>
            <p className="mt-2 text-[1.7rem] font-black leading-none text-white">
              {ref.invitedPaid ?? 0}
            </p>
            <p className="mt-3 text-[0.62rem] font-semibold leading-relaxed text-white/40">
              {ref.recent && ref.recent.length > 0
                ? `последнее: ${ref.recent[0].payoutUsdt ?? "0"} USDT · ${new Date(ref.recent[0].at).toLocaleDateString("ru-RU")}`
                : "первый оплативший по твоей ссылке появится здесь"}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { n: "01", t: "connect", d: "your wallet is your identity and payout address" },
          { n: "02", t: "invite", d: "share the link — attribution lives 90 days" },
          { n: "03", t: "earn", d: "20% of each paid invoice lands on your wallet" },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl border border-white/10 bg-[rgba(10,10,15,0.55)] p-4"
          >
            <p className="font-mono text-[0.7rem] font-extrabold text-[#FF5C7A]">
              {s.n}
            </p>
            <p className="mt-1 text-[0.8rem] font-extrabold text-white">{s.t}</p>
            <p className="mt-1 text-[0.68rem] font-semibold leading-snug text-white/50">
              {s.d}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        {!ready ? (
          <span
            aria-hidden
            className="inline-block h-12 w-40 animate-pulse rounded-full bg-white/8"
          />
        ) : wallet ? (
          <div className="rounded-2xl border border-white/12 bg-[rgba(10,10,15,0.6)] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#C8FF00]/12 px-3 py-1.5 text-[0.68rem] font-extrabold text-[#C8FF00]">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {short(wallet)}
              </span>
              <button
                onClick={disconnect}
                className="text-[0.64rem] font-bold text-white/40 transition-colors hover:text-white/75"
              >
                disconnect
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-[0.74rem] leading-relaxed text-white/80">
              {inviteUrl ?? "…"}
            </p>
            <button
              onClick={copyInvite}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[0.78rem] font-extrabold text-[#0A0A0F] transition-transform duration-300 hover:scale-[1.04] active:scale-95"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "invite copied — go spread it" : "copy invite link"}
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={connect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-full bg-[#FF003C] px-7 py-3.5 text-[0.85rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95 disabled:opacity-60"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              {connecting ? "connecting…" : "connect wallet"}
            </button>
            {error && (
              <p className="mt-3 max-w-md rounded-xl bg-[#FF003C]/12 px-3 py-2 text-[0.7rem] font-semibold leading-snug text-[#FF5C7A]">
                {error.includes("MetaMask not found") ? (
                  <>
                    MetaMask not found —{" "}
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      install it here
                    </a>
                    .
                  </>
                ) : (
                  error
                )}
              </p>
            )}
            <p className="mt-2.5 text-[0.6rem] font-semibold text-white/40">
              wallet sign-in is a cookie session — no seed phrases, no
              transactions, we never ask them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
