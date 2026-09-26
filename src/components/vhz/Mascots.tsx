"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* ================================================================
   НОВЫЙ СЕТ МАСКОТОВ ХАБА (v3, VHS-zine):
   - OracleEye    — оракул: всевидящее око на ленте сканлайнов;
   - DreamMachine — машина снов: CRT-ящик с антеннами и ногами;
   - WatcherEyes  — стайка глаз-наблюдателей.
   Всё — инлайн-SVG: белая «ксероксная» обводка, halftone-точки,
   CMYK-сдвиг через дублированные слои. Без растров, без веса.
   ================================================================ */

/** скролл-reveal: IO добавляет .is-visible (лёгкий, один на элемент) */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  /* полиморфный тег: рантайм рендерит нужный, TS проверяет как div */
  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref}
      className={`vhz-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  );
}

/** halftone-паттерн (каждый SVG самодостаточен — свой <defs>) */
function Halftone({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill={color} opacity="0.5" />
    </pattern>
  );
}

/**
 * ОРАКУЛ — всевидящее око в треугольнике, сканирующее реальность.
 * Веки моргают (CSS-анимация на группе), по зрачку бегает блик.
 */
export function OracleEye({
  className = "",
  accent = "#ffd400",
  size = 220,
}: {
  className?: string;
  accent?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="The Oracle — the all-seeing eye of the hub"
    >
      <defs>
        <Halftone id="oh" color={accent} />
        <clipPath id="oyClip">
          <path d="M120 52 L196 178 L44 178 Z" />
        </clipPath>
      </defs>

      {/* CMYK-сдвиг: теневые дубли треугольника */}
      <path d="M122 56 L198 182 L46 182 Z" fill="none" stroke="#00e5ff" strokeWidth="2.5" opacity="0.55" transform="translate(-4 2)" />
      <path d="M122 56 L198 182 L46 182 Z" fill="none" stroke="#ff2ba6" strokeWidth="2.5" opacity="0.55" transform="translate(4 -2)" />

      {/* корпус-треугольник */}
      <path
        d="M120 48 L198 180 L42 180 Z"
        fill="#14141e"
        stroke="#f4f2ec"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M120 48 L198 180 L42 180 Z" fill="url(#oh)" opacity="0.35" />

      {/* сканлайны внутри треугольника */}
      <g clipPath="url(#oyClip)" opacity="0.3">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1="40" x2="200" y1={70 + i * 13} y2={70 + i * 13} stroke="#00e5ff" strokeWidth="1.6" />
        ))}
      </g>

      {/* око */}
      <g>
        <ellipse cx="120" cy="136" rx="44" ry="27" fill="#0b0b10" stroke="#f4f2ec" strokeWidth="3.5" />
        <circle cx="120" cy="136" r="15" fill={accent} stroke="#f4f2ec" strokeWidth="3" />
        <circle cx="120" cy="136" r="6" fill="#0b0b10" />
        {/* блик-бегунок */}
        <circle cx="126" cy="129" r="3.4" fill="#ffffff">
          <animate attributeName="cx" values="126;114;126" dur="5.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="129;133;129" dur="5.2s" repeatCount="indefinite" />
        </circle>
        {/* ресницы-лучи */}
        {[-60, -30, 0, 30, 60].map((a) => (
          <line
            key={a}
            x1="120"
            y1="104"
            x2={120 + 16 * Math.sin((a * Math.PI) / 180)}
            y2={104 - 14 * Math.cos((a * Math.PI) / 180)}
            stroke="#f4f2ec"
            strokeWidth="2.6"
            strokeLinecap="round"
            transform={`rotate(${a} 120 136)`}
            opacity="0.85"
          />
        ))}
      </g>

      {/* «REC»-лучи антенн */}
      <line x1="120" y1="48" x2="120" y2="26" stroke="#f4f2ec" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="20" r="5" fill="#ff003c" stroke="#f4f2ec" strokeWidth="2.4" />

      {/* основание */}
      <line x1="36" y1="186" x2="204" y2="186" stroke="#f4f2ec" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="52" y1="196" x2="188" y2="196" stroke="#f4f2ec" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/**
 * МАШИНА СНОВ — CRT-ящик на ножках: рендерит «то, чего нет».
 * Экран показывает шум + око; антенны ловят чужие сны.
 */
export function DreamMachine({
  className = "",
  accent = "#00e5ff",
  size = 240,
}: {
  className?: string;
  accent?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 260 240"
      width={size}
      height={size * 0.92}
      className={className}
      role="img"
      aria-label="The Dream Machine — renders what does not exist"
    >
      <defs>
        <Halftone id="dmh" color={accent} />
        <clipPath id="dmScreen">
          <rect x="66" y="70" width="128" height="96" rx="8" />
        </clipPath>
      </defs>

      {/* CMYK-дубли корпуса */}
      <rect x="58" y="62" width="144" height="112" rx="14" fill="none" stroke="#00e5ff" strokeWidth="2.5" opacity="0.5" transform="translate(-4 2)" />
      <rect x="58" y="62" width="144" height="112" rx="14" fill="none" stroke="#ff2ba6" strokeWidth="2.5" opacity="0.5" transform="translate(4 -2)" />

      {/* корпус */}
      <rect x="56" y="58" width="148" height="112" rx="14" fill="#14141e" stroke="#f4f2ec" strokeWidth="3.5" />
      <rect x="56" y="58" width="148" height="112" rx="14" fill="url(#dmh)" opacity="0.25" />

      {/* экран с шумом и оком */}
      <rect x="66" y="70" width="128" height="96" rx="8" fill="#050508" stroke="#f4f2ec" strokeWidth="2.5" />
      <g clipPath="url(#dmScreen)">
        {/* шум-полосы */}
        {Array.from({ length: 7 }).map((_, i) => (
          <rect
            key={i}
            x="66"
            y={74 + i * 14}
            width="128"
            height="4"
            fill={i % 2 ? "#00e5ff" : "#ff2ba6"}
            opacity="0.22"
          >
            <animate attributeName="x" values="66;58;66" dur={`${3 + i}s`} repeatCount="indefinite" />
          </rect>
        ))}
        {/* око на экране */}
        <ellipse cx="130" cy="118" rx="34" ry="21" fill="#0b0b10" stroke={accent} strokeWidth="3" />
        <circle cx="130" cy="118" r="10" fill={accent} stroke="#f4f2ec" strokeWidth="2.4" />
        <circle cx="130" cy="118" r="4" fill="#050508" />
        <circle cx="134" cy="113" r="2.4" fill="#fff" />
        {/* пила вертикальной синхронизации */}
        <rect x="66" y="150" width="128" height="16" fill="#7cff4d" opacity="0.18">
          <animate attributeName="y" values="150;66;150" dur="9s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* антенны */}
      <line x1="120" y1="58" x2="96" y2="18" stroke="#f4f2ec" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="140" y1="58" x2="170" y2="22" stroke="#f4f2ec" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="96" cy="18" r="5" fill={accent} stroke="#f4f2ec" strokeWidth="2.2" />
      <circle cx="170" cy="22" r="5" fill="#ff2ba6" stroke="#f4f2ec" strokeWidth="2.2" />

      {/* ручки/индикаторы справа */}
      <circle cx="216" cy="92" r="7" fill="#0b0b10" stroke="#f4f2ec" strokeWidth="2.4" />
      <line x1="216" y1="92" x2="221" y2="87" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="216" cy="116" r="7" fill="#0b0b10" stroke="#f4f2ec" strokeWidth="2.4" />
      <circle cx="216" cy="140" r="4" fill="#ff003c" stroke="#f4f2ec" strokeWidth="2" className="vhz-rec-dot" />

      {/* ножки */}
      <line x1="84" y1="170" x2="72" y2="206" stroke="#f4f2ec" strokeWidth="3.4" strokeLinecap="round" />
      <line x1="176" y1="170" x2="188" y2="206" stroke="#f4f2ec" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx="66" cy="210" rx="10" ry="4.5" fill="#14141e" stroke="#f4f2ec" strokeWidth="2.4" />
      <ellipse cx="194" cy="210" rx="10" ry="4.5" fill="#14141e" stroke="#f4f2ec" strokeWidth="2.4" />

      {/* кассета внизу */}
      <rect x="96" y="176" width="68" height="20" rx="4" fill="#0b0b10" stroke="#f4f2ec" strokeWidth="2.4" />
      <circle cx="112" cy="186" r="4.5" fill="none" stroke="#f4f2ec" strokeWidth="2">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="148" cy="186" r="4.5" fill="none" stroke="#f4f2ec" strokeWidth="2" />
      <line x1="112" y1="186" x2="148" y2="186" stroke="#ffd400" strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

/**
 * СТАЙКА ГЛАЗ — три наблюдателя с разными веками.
 * Живут в секции blind court и на SEO-страницах.
 */
export function WatcherEyes({
  className = "",
  accent = "#ff2ba6",
  size = 200,
}: {
  className?: string;
  accent?: string;
  size?: number;
}) {
  const eye = (cx: number, cy: number, r: number, lid: number) => (
    <g key={`${cx}-${cy}`}>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.62} fill="#0b0b10" stroke="#f4f2ec" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r * 0.44} fill={accent} stroke="#f4f2ec" strokeWidth="2.4">
        <animate attributeName="cx" values={cx - 3 + ";" + (cx + 3) + ";" + (cx - 3)} dur={`${4 + cx / 60}s`} repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={r * 0.18} fill="#0b0b10" />
      {/* веко: прикрывается периодически */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r * 0.62} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy - lid} Z`}
        fill="#14141e"
        stroke="#f4f2ec"
        strokeWidth="2.6"
        strokeLinejoin="round"
      >
        <animate attributeName="d" values={`M ${cx - r} ${cy} A ${r} ${r * 0.62} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy - lid} Z; M ${cx - r} ${cy} A ${r} ${r * 0.62} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy + r * 0.62} Z; M ${cx - r} ${cy} A ${r} ${r * 0.62} 0 0 1 ${cx + r} ${cy} L ${cx + r} ${cy - lid} Z`} dur={`${6 + cy / 40}s`} repeatCount="indefinite" />
      </path>
    </g>
  );
  return (
    <svg viewBox="0 0 220 160" width={size} height={size * 0.72} className={className} role="img" aria-label="The Watchers — eyes of the blind court">
      <defs>
        <Halftone id="weh" color={accent} />
      </defs>
      <rect x="6" y="6" width="208" height="148" rx="12" fill="url(#weh)" opacity="0.3" />
      {eye(62, 62, 34, 8)}
      {eye(150, 52, 26, 4)}
      {eye(112, 116, 30, 12)}
      {/* штрихи-хвосты, как в ксерокопии */}
      <line x1="20" y1="132" x2="76" y2="132" stroke="#f4f2ec" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      <line x1="132" y1="140" x2="196" y2="140" stroke="#f4f2ec" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
