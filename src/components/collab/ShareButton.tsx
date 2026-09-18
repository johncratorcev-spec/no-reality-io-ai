"use client";

import { useCallback, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Check, Share2 } from "lucide-react";

/**
 * Вирусная share-кнопка коллаб-страницы.
 * Первый канал — нативный Web Share (мобильные: шеринговый шит ОС),
 * фолбэк — буфер обмена. В любом случае — залп конфетти лапками
 * и сердечками (canvas-confetti, ~2KB gzip — единственная
 * анимационная «библиотека» на странице).
 */
export default function ShareButton({
  url,
  title,
  text,
  label = "share the love",
}: {
  url: string;
  title: string;
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const burst = useCallback(() => {
    let shapes: confetti.Shape[] | undefined;
    try {
      const paw = confetti.shapeFromText({ text: "🐾", scalar: 2 });
      const heart = confetti.shapeFromText({ text: "🧡", scalar: 2 });
      shapes = [paw, heart];
    } catch {
      shapes = undefined; // старая версия без shapeFromText — обычное конфетти
    }
    const fire = (x: number) =>
      confetti({
        particleCount: 24,
        spread: 75,
        startVelocity: 42,
        origin: { x, y: 0.72 },
        shapes,
        scalar: 1.35,
        ticks: 230,
        zIndex: 120,
        disableForReducedMotion: true,
      });
    fire(0.28);
    fire(0.72);
    window.setTimeout(() => fire(0.5), 170);
  }, []);

  const share = async () => {
    burst();
    /* нативный шеринг: мобильные и большинство браузеров */
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        /* пользователь отменил шеринг — тихо выходим, конфетти уже есть */
        return;
      }
    }
    /* фолбэк: копируем ссылку и благодарим */
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2600);
    } catch {
      /* даже буфер не дал — конфетти всё равно было */
    }
  };

  return (
    <button
      onClick={share}
      aria-label="Share the collab — invite friends to support cat shelters"
      className={`nr-share-btn group inline-flex items-center gap-2 rounded-full font-extrabold text-white transition-transform duration-300 hover:scale-[1.04] active:scale-95 ${
        copied ? "is-copied" : ""
      }`}
    >
      {copied ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden />
      )}
      {copied ? "link copied — thank you!" : label}
    </button>
  );
}
