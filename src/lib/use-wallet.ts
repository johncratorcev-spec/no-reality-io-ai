"use client";

import { useCallback, useEffect, useState } from "react";
import { REFERRAL } from "@/lib/site";
import { signInWithPhantom, phantomProvider } from "@/lib/cryo/wallet";

/* ================================================================
   Сессия кошелька на сайте (task 42): Phantom (Solana) — основной
   провайдер, MetaMask (EVM) — фолбэк. Один хук — все потребители:
   кнопка в шапке/бургере, карточки промптов, предикты.

   Phantom: connect → personal sign (ed25519) → cookie nr_phantom.
   MetaMask: address → cookie nr_wallet (+ реферальный код).
   ================================================================ */

export interface WalletSession {
  wallet: string | null;
  provider: "phantom" | "metamask" | null;
  refCode: string | null;
  inviteUrl: string | null;
  ready: boolean;
  connecting: boolean;
  error: string | null;
}

interface SessionResponse {
  wallet: string | null;
  provider?: string;
  refCode?: string | null;
  inviteUrl?: string | null;
  error?: string;
}

/** EIP-1193 провайдер, который инжектит MetaMask */
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getEvmProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

const initialState: WalletSession = {
  wallet: null,
  provider: null,
  refCode: null,
  inviteUrl: null,
  ready: false,
  connecting: false,
  error: null,
};

export function useWalletSession() {
  const [state, setState] = useState<WalletSession>(initialState);

  const refresh = useCallback(async () => {
    try {
      const [ph, mm] = await Promise.all([
        fetch("/api/auth/phantom", { cache: "no-store" })
          .then((r) => r.json() as Promise<SessionResponse>)
          .catch(() => ({ wallet: null })),
        fetch("/api/auth/metamask", { cache: "no-store" })
          .then((r) => r.json() as Promise<SessionResponse>)
          .catch(() => ({ wallet: null })),
      ]);
      if (ph.wallet) {
        setState((s) => ({
          ...s,
          wallet: ph.wallet,
          provider: "phantom",
          refCode: null,
          inviteUrl: null,
          ready: true,
        }));
        return;
      }
      if (mm.wallet) {
        setState((s) => ({
          ...s,
          wallet: mm.wallet,
          provider: "metamask",
          refCode: mm.refCode ?? null,
          inviteUrl: mm.inviteUrl ?? null,
          ready: true,
        }));
        return;
      }
      setState((s) => ({ ...s, wallet: null, provider: null, ready: true }));
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));

    /* 1) Phantom (Solana) — основной путь: подпись + cookie */
    if (phantomProvider()) {
      try {
        const address = await signInWithPhantom();
        setState((s) => ({
          ...s,
          wallet: address,
          provider: "phantom",
          refCode: null,
          inviteUrl: null,
          connecting: false,
        }));
        return;
      } catch (e) {
        setState((s) => ({
          ...s,
          connecting: false,
          error: e instanceof Error ? e.message : "Phantom rejected",
        }));
        return;
      }
    }

    /* 2) MetaMask (EVM) — фолбэк */
    const provider = getEvmProvider();
    if (!provider) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: "No wallet found — install phantom.app or metamask.io",
      }));
      return;
    }
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("no account");
      const r = await fetch("/api/auth/metamask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const d = (await r.json()) as SessionResponse;
      if (!r.ok || !d.wallet) {
        throw new Error(d.error || "Sign-in failed");
      }
      setState((s) => ({
        ...s,
        wallet: d.wallet,
        provider: "metamask",
        refCode: d.refCode ?? null,
        inviteUrl: d.inviteUrl ?? null,
        connecting: false,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        connecting: false,
        error:
          e instanceof Error && e.message !== "no account"
            ? e.message
            : "Wallet request rejected",
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await Promise.all([
        fetch("/api/auth/phantom", { method: "DELETE" }),
        fetch("/api/auth/metamask", { method: "DELETE" }),
      ]);
    } catch {
      /* сброс cookie на сервере best-effort */
    }
    setState((s) => ({
      ...s,
      wallet: null,
      provider: null,
      refCode: null,
      inviteUrl: null,
      error: null,
    }));
  }, []);

  /** код для шеринга: свой, если кошелёк подключён, иначе ?ref= из localStorage */
  const shareRefCode = useCallback((): string | null => {
    if (state.refCode) return state.refCode;
    try {
      const saved = localStorage.getItem(REFERRAL.storageKey);
      return saved && /^r[a-z0-9]{5,11}$/.test(saved) ? saved : null;
    } catch {
      return null;
    }
  }, [state.refCode]);

  return { ...state, connect, disconnect, refresh, shareRefCode };
}
