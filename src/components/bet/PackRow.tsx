"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, type AccountView } from "@/hooks/use-account";
import { useLang } from "@/lib/i18n";
import { track } from "@/lib/bet/trackClient";

/**
 * v14 — КНОПКА ПАЧКИ (ТЗ §Касса).
 *
 * 100 EYE = 1 USDT · 300 EYE = 2.5 USDT · 1000 EYE = 7 USDT.
 *
 * Показывается на НУЛЕ баланса после закрытого раунда — НЕ на лендинге.
 * Инвойс создаёт только сервер (POST /api/packs → eye-<accountId>-<sku>-
 * <nonce>); начисляет ТОЛЬКО подписанный вебхук, редирект ничего не
 * начисляет. $NR пачка не минтит и сезонный вес не пишет.
 */

const PACKS = [
  { sku: 100, eye: 100, price: "1" },
  { sku: 300, eye: 300, price: "2.5" },
  { sku: 1000, eye: 1000, price: "7" },
] as const;

export default function PackRow({
  onPaid,
  compact = false,
}: {
  /** колбэк после подтверждённой оплаты (свежий account) */
  onPaid?: (acc: AccountView) => void;
  compact?: boolean;
}) {
  const { t } = useLang();
  const { refresh } = useAccount();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const watchBalance = useCallback(
    (baseline: number) => {
      if (pollRef.current) clearInterval(pollRef.current);
      const started = Date.now();
      pollRef.current = setInterval(async () => {
        if (!aliveRef.current) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        if (Date.now() - started > 120_000) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        try {
          const r = await fetch("/api/me", { cache: "no-store" });
          const d = (await r.json()) as { account?: AccountView };
          if (d.account && d.account.balanceCents > baseline) {
            if (pollRef.current) clearInterval(pollRef.current);
            onPaid?.(d.account);
            refresh();
          }
        } catch {
          /* пропускаем тик */
        }
      }, 2500);
    },
    [onPaid, refresh]
  );

  const buy = useCallback(
    async (sku: number) => {
      setBusy(sku);
      setError("");
      track("topup_open", "", { sku });
      try {
        const me = await fetch("/api/me", { cache: "no-store" })
          .then((r) => r.json() as Promise<{ account?: AccountView }>)
          .catch(() => ({ account: null }));
        const baseline = me.account?.balanceCents ?? 0;

        const r = await fetch("/api/packs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku }),
        });
        const d = (await r.json()) as { payUrl?: string; error?: string };
        if (!r.ok || d.error) {
          setError(d.error === "auth_required" ? t.bet.authNeeded : t.bet.invoiceFailed);
          setBusy(null);
          return;
        }
        setPayUrl(d.payUrl ?? null);
        if (d.payUrl) {
          try {
            window.open(d.payUrl, "_blank", "noopener");
          } catch {
            /* попап заблокирован — ссылка останется под кнопкой */
          }
        }
        watchBalance(baseline);
      } catch {
        setError(t.bet.invoiceFailed);
      } finally {
        setBusy(null);
      }
    },
    [t, watchBalance]
  );

  return (
    <div className={compact ? "w-full" : "w-full max-w-md"}>
      <p
        className="mb-2 text-center text-[0.6rem] font-black uppercase tracking-[0.3em]"
        style={{ color: "rgba(242,237,228,.45)" }}
      >
        {t.bet.packsTitle}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PACKS.map((p) => (
          <button
            key={p.sku}
            type="button"
            disabled={busy !== null}
            onClick={() => buy(p.sku)}
            className="nb-btn rounded-2xl px-2 py-3 text-center transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-50"
            style={{ background: "var(--nb-bone)", color: "var(--nb-night)" }}
          >
            <span className="block text-[0.95rem] font-black leading-none">{p.eye}</span>
            <span className="mt-1 block text-[0.58rem] font-bold uppercase tracking-[0.14em] opacity-70">
              EYE · {p.price} USDT
            </span>
          </button>
        ))}
      </div>
      {payUrl && (
        <a
          href={payUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-[0.66rem] font-bold underline underline-offset-4"
          style={{ color: "rgba(242,237,228,.6)" }}
        >
          {t.bet.openInvoice}
        </a>
      )}
      {error && (
        <p className="mt-2 text-center text-[0.66rem] font-bold" style={{ color: "var(--nb-blood)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
