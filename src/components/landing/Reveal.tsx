"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Обёртка scroll-reveal: элемент «всплывает» из мягкого размытия,
 * когда попадает во вьюпорт. Только IntersectionObserver + CSS-переходы —
 * никаких библиотек и scroll-листенеров.
 *
 * delay — ступенька каскада (мс): карточки в сетке передают 0/80/160…
 * one-shot: однажды показанный элемент больше не прячется.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "span" | "p";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // уважение к reduced-motion: показываем сразу, без анимации
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target); // one-shot
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement & HTMLParagraphElement>}
      className={`nrld-reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
