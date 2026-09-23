"use client";

import { useState } from "react";
import { CreditCard, Loader2, Lock, TriangleAlert } from "lucide-react";
import { formatUsd, type MarketItem } from "@/lib/market/catalog";
import { REFERRAL } from "@/lib/site";

/* ================================================================
   Карточка промпта на витрине /market (task 45).

   Минималистичный стиль платформы продаж промптов: чистая белая
   карточка, обложка, чип категории, тизер, движки, цена и один
   заметный CTA. Оплата — Stripe Checkout (hosted): POST
   /api/market/checkout { code, ref } → редирект на session.url.

   ref — код пригласившего из localStorage (кладётся RefCapture на
   любом ?ref=… переходе); само-приглашение отсекается на сервере.
   ================================================================ */

export default function PromptCard({
  item,
  cardPayEnabled,
}: {
  item: MarketItem;
  cardPayEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = async () => {
    if (busy || !cardPayEnabled) return;
    setBusy(true);
    setError(null);
    try {
      let ref: string | null = null;
      try {
        ref = localStorage.getItem(REFERRAL.storageKey);
      } catch {
        /* приватный режим — атрибуция не критична */
      }
      const r = await fetch("/api/market/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: item.code, ref: ref || undefined }),
      });
      const d = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !d.url) {
        throw new Error(d.error || "checkout failed");
      }
      window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout failed");
      setBusy(false);
    }
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-[#10161d]/8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(122,92,224,0.16)]">
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
          className="absolute inset-0 bg-gradient-to-t from-[#10161d]/35 via-transparent to-transparent"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-[#10161d]/75 backdrop-blur">
          {item.category}
        </span>
        {item.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-[#8a68e8] px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-white shadow-sm">
            {item.badge}
          </span>
        )}
      </div>

      {/* ---------- тело ---------- */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-[1.15rem] font-extrabold tracking-tight text-[#10161d]">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-[0.78rem] font-semibold leading-relaxed text-[#10161d]/55">
          {item.teaser}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.engines.map((eng) => (
            <span
              key={eng}
              className="rounded-full bg-[#f4f1fb] px-2.5 py-1 font-mono text-[0.6rem] font-bold text-[#6d4fc2]"
            >
              {eng}
            </span>
          ))}
        </div>

        {/* ---------- CTA ---------- */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[1.25rem] font-extrabold tracking-tight text-[#10161d]">
            {formatUsd(item.priceCents)}
            <span className="ml-1 align-middle text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#10161d]/35">
              card
            </span>
          </p>
          {cardPayEnabled ? (
            <button
              onClick={buy}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-[#10161d] px-5 py-3 text-[0.78rem] font-extrabold text-white transition-all duration-300 hover:scale-[1.04] hover:bg-[#8a68e8] active:scale-95 disabled:opacity-60"
              aria-label={`buy ${item.title} for ${formatUsd(item.priceCents)}`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CreditCard className="h-4 w-4" aria-hidden />
              )}
              {busy ? "opening checkout…" : "buy prompt"}
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-2 rounded-full bg-[#10161d]/6 px-5 py-3 text-[0.74rem] font-extrabold text-[#10161d]/40"
              title="STRIPE_SECRET_KEY is not configured"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
              card checkout soon
            </span>
          )}
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#ff5470]/10 px-3 py-2 text-[0.68rem] font-semibold leading-snug text-[#d63d5e]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
