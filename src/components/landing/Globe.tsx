"use client";

import { useEffect, useRef } from "react";

/**
 * 3D-глобус команды: сфера из точек (сферическое распределение Фибоначчи),
 * ванильная 3D-проекция на canvas 2D — никаких three.js.
 *
 * Интерактив: можно крутить пальцем/мышью (drag) с инерцией.
 * Живость: медленное авто-вращение + пульсирующие «очаги» команды
 * (расширяющиеся кольца) в точках планеты.
 *
 * Гигиена: пауза вне вьюпорта (IntersectionObserver) и при скрытой вкладке,
 * reduced-motion → один статичный кадр. Все слушатели снимаются в cleanup.
 */

const POINTS = 700;
const FOV = 3.2; // перспектива (в радиусах сферы)

interface P3 {
  x: number;
  y: number;
  z: number;
}

/** равномерное распределение точек по сфере (Fibonacci spiral) */
function spherePoints(n: number): P3[] {
  const pts: P3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
}

/** «очаги» команды: широта/долгота (плюс фаза пульса на рендере) */
const HUBS: Array<{ lat: number; lon: number }> = [
  { lat: 55.7, lon: 37.6 }, // Москва
  { lat: 40.7, lon: -74.0 }, // Нью-Йорк
  { lat: 35.7, lon: 139.7 }, // Токио
  { lat: 52.5, lon: 13.4 }, // Берлин
  { lat: -23.5, lon: -46.6 }, // Сан-Паулу
  { lat: 1.35, lon: 103.8 }, // Сингапур
  { lat: 25.2, lon: 55.3 }, // Дубай
  { lat: -33.9, lon: 151.2 }, // Сидней
];

function latLonToXYZ(lat: number, lon: number): P3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return {
    x: Math.cos(la) * Math.cos(lo),
    y: Math.sin(la),
    z: Math.cos(la) * Math.sin(lo),
  };
}

export default function Globe({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pts = spherePoints(POINTS);
    const hubs = HUBS.map((hb) => ({ p: latLonToXYZ(hb.lat, hb.lon), phase: Math.random() }));

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* вращение: авто + драг с инерцией */
    let angleY = 0.6;
    let velY = 0;
    let dragging = false;
    let lastX = 0;
    const TILT_X = -0.38; // лёгкий наклон оси — планета «живая»

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      angleY += dx * 0.006;
      velY = dx * 0.006;
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    /* проекция точки сферы: вращение Y → наклон X → перспектива */
    const project = (
      p: P3,
      aY: number
    ): { sx: number; sy: number; z: number } => {
      const cosY = Math.cos(aY);
      const sinY = Math.sin(aY);
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;

      const cosX = Math.cos(TILT_X);
      const sinX = Math.sin(TILT_X);
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      const persp = FOV / (FOV - z2); // z2 ∈ [-1,1]
      const R = Math.min(w, h) * 0.36;
      return { sx: w / 2 + x1 * R * persp, sy: h / 2 - y2 * R * persp, z: z2 };
    };

    let raf = 0;
    let running = false;
    let inView = true;
    let tabVisible = !document.hidden;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!dragging) {
        angleY += (0.07 + velY * 60) * dt; // авто-вращение + инерция
        velY *= 0.94;
      }

      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.36;
      const timeS = now / 1000;

      /* мягкое гало под сферой */
      const glow = ctx.createRadialGradient(w / 2, h / 2, R * 0.1, w / 2, h / 2, R * 1.35);
      glow.addColorStop(0, "rgba(91,155,213,0.10)");
      glow.addColorStop(1, "rgba(91,155,213,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      /* точки: ярче и крупнее на «передней» стороне (светлая тема) */
      for (const p of pts) {
        const { sx, sy, z } = project(p, angleY);
        const depth = (z + 1) / 2; // 0 задняя … 1 передняя
        const alpha = 0.12 + depth * 0.5;
        const size = 0.7 + depth * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(61,125,184,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      /* очаги команды: тёплая точка + расходящееся кольцо */
      for (const hub of hubs) {
        const hp = project(hub.p, angleY);
        if (hp.z < -0.15) continue; // на невидимой стороне не рисуем
        const pulse = (timeS * 0.5 + hub.phase) % 1;
        const ringR = 3 + pulse * 14;

        ctx.beginPath();
        ctx.arc(hp.sx, hp.sy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(228,113,59,0.95)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(hp.sx, hp.sy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(228,113,59,${(0.5 * (1 - pulse)).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      /* тонкий контур диска */
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R * 1.005, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(91,155,213,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const tick = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(tick);
    };

    const startStop = () => {
      const should = inView && tabVisible && !reduced;
      if (should && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          inView = e.isIntersecting;
        }
        startStop();
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    const onVis = () => {
      tabVisible = !document.hidden;
      startStop();
    };
    document.addEventListener("visibilitychange", onVis);

    if (reduced) draw(performance.now()); // один статичный кадр
    startStop();

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      if (running) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`cursor-grab touch-pan-y select-none active:cursor-grabbing ${className}`}
      aria-label="Rotating globe with team hubs across the planet"
      role="img"
    />
  );
}
