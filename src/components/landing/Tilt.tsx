"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 3D-tilt карточка: следует за курсором (rotateX/rotateY, до max°),
 * с бликом-глейром, скользящим по «стеклу». Ванильные pointer-события,
 * трансформация пишется напрямую в style через ref — без ререндеров.
 *
 * Отключается на тач-устройствах (hover: none) и при reduced-motion —
 * там карточка остаётся просто красивой стеклянной плиткой.
 */
export default function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current =
      window.matchMedia("(hover: hover)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box || !enabledRef.current) return;

    const r = box.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;

    // наклон: курсор у края → карточка «кланяется» в его сторону
    const rx = (0.5 - py) * max * 2;
    const ry = (px - 0.5) * max * 2;
    box.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;

    // блик: радиальное пятно следует за курсором
    const glare = glareRef.current;
    if (glare) {
      glare.style.opacity = "1";
      glare.style.background = `radial-gradient(320px circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%)`;
    }
  };

  const onLeave = () => {
    const box = boxRef.current;
    if (box) box.style.transform = "";
    const glare = glareRef.current;
    if (glare) glare.style.opacity = "0";
  };

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`nrld-tilt relative ${className}`}
    >
      {children}
      <div
        ref={glareRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500"
      />
    </div>
  );
}
