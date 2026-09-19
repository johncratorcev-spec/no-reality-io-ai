"use client";

import { useState } from "react";
import { useWalletSession } from "@/lib/use-wallet";

/* ================================================================
   Кнопка-кошелёк в шапке: connect MetaMask → сессия (cookie 30 дней)
   → в выпадашке пригласительная ссылка (реферальная программа).

   Без MetaMask — мягкая подсказка с ссылкой на metamask.io.
   ================================================================ */

function short(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export default function WalletButton() {
  const { wallet, ready, connecting, error, inviteUrl, connect, disconnect } =
    useWalletSession();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

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
          title="wallet session"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#6d4fc2]" />
          {short(wallet)}
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ff] px-3 py-1.5 text-[0.66rem] font-extrabold tracking-tight text-[#6d4fc2] transition-all duration-300 hover:scale-105 hover:bg-[#eae4ff] active:scale-95 disabled:opacity-60"
          title="sign in with MetaMask"
        >
          <span aria-hidden>🦊</span>
          {connecting ? "connecting…" : "connect"}
        </button>
      )}

      {error && (
        <p className="nr-glass-deep absolute right-0 top-[calc(100%+6px)] z-50 w-56 rounded-xl px-3 py-2 text-[0.62rem] font-semibold leading-snug text-[#c26d3f]">
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

      {wallet && open && (
        <div className="nr-glass-deep absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl p-4 text-[#10161d]">
          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#6d4fc2]">
            your invite link
          </p>
          <p className="mt-1.5 font-mono text-[0.66rem] leading-relaxed text-[#10161d]/70">
            {inviteUrl ?? "…"}
          </p>
          <p className="mt-2 text-[0.6rem] font-semibold leading-snug text-[#10161d]/50">
            anyone who pays through it earns you{" "}
            <span className="text-[#6d4fc2]">20%</span> of the invoice.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={copyInvite}
              className="rounded-full bg-[#10161d]/5 px-3.5 py-1.5 text-[0.66rem] font-extrabold text-[#10161d] ring-1 ring-[#10161d]/15 transition-colors hover:bg-[#10161d]/10"
            >
              {copied ? "copied ✓" : "copy invite"}
            </button>
            <button
              onClick={disconnect}
              className="text-[0.62rem] font-bold text-[#10161d]/40 transition-colors hover:text-[#10161d]/75"
            >
              disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
