"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Play, Share2, Volume2, VolumeX, WifiOff } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { withRef } from "@/lib/shareRef";
import { track } from "@/lib/bet/trackClient";
import BetPanel from "@/components/bet/BetPanel";
import type { ClientRankedPost } from "@/lib/posts";

/* ================================================================
   ClipCard — лёгкая карточка клипа (v4). Два режима:
   - watch: просто видео + автор/заголовок + шеринг. Никаких
     ставок, промптов, Threads-кнопок — чистый бесконечный фид.
   - bet: слепой рафл — метаданных нет (угадай, ИИ или нет),
     активная карточка получает BetPanel (REAL/SYNTH + банк).
   Весь текст — только на тёмных поверхностях. Видео монтируется
   в окне active±1, превью остальных не грузится.
   ================================================================ */

export type ClipMode = "watch" | "bet";

interface ClipCardProps {
  post: ClientRankedPost;
  index: number;
  total: number;
  isActive: boolean;
  shouldLoad: boolean;
  eagerPreload: boolean;
  mode: ClipMode;
  onEnded: (index: number) => void;
}

export default function ClipCard({
  post,
  index,
  total,
  isActive,
  shouldLoad,
  eagerPreload,
  mode,
  onEnded,
}: ClipCardProps) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBet = mode === "bet";

  /* активное видео играет, ушедшее — ставится на паузу и перематывается.
     Состояние paused синхронизируется событиями onPlay/onPause —
     без setState внутри эффекта. */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    }
  }, [isActive, shouldLoad]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const share = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = withRef(`${window.location.origin}/v/${post.utmCode}`);
      track("share_click", post.utmCode);
      try {
        if (navigator.share) {
          await navigator.share({
            title: "no reality.",
            text: isBet ? t.feed.bettable : post.title || "watch this",
            url,
          });
        } else {
          await navigator.clipboard.writeText(url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* отмена — не беда */
      }
    },
    [post.utmCode, post.title, isBet, t]
  );

  return (
    <section
      data-index={index}
      aria-label={isBet ? t.feed.meta : post.title || post.utmCode}
      className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-[#0A0A0F]"
    >
      {/* ---------- видео (монтируется только в окне active±1) ---------- */}
      {shouldLoad && !error && (
        <video
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          playsInline
          preload={isActive || eagerPreload ? "auto" : "metadata"}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onEnded={() => onEnded(index)}
          onError={() => setError(true)}
          onClick={togglePlay}
          className="relative h-full w-full cursor-pointer object-contain"
        />
      )}

      {/* ---------- fallback: битая ссылка ---------- */}
      {shouldLoad && error && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
          <WifiOff className="h-8 w-8 text-white/40" aria-hidden />
          <p className="text-[0.95rem] font-extrabold tracking-tight text-white">
            signal lost
          </p>
          <button
            type="button"
            onClick={() => setError(false)}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[0.72rem] font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            retry
          </button>
        </div>
      )}

      {/* ---------- виньетки для читаемости (тёмные) ---------- */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(to top, rgba(6,5,10,0.72), rgba(6,5,10,0.2) 55%, transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20"
        style={{
          background: "linear-gradient(to bottom, rgba(6,5,10,0.5), transparent)",
        }}
      />

      {/* ---------- пульс паузы ---------- */}
      {paused && isActive && !error && (
        <div
          key={`pulse-${index}`}
          className="nr-anim-pulse pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-[rgba(16,13,22,0.78)] backdrop-blur-md">
            <Play className="h-6 w-6 translate-x-0.5 text-white" />
          </span>
        </div>
      )}

      {/* ---------- верхний ряд ---------- */}
      <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <span
          className="rounded-full border border-white/10 bg-[rgba(16,13,22,0.72)] px-3 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md"
          aria-hidden
        >
          {isBet ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#FF003C] align-middle" />
              {t.feed.bettable}
            </>
          ) : (
            `${String(index + 1).padStart(2, "0")} / ${total}`
          )}
        </span>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute video" : "Mute video"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(16,13,22,0.72)] text-white backdrop-blur-md transition-transform duration-300 hover:scale-[1.06] active:scale-95"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* ---------- нижний ряд: watch → автор/заголовок + шеринг; bet → только шеринг ---------- */}
      <div className="absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3">
        {isBet ? (
          <p className="max-w-[60%] text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white/45">
            {t.feed.blindHint}
          </p>
        ) : (
          <div className="min-w-0 rounded-2xl border border-white/10 bg-[rgba(16,13,22,0.72)] px-4 py-3 backdrop-blur-md">
            <p className="truncate text-[0.82rem] font-extrabold tracking-tight text-white">
              {post.author || "unknown"}
            </p>
            {post.title && (
              <p className="mt-0.5 line-clamp-2 text-[0.74rem] font-semibold leading-snug text-white/65">
                {post.title}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={share}
          aria-label={t.feed.share}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 hover:scale-[1.06] active:scale-95 ${
            copied
              ? "border-[#C8FF00]/40 bg-[#C8FF00]/15 text-[#C8FF00]"
              : "border-white/10 bg-[rgba(16,13,22,0.72)] text-white backdrop-blur-md"
          }`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        </button>
      </div>

      {/* ---------- рафл: панель ставки (только у активной карточки) ---------- */}
      {isBet && <BetPanel clipCode={post.utmCode} isActive={isActive} />}
    </section>
  );
}
