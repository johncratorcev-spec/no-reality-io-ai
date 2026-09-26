"use client";

import { useEffect, useState } from "react";

/* ================================================================
   Charity drive helpers: тикающий обратный отсчёт + форматтеры.
   Один источник правды для чипа-таймера и модалки акции.
   ================================================================ */

/**
 * useCountdown — возвращает оставшееся время до момента opening.
 * `ready` = false до первого тика на клиенте (SSR-безопасность:
 * рендерим плейсхолдер "--:--:--", чтобы не ловить hydration mismatch).
 */
export function useCountdown(openingIso: string) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    /* rAF: setState не синхронен с телом эффекта (react-hooks rules) */
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(t);
    };
  }, []);

  const msLeft =
    now === null ? null : Math.max(0, new Date(openingIso).getTime() - now);
  return {
    ready: now !== null,
    msLeft,
    /** true, когда донат уже открыт (время вышло) */
    opened: msLeft !== null && msLeft <= 0,
    /** true, пока донат ещё закрыт (идёт отсчёт) */
    locked: msLeft !== null && msLeft > 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 23:59:59 — часы суммарные (без суток), кампанный вид. */
export function formatHMS(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Разбивка для больших блоков в модалке. */
export function splitHMS(ms: number): { h: string; m: string; s: string } {
  const total = Math.floor(ms / 1000);
  return {
    h: pad(Math.floor(total / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  };
}
