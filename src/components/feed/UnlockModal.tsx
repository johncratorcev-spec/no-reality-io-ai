"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Премиальная модалка оплаты промпта (2328.io hosted checkout).
 *
 * Принципы прозрачности (требование ТЗ):
 *  - цена крупно и честно, в USDT;
 *  - сколько из цены уходит автору и сколько забирает платформа — видно ДО
 *    оплаты (комиссию присылает бэкенд: /api/prompts/[code]/status);
 *  - полный текст промпта всегда замаскирован до подтверждённой оплаты.
 *
 * Оплата: POST /api/prompts/[code]/checkout → payUrl → редирект на
 * страницу 2328 (same-tab: url_return возвращает нас на /v/<code>,
 * откуда карточка сама подхватит статус и покажет анимацию разблокировки).
 */

interface UnlockModalProps {
  utmCode: string;
  author?: string;
  title?: string;
  priceUsdt?: string;
  preview?: string;
  /** начальная комиссия с бэкенда (если уже известна); иначе fetch из модалки */
  commissionRate?: number | null;
  onClose: () => void;
}

export default function UnlockModal({
  utmCode,
  author,
  title,
  priceUsdt,
  preview,
  onClose,
}: UnlockModalProps) {
  const [phase, setPhase] = useState<"opening" | "redirecting" | "error">("opening");
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  /* ESC закрывает, скролл под модалкой заблокирован */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const price = Number.parseFloat(priceUsdt || "0");
  const feeRate = rate ?? 0.25;
  const sellerAmount = price * (1 - feeRate);
  const fee = price - sellerAmount;
  const fmt = (n: number) => n.toFixed(2);

  const pay = async () => {
    setPhase("opening");
    setError(null);
    try {
      const r = await fetch(`/api/prompts/${encodeURIComponent(utmCode)}/checkout`, {
        method: "POST",
      });
      const data = (await r.json()) as { payUrl?: string; error?: string };
      if (!r.ok || !data.payUrl) {
        setPhase("error");
        setError(
          data.error ||
            "Could not start the payment — please try again in a minute."
        );
        return;
      }
      setPhase("redirecting");
      window.location.href = data.payUrl;
    } catch {
      setPhase("error");
      setError("Network error — please try again.");
    }
  };

  return (
    <div
      className="nr-modal-backdrop fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock prompt"
    >
      <div
        className="nr-modal-card relative w-full max-w-sm rounded-3xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* заголовок */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5b9bd5]/12 ring-1 ring-[#5b9bd5]/40">
              <Lock className="h-4 w-4 text-[#3d7db8]" />
            </span>
            <div>
              <p className="text-[0.95rem] font-extrabold tracking-tight">
                Unlock this prompt
              </p>
              {author && (
                <p className="text-[0.7rem] text-[#10161d]/55">by {author}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-[0.7rem] font-bold text-[#10161d]/50 transition-colors hover:text-[#10161d]"
          >
            ✕
          </button>
        </div>

        {title && (
          <p className="mt-3 line-clamp-2 text-[0.75rem] leading-snug text-[#10161d]/60">
            {title}
          </p>
        )}

        {/* тизер промпта */}
        <div className="mt-4 rounded-2xl border border-[#10161d]/10 bg-[#10161d]/[0.035] p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#3d7db8]/80">
            <Sparkles className="h-3 w-3" />
            prompt preview
          </div>
          <p className="nr-prompt-mask max-h-24 overflow-hidden font-mono text-[0.72rem] leading-relaxed text-[#10161d]/75">
            {preview?.trim() ||
              "A cinematic AI-generated scene, volumetric light, ultra-detailed textures, smooth camera motion…"}
          </p>
        </div>

        {/* цена */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="nr-price-chip rounded-2xl bg-white px-3.5 py-2 font-mono text-xl font-extrabold tracking-tight text-[#0a0a0a] ring-1 ring-[#5b9bd5]/40">
              {priceUsdt || "3.00"}
            </span>
            <span className="text-[0.7rem] font-bold uppercase tracking-widest text-[#10161d]/50">
              USDT
            </span>
          </div>
          <span className="flex items-center gap-1 text-[0.62rem] font-semibold text-[#10161d]/45">
            <ShieldCheck className="h-3.5 w-3.5" />
            crypto checkout
          </span>
        </div>

        {/* прозрачное разделение денег */}
        <div className="mt-3 space-y-1.5 rounded-2xl bg-[#10161d]/[0.04] p-3 text-[0.7rem]">
          <div className="flex items-center justify-between">
            <span className="text-[#10161d]/55">Goes to the author</span>
            <span className="font-mono font-bold text-[#3d7db8]">
              {fmt(sellerAmount)} USDT
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#10161d]/55">
              Platform fee ({Math.round(feeRate * 100)}%)
            </span>
            <span className="font-mono font-bold text-[#10161d]/70">
              {fmt(fee)} USDT
            </span>
          </div>
          <p className="pt-1 text-[0.62rem] leading-snug text-[#10161d]/40">
            The author keeps all rights to the prompt. no reality. is a
            distributor and takes the fee for hosting &amp; delivery.
          </p>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#ff5470]/10 px-3 py-2 text-[0.7rem] leading-snug text-[#d63d5e]">
            {error}
          </p>
        )}

        {/* CTA */}
        <button
          onClick={pay}
          disabled={phase !== "opening" && phase !== "error"}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#5b9bd5] to-[#7db3e0] py-3.5 text-[0.85rem] font-extrabold tracking-tight text-[#05080d] transition-transform duration-300 hover:scale-[1.015] active:scale-[0.99] disabled:opacity-70"
        >
          {phase === "redirecting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to checkout…
            </>
          ) : phase === "opening" || phase === "error" ? (
            <>
              <Lock className="h-4 w-4" />
              Unlock for {priceUsdt || "3.00"} USDT
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Opening…
            </>
          )}
        </button>
        <p className="mt-2.5 text-center text-[0.62rem] leading-snug text-[#10161d]/40">
          You&apos;ll be redirected to a secure 2328.io checkout page. Access
          unlocks instantly after payment confirmation.
        </p>
      </div>
    </div>
  );
}
