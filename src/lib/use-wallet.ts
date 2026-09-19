"use client";

import { useCallback, useEffect, useState } from "react";
import { REFERRAL } from "@/lib/site";

/* ================================================================
   Сессия MetaMask (MVP): подключение кошелька + пригласительный код.

   Один хук — два потребителя: кнопка в Header и карточки промптов
   (копирование ссылки на карточку со своим ?ref=).
   ================================================================ */

export interface WalletSession {
  wallet: string | null;
  refCode: string | null;
  inviteUrl: string | null;
  ready: boolean;
  connecting: boolean;
  error: string | null;
}

interface SessionResponse {
  wallet: string | null;
  refCode?: string | null;
  inviteUrl?: string | null;
  error?: string;
}

/** EIP-1193 провайдер, который инжектит MetaMask */
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

export function useWalletSession() {
  const [state, setState] = useState<WalletSession>({
    wallet: null,
    refCode: null,
    inviteUrl: null,
    ready: false,
    connecting: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/metamask", { cache: "no-store" });
      const d = (await r.json()) as SessionResponse;
      setState((s) => ({
        ...s,
        wallet: d.wallet ?? null,
        refCode: d.refCode ?? null,
        inviteUrl: d.inviteUrl ?? null,
        ready: true,
      }));
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({
        ...s,
        error: "MetaMask not found — install metamask.io to sign in",
      }));
      return;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
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
      await fetch("/api/auth/metamask", { method: "DELETE" });
    } catch {
      /* сброс cookie на сервере best-effort */
    }
    setState((s) => ({
      ...s,
      wallet: null,
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
