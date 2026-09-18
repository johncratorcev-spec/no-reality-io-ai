"use client";

import { useRef } from "react";
import confetti from "canvas-confetti";
import { playMeow } from "@/lib/meow";

/**
 * Пасхалка: большой кот, которого можно «погладить».
 * Клик → мяу (тот же синтезированный sfx, что и в ленте)
 * + залп лапок и рыбок. Виральный микро-момент, ноль зависимостей
 * сверх canvas-confetti.
 */
export default function CatEgg() {
  const wiggling = useRef(false);

  const pet = () => {
    playMeow();
    let shapes: confetti.Shape[] | undefined;
    try {
      shapes = [
        confetti.shapeFromText({ text: "🐾", scalar: 2 }),
        confetti.shapeFromText({ text: "🧡", scalar: 2 }),
        confetti.shapeFromText({ text: "🐟", scalar: 2 }),
      ];
    } catch {
      shapes = undefined;
    }
    confetti({
      particleCount: 32,
      spread: 100,
      startVelocity: 34,
      origin: { y: 0.62 },
      shapes,
      scalar: 1.4,
      ticks: 240,
      zIndex: 120,
      disableForReducedMotion: true,
    });
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={pet}
        onAnimationEnd={() => (wiggling.current = false)}
        aria-label="Pet the cat — meow!"
        className="nr-cat-egg select-none text-6xl transition-transform duration-200 hover:scale-110 active:scale-90 sm:text-7xl"
        title="pet me"
      >
        🐈
      </button>
      <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.18em] text-[#10161d]/40">
        pet the cat
      </span>
    </div>
  );
}
