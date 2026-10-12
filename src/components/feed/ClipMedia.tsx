"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Volume2, VolumeX } from "lucide-react";

/* ================================================================
   v20 — медиа-типы ленты (ТЗ §10):
   • CarouselSlide — фото-карусель Threads: свайп/стрелки/точки,
     ПОРЯДОК ФОТО как в посте (media.photos — проксированные URL),
     авто-переход 4.2с в активной карточке; конец → onEnded (лента
     листается дальше). Без библиотек: pointer events + CSS.
   • AudioClip — голосовая по прямой ссылке: НАТИВНЫЙ <audio controls>
     (плей/пауза/скраб браузера), обложка — стилизованная карточка.
   Всё на transform/opacity, prefers-reduced-motion уважается.
   ================================================================ */

const SLIDE_DWELL_MS = 4200;
const SWIPE_THRESHOLD = 48;

export function CarouselSlide({
  clipId,
  photos,
  active,
  muted,
  onEnded,
}: {
  clipId: string;
  photos: string[];
  active: boolean;
  muted: boolean;
  onEnded: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const dragX = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const idxRef = useRef(0);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  /* сброс на первый слайд, когда карточка ушла из фокуса —
     корректировка состояния во время рендера (без эффекта) */
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setIdx(0);
  }

  const go = useCallback(
    (next: number) => {
      if (photos.length === 0) return;
      if (next < 0) next = 0;
      if (next > photos.length - 1) {
        onEnded(); // доиграли — лента листает к следующей карточке
        return;
      }
      setIdx(next);
    },
    [photos.length, onEnded]
  );

  /* авто-переход слайдов, пока карточка активна */
  useEffect(() => {
    if (!active || photos.length <= 1) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => {
      go(idxRef.current + 1);
    }, SLIDE_DWELL_MS);
    return () => clearInterval(t);
  }, [active, photos.length, go]);

  /* сброс на первый слайд, когда карточка ушла из фокуса */
  if (photos.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#0A0A0F] text-center">
        <ImageIcon className="h-8 w-8 text-white/30" aria-hidden />
        <p className="text-[0.78rem] font-bold text-white/45">carousel is empty</p>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#0A0A0F]"
      role="group"
      aria-roledescription="carousel"
      aria-label={`photo ${idx + 1} of ${photos.length}`}
      onPointerDown={(e) => {
        dragX.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (dragX.current === null) return;
        setDrag(e.clientX - dragX.current);
      }}
      onPointerUp={() => {
        if (dragX.current === null) return;
        const d = drag;
        dragX.current = null;
        setDrag(0);
        if (d <= -SWIPE_THRESHOLD) go(idxRef.current + 1);
        else if (d >= SWIPE_THRESHOLD) go(idxRef.current - 1);
      }}
      onPointerLeave={() => {
        dragX.current = null;
        setDrag(0);
      }}
    >
      {photos.map((src, i) => (
        <img
          key={`${clipId}-${i}`}
          src={failed[i] ? "" : src}
          alt={`slide ${i + 1}`}
          draggable={false}
          onError={() => setFailed((f) => ({ ...f, [i]: true }))}
          className="absolute inset-0 h-full w-full select-none object-contain transition-opacity duration-300"
          style={{
            opacity: i === idx ? 1 : 0,
            transform: `translateX(${i === idx ? drag * 0.35 : i < idx ? -24 : 24}px)`,
            pointerEvents: i === idx ? "auto" : "none",
          }}
        />
      ))}

      {/* стрелки (десктоп) */}
      {idx > 0 && (
        <button
          type="button"
          aria-label="previous photo"
          onClick={() => go(idxRef.current - 1)}
          className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[rgba(16,13,22,0.7)] text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          type="button"
          aria-label="next photo"
          onClick={() => go(idxRef.current + 1)}
          className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[rgba(16,13,22,0.7)] text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      )}

      {/* сегментный прогресс + счётчик (порядок фото виден всегда) */}
      <div className="absolute inset-x-4 top-3 z-10 flex gap-1.5" aria-hidden>
        {photos.map((_, i) => (
          <span
            key={i}
            className="h-[3px] flex-1 rounded-full transition-colors duration-300"
            style={{ background: i === idx ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.28)" }}
          />
        ))}
      </div>
      <span className="absolute right-3 top-7 z-10 rounded-full bg-[rgba(16,13,22,0.72)] px-2 py-0.5 text-[0.58rem] font-black tracking-[0.12em] text-white/70 backdrop-blur-md" aria-hidden>
        {idx + 1}/{photos.length}
      </span>
      {muted && (
        <span className="absolute bottom-24 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(16,13,22,0.72)] text-white/80 backdrop-blur-md" aria-hidden>
          <VolumeX className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

export function AudioClip({ audioUrl, title }: { audioUrl: string; title: string }) {
  const [muted, setMuted] = useState(false);
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-[#0A0A0F] px-8">
      {/* обложка-волна (декор, CSS-only) */}
      <div
        aria-hidden
        className="flex h-28 items-end gap-[3px]"
      >
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="w-[4px] rounded-full bg-[#C8FF00]/70"
            style={{
              height: `${18 + Math.abs(Math.sin(i * 1.7)) * 78}%`,
              opacity: 0.35 + (i % 5) * 0.13,
            }}
          />
        ))}
      </div>

      <p className="max-w-[80%] truncate text-center text-[0.86rem] font-extrabold tracking-tight text-white">
        {title || "voice drop"}
      </p>

      {/* НАТИВНЫЙ плеер (ТЗ: воспроизводится прямо в UI) */}
      <audio
        controls
        preload={muted ? "none" : "metadata"}
        src={audioUrl}
        className="w-full max-w-sm"
        aria-label="voice message player"
      />
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[0.6rem] font-black uppercase tracking-[0.14em] text-white/60 transition-transform hover:scale-105 active:scale-95"
      >
        {muted ? <VolumeX className="h-3 w-3" aria-hidden /> : <Volume2 className="h-3 w-3" aria-hidden />}
        {muted ? "blocked" : "ready"}
      </button>
    </div>
  );
}
