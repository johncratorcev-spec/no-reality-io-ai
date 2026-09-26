"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Flame, Loader2, Lock, TriangleAlert, Unlock } from "lucide-react";
import { formatUsd, type MarketItem } from "@/lib/market/catalog";
import { REFERRAL } from "@/lib/site";
import { track } from "@/lib/bet/trackClient";

/* ================================================================
   Карточка промпта на витрине /market (v5 — crypto-only).

   Оплата — ТОЛЬКО крипто через 2328.io: POST
   /api/prompts/[code]/checkout { code, ref } → редирект на hosted
   checkout 2328 → возврат на /market/thanks?code=… → полный текст
   раскрывается здесь же по поллингу /api/prompts/[code]/status.

   Scarcity: честный счётчик оплаченных покупок (soldTotal) с сервера.
   Unlock UX: карточка помнит возврат с оплаты (?unlock=<code>) и
   показывает промпт + копирование прямо в сетке витрины.

   ref — код пригласившего из localStorage (кладётся RefCapture на
   любом ?ref=… переходе); само-приглашение отсекается на сервере.
   ================================================================ */

interface StatusData {
  unlocked: boolean;
  soldTotal: number;
  prompt?: string | null;
  paymentsConfigured?: boolean;
}

const STATUS_TTL_MS = 20_000;

export default function PromptCard({ item }: { item: MarketItem }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = useCallback(
    async (force = false) => {
      if (!force && Date.now() - fetchedAt.current < STATUS_TTL_MS) return;
      fetchedAt.current = Date.now();
      try {
        const r = await fetch(`/api/prompts/${encodeURIComponent(item.code)}/status`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as StatusData;
        setStatus(d);
      } catch {
        /* не критично — покажем карточку без счётчика */
      }
    },
    [item.code]
  );

  useEffect(() => {
    void loadStatus(true);
    // возврат с 2328: /market?unlock=<code> — тянуть статус активнее
    const wanted = new URLSearchParams(window.location.search).get("unlock");
    if (wanted !== item.code) return;
    let n = 0;
    const tick = () => {
      n++;
      void loadStatus(true);
      if (n < 20) timer.current = setTimeout(tick, 2500);
    };
    timer.current = setTimeout(tick, 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [item.code, loadStatus]);

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    track("prompt_upsell_click", item.code, { source: "market" });
    try {
      let ref: string | null = null;
      try {
        ref = localStorage.getItem(REFERRAL.storageKey);
      } catch {
        /* приватный режим — атрибуция не критична */
      }
      const r = await fetch(`/api/prompts/${encodeURIComponent(item.code)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref || undefined }),
      });
      const d = (await r.json()) as { payUrl?: string; error?: string };
      if (!r.ok || !d.payUrl) {
        throw new Error(d.error || "checkout failed");
      }
      window.location.href = d.payUrl; // hosted checkout 2328.io
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout failed");
      setBusy(false);
    }
  };

  const copyPrompt = async () => {
    if (!status?.prompt) return;
    try {
      await navigator.clipboard.writeText(status.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard запрещён */
    }
  };

  const unlocked = Boolean(status?.unlocked);

  return (
    <article
      id={`prompt-${item.code}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgba(16,13,22,0.72)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1"
    >
      {/* ---------- обложка ---------- */}
      <div
        className="relative aspect-[16/10] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${item.gradient[0]}, ${item.gradient[1]} 52%, ${item.gradient[2]})`,
        }}
      >
        {/* сознательный <img>: обложки статичны и ленивы, next/image здесь не нужен */}
        <img
          src={item.cover}
          alt={item.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          onError={(e) => {
            // обложка не отвязалась — остаёмся на градиенте
            (e.currentTarget as HTMLImageElement).style.opacity = "0";
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F]/70 via-transparent to-transparent"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[rgba(10,10,15,0.8)] px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-white/80 backdrop-blur">
          {item.category}
        </span>
        {item.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-[#FF003C] px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-sm">
            {item.badge}
          </span>
        )}
      </div>

      {/* ---------- тело ---------- */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-[1.15rem] font-extrabold tracking-tight text-white">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-[0.78rem] font-semibold leading-relaxed text-white/55">
          {item.teaser}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {item.engines.map((eng) => (
            <span
              key={eng}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[0.6rem] font-bold text-white/70"
            >
              {eng}
            </span>
          ))}
        </div>

        {/* ---------- scarcity: честный счётчик покупок ---------- */}
        {status && status.soldTotal > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[0.64rem] font-black uppercase tracking-[0.14em] text-[#FFD400]">
            <Flame className="h-3 w-3" aria-hidden />
            {status.soldTotal} раз куплен · счётчик растёт
          </p>
        )}

        {/* ---------- unlock: полный текст прямо в карточке ---------- */}
        {unlocked && (
          <div className="mt-4 rounded-2xl border border-[#C8FF00]/30 bg-[#C8FF00]/8 p-3">
            <p className="inline-flex items-center gap-1.5 text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#C8FF00]">
              <Unlock className="h-3 w-3" aria-hidden />
              промпт разблокирован
            </p>
            <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-[0.68rem] leading-relaxed text-white/85 [scrollbar-width:thin]">
              {status?.prompt}
            </div>
            <button
              onClick={copyPrompt}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.66rem] font-bold text-white/80 transition-colors hover:bg-white/10"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "скопировано" : "copy prompt"}
            </button>
          </div>
        )}

        {/* ---------- CTA ---------- */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[1.25rem] font-extrabold tracking-tight text-white">
            {formatUsd(item.priceCents)}
            <span className="ml-1 align-middle text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/35">
              usdt
            </span>
          </p>
          {unlocked ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[#C8FF00]/15 px-5 py-3 text-[0.74rem] font-extrabold text-[#C8FF00]">
              <Check className="h-4 w-4" aria-hidden />
              твой промпт
            </span>
          ) : (
            <button
              onClick={buy}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[0.78rem] font-extrabold text-[#0A0A0F] transition-all duration-300 hover:scale-[1.04] hover:bg-[#FF003C] hover:text-white active:scale-95 disabled:opacity-60"
              aria-label={`buy ${item.title} for ${formatUsd(item.priceCents)} in USDT`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Lock className="h-4 w-4" aria-hidden />
              )}
              {busy ? "открываем чекаут…" : "buy · crypto"}
            </button>
          )}
        </div>

        <p className="mt-2 text-[0.6rem] font-semibold text-white/35">
          крипто-инвойс 2328.io · USDT · мгновенная разблокировка
        </p>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#FF003C]/12 px-3 py-2 text-[0.68rem] font-semibold leading-snug text-[#FF5C7A]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
