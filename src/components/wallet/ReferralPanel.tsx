"use client";

import { useState } from "react";
import { Check, Copy, Wallet } from "lucide-react";
import { useWalletSession } from "@/lib/use-wallet";

/* ================================================================
   Реферальная панель на /market: connect MetaMask → пригласительная
   ссылка + правила (20% от суммы оплаченного инвойса).
   ================================================================ */

function short(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export default function ReferralPanel() {
  const { wallet, ready, connecting, error, inviteUrl, connect, disconnect } =
    useWalletSession();
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="nr-pd-shell mx-auto mt-16 max-w-4xl overflow-hidden rounded-[2.5rem] border border-[#d9cdf5] bg-gradient-to-br from-[#f6f2fd] via-white to-[#f9f5ff] p-6 text-[#10161d] shadow-[0_24px_70px_rgba(122,92,224,0.14)] sm:p-10">
      <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#6d4fc2]">
        invite &amp; earn
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
        bring a buyer — keep <span className="text-[#8a68e8]">20%</span>
      </h2>
      <p className="mt-3 max-w-xl text-[0.86rem] font-semibold leading-relaxed text-[#10161d]/60">
        connect your MetaMask, share your personal invite link and get 20% of
        every paid drop through it — card (Stripe) or crypto (2328.io).
        paid out in USDT, no caps, no tricks.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { n: "01", t: "connect", d: "your wallet is your identity and payout address" },
          { n: "02", t: "invite", d: "share the link — attribution lives 90 days" },
          { n: "03", t: "earn", d: "20% of each paid drop — card or crypto — lands on your wallet" },
        ].map((s) => (
          <div
            key={s.n}
            className="rounded-2xl bg-white/80 p-4 ring-1 ring-[#10161d]/8"
          >
            <p className="font-mono text-[0.7rem] font-extrabold text-[#8a68e8]">
              {s.n}
            </p>
            <p className="mt-1 text-[0.8rem] font-extrabold">{s.t}</p>
            <p className="mt-1 text-[0.68rem] font-semibold leading-snug text-[#10161d]/50">
              {s.d}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        {!ready ? (
          <span
            aria-hidden
            className="inline-block h-12 w-40 animate-pulse rounded-full bg-[#10161d]/8"
          />
        ) : wallet ? (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#6d4fc2]/25">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#6d4fc2]/12 px-3 py-1.5 text-[0.68rem] font-extrabold text-[#6d4fc2]">
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                {short(wallet)}
              </span>
              <button
                onClick={disconnect}
                className="text-[0.64rem] font-bold text-[#10161d]/40 transition-colors hover:text-[#10161d]/75"
              >
                disconnect
              </button>
            </div>
            <p className="mt-3 font-mono text-[0.74rem] leading-relaxed text-[#10161d]/80">
              {inviteUrl ?? "…"}
            </p>
            <button
              onClick={copyInvite}
              className="nr-pd-cta mt-3 inline-flex items-center gap-2 rounded-full bg-[#8a68e8] px-6 py-3 text-[0.78rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95"
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
              className="nr-pd-cta inline-flex items-center gap-2 rounded-full bg-[#8a68e8] px-7 py-3.5 text-[0.85rem] font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95 disabled:opacity-60"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              {connecting ? "connecting…" : "connect MetaMask"}
            </button>
            {error && (
              <p className="mt-3 max-w-md rounded-xl bg-[#ff5470]/10 px-3 py-2 text-[0.7rem] font-semibold leading-snug text-[#d63d5e]">
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
            <p className="mt-2.5 text-[0.6rem] font-semibold text-[#10161d]/45">
              wallet sign-in is a cookie session — no seed phrases, no
              transactions, we never ask them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
