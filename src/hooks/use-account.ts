"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * use-account (v6): мгновенный аккаунт + внутренний баланс.
 * Первый GET /api/me сам создаёт аккаунт (welcome-бонус) и ставит
 * httpOnly-cookie nr_uid — ноль форм, порог входа = 0.
 */
export interface AccountView {
  accountId: string;
  balanceCents: number;
  passTier: number;
  isPass: boolean;
  /** email google/magic-сессии — null у мгновенного гостя (v7.1) */
  email?: string | null;
  streakDays: number;
  dailyAvailable: boolean;
}

export function useAccount() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async (): Promise<AccountView | null> => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      if (!r.ok) return null;
      const d = (await r.json()) as { account?: AccountView };
      if (d.account) {
        setAccount(d.account);
        return d.account;
      }
      return null;
    } catch {
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

  return { account, ready, refresh, setAccount, claimDaily };
}
