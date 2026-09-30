"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * use-account (v10): аккаунт ТОЛЬКО у авторизованных.
 *
 * GET /api/me отвечает { authed, account }:
 *  - authed=true  → аккаунт с балансом (ставки/награды открыты);
 *  - authed=false → гость (account=null; легаси-гость видит свой старый
 *    баланс, но играет только после регистрации).
 * Никаких auto-create: открытые страницы не плодят ghost-аккаунтов.
 */
export interface AccountView {
  accountId: string;
  balanceCents: number;
  passTier: number;
  isPass: boolean;
  /** email google/magic/пароль-сессии — null у гостя */
  email?: string | null;
  /** v11: имя Telegram-аккаунта (displayName/@username) */
  name?: string | null;
  streakDays: number;
  dailyAvailable: boolean;
}

export function useAccount() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<AccountView | null> => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) {
        setAuthed(false);
        setAccount(null);
        return null;
      }
      const d = (await r.json()) as { authed?: boolean; account?: AccountView | null };
      setAuthed(Boolean(d.authed));
      if (d.authed && d.account) {
        setAccount(d.account);
        return d.account;
      }
      setAccount(null);
      return null;
    } catch {
      setAuthed(false);
      setAccount(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    /* rAF: setState-in-effect lint-паттерн — отложенный кадр */
    const id = requestAnimationFrame(() => {
      void refresh().finally(() => {
        if (alive) setReady(true);
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [refresh]);

  /** daily-бонус NR PASS (идемпотентно, раз в UTC-день) */
  const claimDaily = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/me/daily", { method: "POST" });
      if (!r.ok) return false;
      const d = (await r.json()) as { credited?: boolean; account?: AccountView };
      if (d.account) setAccount(d.account);
      return Boolean(d.credited);
    } catch {
      return false;
    }
  }, []);

  return { account, authed, ready, refresh, setAccount, claimDaily };
}
