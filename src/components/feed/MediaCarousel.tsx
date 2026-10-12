"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import type { FeedMedia } from "@/lib/csv";

/* ================================================================
   MediaCarousel — «виральная» карусель слайдов внутри карточки ленты.
   Паттерн stories: сегментный прогресс сверху, авто-переход,
   свайп/драг, ken-burns на фото, видео-слайды играют при активации.
   Без библиотек: rAF + CSS-переходы + pointer events.
   ================================================================ */

interface MediaCarouselProps {
  slides: FeedMedia[];
  /** карточка активна в ленте — только тогда идёт аванскролл */
  active: boolean;
  /** последняя карточка ленты: карусель зацикливается вместо перехода дальше */
  loop: boolean;
  /** карусель доиграла (не-loop) → лента листается к следующей карточке */
  onEnded: () => void;
}

const IMAGE_DWELL_MS = 4200; // сколько висит один фото-слайд
const DRAG_THRESHOLD = 56;   // px, после которых драг превращается в переход

export default function MediaCarousel({
  slides,
  active,
  loop,
  onEnded,
}: MediaCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);

  const dragStartX = useRef(0);
  const slideEls = useRef<Array<HTMLDivElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const rafRef = useRef(0);
  const dwellStart = useRef(0);
  const idxRef = useRef(0);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  const hasVideo = slides.some((s) => s.type === "video");

  const go = useCallback(
    (next: number) => {
      if (next < 0) next = 0;
      if (next > slides.length - 1) {
        if (loop) next = 0;
        else {
          onEnded(); // лента листается к следующей карточке
          return;
        }
      }
      dwellStart.current = performance.now();
      setIdx(next);
    },
    [slides.length, loop, onEnded]
  );

  /* --------- авто-переход + прогресс сегментов: один rAF-цикл,
     DOM мутируется напрямую (React не рендерится на кадрах) --------- */
  useEffect(() => {
    if (!active || failed) return;
    dwellStart.current = performance.now();

    const tick = () => {
      const i = idxRef.current;
      const slide = slides[i];
      const seg = slideEls.current[i];
      const v = videoRefs.current[i];

      let progress = 0;
      if (slide?.type === "video" && v && v.duration > 0) {
        progress = Math.min(v.currentTime / v.duration, 1);
      } else {
        const hidden = document.hidden || dragging;
        const elapsed = hidden
          ? 0 // вкладка скрыта — прогресс замирает (start перезапустится)
          : performance.now() - dwellStart.current;
        progress = Math.min(elapsed / IMAGE_DWELL_MS, 1);
        if (document.hidden) dwellStart.current = performance.now();
      }

      /* пройденные сегменты — полные, текущий — по прогрессу, будущие — пустые */
      for (let s = 0; s < slides.length; s++) {
        const el = slideEls.current[s];
        if (!el) continue;
        el.style.transform = `scaleX(${s < i ? 1 : s === i ? progress : 0})`;
      }

      if (progress >= 1 && slide?.type !== "video") {
        go(i + 1);
        return; // go перезапускает dwell, кадр продолжится в следующем цикле
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, idx, dragging, slides, go, failed]);

  /* --------- видео-слайды: играют только когда активны ------------ */
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (active && i === idx) {
        v.play().catch(() => {});
      } else {
        v.pause();
        if (i !== idx) v.currentTime = 0;
      }
    });
  }, [active, idx]);

  /* --------- свайп/драг ------------------------------------------- */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (failed || slides.length < 2) return;
    dragStartX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDrag(e.clientX - dragStartX.current);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    const delta = drag;
    setDragging(false);
    setDrag(0);
    if (delta <= -DRAG_THRESHOLD) go(idxRef.current + 1);
    else if (delta >= DRAG_THRESHOLD) go(idxRef.current - 1);
  };

  /* --------- сломанные слайды: выбрасываем, все сломаны — фолбэк --- */
  const onSlideError = (i: number) => {
    const v = videoRefs.current[i];
    if (v) v.style.display = "none";
    if (slides.every((_, s) => s === i)) setFailed(true);
  };

  if (failed) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
        <div className="nr-glass-deep max-w-xs rounded-3xl px-6 py-7 text-center">
          <p className="font-bold tracking-tight">carousel temporarily unavailable</p>
          <p className="mt-2 text-xs leading-relaxed text-[#10161d]/60">
            the media links may have expired — refresh{" "}
            <code className="font-mono">media</code> in{" "}
            <code className="font-mono">/data/posts.csv</code>
          </p>
        </div>
      </div>
    );
  }

  const current = slides[idx];

  return (
    <div
      role="group"
      aria-label="Photo carousel"
      className="absolute inset-0 z-10 overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* размытый фон текущего слайда (кроссфейд по ключу) */}
      {current?.type === "image" && (
        <div
          key={`bg-${idx}`}
          aria-hidden
          className="nr-mc-bg absolute inset-0"
          style={{ backgroundImage: `url("${current.url}")` }}
        />
      )}

      {/* трек слайдов */}
      <div
        className={`flex h-full w-full ${
          dragging ? "" : "nr-mc-track"
        }`}
        style={{
          transform: `translate3d(calc(${-idx * 100}% + ${drag}px), 0, 0)`,
        }}
      >
        {slides.map((s, i) => (
          <div
            key={`${s.url.slice(-24)}-${i}`}
            className="relative h-full w-full shrink-0 overflow-hidden"
          >
            {s.type === "image" ? (
              <img
                src={s.url}
                alt=""
                loading={Math.abs(i - idx) <= 1 ? "eager" : "lazy"}
                draggable={false}
                onError={() => onSlideError(i)}
                className={`nr-mc-img h-full w-full select-none object-cover ${
                  active && i === idx ? "nr-mc-kb" : ""
                }`}
              />
            ) : (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={s.url}
                muted
                playsInline
                preload={Math.abs(i - idx) <= 1 ? "auto" : "none"}
                onEnded={() => go(i + 1)}
                onError={() => onSlideError(i)}
                className="h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* stories-прогресс: сегменты сверху */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex gap-1.5">
          {slides.map((_, i) => (
            <div
              key={i}
              className="nr-mc-seg h-[3px] flex-1 overflow-hidden rounded-full"
            >
              <div
                ref={(el) => {
                  slideEls.current[i] = el;
                }}
                className="h-full w-full origin-left rounded-full bg-white"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* счётчик слайдов */}
      {slides.length > 1 && (
        <div className="nr-glass pointer-events-none absolute right-3 top-8 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-extrabold text-[#0a0a0a]">
          <Images className="h-3 w-3" aria-hidden />
          {idx + 1}/{slides.length}
        </div>
      )}

      {/* стрелки на десктопе */}
      {slides.length > 1 && (
        <>
          {idx > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(idx - 1);
              }}
              aria-label="Previous slide"
              className="nr-glass nr-mc-arrow left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full p-2 text-[#0a0a0a] sm:block"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {idx < slides.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(idx + 1);
              }}
              aria-label="Next slide"
              className="nr-glass nr-mc-arrow right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full p-2 text-[#0a0a0a] sm:block"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </>
      )}

      {/* мьют для видео-слайдов */}
      {hasVideo && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10" aria-hidden />
      )}
    </div>
  );
}
