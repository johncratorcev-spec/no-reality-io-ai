/* ================================================================
   v19 — векторная «шерховатая» графика хэллоуин-лендинга.
   Всё — инлайн-SVG со stroke-контуром; лёгкое hand-drawn дрожание
   даёт общий displacement-фильтр #hwRough (статичный: растр кэшится,
   transform-анимации поверх остаются композитными).
   Анимации элементов — только transform/opacity (см. css).
   ================================================================ */

/** Общие фильтры/градиенты — рендерится один раз на странице. */
export function HwFilters() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute" focusable="false">
      <defs>
        <filter id="hwRough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.016 0.026" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" />
        </filter>
        <filter id="hwRough2" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.024 0.019" numOctaves={2} seed={12} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4.6" />
        </filter>
        <linearGradient id="hwPumpGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd9a0" />
          <stop offset="52%" stopColor="#ff9a3d" />
          <stop offset="100%" stopColor="#ff5d00" />
        </linearGradient>
        <radialGradient id="hwMoon" cx="38%" cy="34%" r="82%">
          <stop offset="0%" stopColor="#fff6e8" />
          <stop offset="62%" stopColor="#ecdcc4" />
          <stop offset="100%" stopColor="#c9b394" />
        </radialGradient>
        <radialGradient id="hwEyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb45e" />
          <stop offset="100%" stopColor="#ff5d00" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Череп (судья ночи). eyes — тлеющие зрачки, eyeColor — их цвет. */
export function HwSkull({
  className = "",
  eyes = true,
  eyeColor = "#ff7a1a",
}: {
  className?: string;
  eyes?: boolean;
  eyeColor?: string;
}) {
  return (
    <svg viewBox="0 0 120 132" fill="none" className={className} aria-hidden focusable="false">
      <g
        filter="url(#hwRough)"
        stroke="#f2ede4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M60 7 C31 7 15 29 16 51 c1 17 9 25 13 31 l2 15 c0 4 3 8 8 8 h42 c5 0 8-4 8-8 l2-15 c4-6 12-14 13-31 C105 29 89 7 60 7 Z"
          fill="rgba(8,6,13,0.6)"
        />
        <path d="M41 106 v8 M51 107 v9 M60 108 v10 M69 107 v9 M79 106 v8" opacity="0.9" />
        <path d="M36 106 c8 3 40 3 48 0" opacity="0.7" />
      </g>
      <g filter="url(#hwRough)">
        <ellipse cx="43" cy="52" rx="12.5" ry="10.5" fill="#08060d" />
        <ellipse cx="77" cy="52" rx="12.5" ry="10.5" fill="#08060d" />
        <path d="M60 63 l-6.5 12.5 h13 Z" fill="#08060d" />
        <path d="M25 72 l7 5 M95 72 l-7 5" stroke="#f2ede4" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
      </g>
      {eyes && (
        <g className="hwl-pupils">
          <circle cx="43" cy="53" r="7" fill="url(#hwEyeGlow)" opacity="0.9" />
          <circle cx="77" cy="53" r="7" fill="url(#hwEyeGlow)" opacity="0.9" />
          <circle cx="43" cy="53" r="2.6" fill={eyeColor} />
          <circle cx="77" cy="53" r="2.6" fill={eyeColor} />
        </g>
      )}
    </svg>
  );
}

/** Тыква-светильник (банк). lit — горит ли изнутри. */
export function HwPumpkin({
  className = "",
  lit = true,
}: {
  className?: string;
  lit?: boolean;
}) {
  return (
    <svg viewBox="0 0 140 122" fill="none" className={className} aria-hidden focusable="false">
      <g
        filter="url(#hwRough2)"
        stroke="#2a1406"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M67 16 c1-8 8-12 14-10 c-4 3-5 7-3 11" fill="rgba(58,28,8,0.85)" />
        <ellipse cx="70" cy="72" rx="53" ry="42" fill="url(#hwPumpGlow)" opacity={lit ? 0.95 : 0.5} />
        <path d="M41 34 c-15 21-15 57 1 77" opacity="0.45" />
        <path d="M99 34 c15 21 15 57-1 77" opacity="0.45" />
        <path d="M70 30 v84" opacity="0.4" />
        <path d="M45 60 l14 8 -13 8 Z" fill="#2a1406" />
        <path d="M95 60 l-14 8 13 8 Z" fill="#2a1406" />
        <path d="M43 86 l7 6 8-6 8 6 8-6 8 6 8-6 7 6" strokeWidth="4" />
      </g>
    </svg>
  );
}

/** Летучая мышь (стая на переходах сцен). */
export function HwBat({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 34" fill="none" className={className} aria-hidden focusable="false">
      <path
        d="M2 8 C10 3 16 9 22 15 C26 9 28 7 32 7 C36 7 38 9 42 15 C48 9 54 3 62 8 C56 14 52 20 46 24 C42 27 36 30 32 30 C28 30 22 27 18 24 C12 20 8 14 2 8 Z"
        fill="#0d0916"
        stroke="#f2ede4"
        strokeWidth="1.6"
        strokeLinejoin="round"
        filter="url(#hwRough)"
      />
      <circle cx="28" cy="15" r="1.7" fill="#ff7a1a" />
      <circle cx="36" cy="15" r="1.7" fill="#ff7a1a" />
      <path d="M26 6 l3-5 3 5 M35 6 l3-5 2 4" stroke="#f2ede4" strokeWidth="1.4" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

/** Скелет-кисть: тянется снизу в сценах. */
export function HwHand({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" fill="none" className={className} aria-hidden focusable="false">
      <g
        filter="url(#hwRough)"
        stroke="#f2ede4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      >
        <path d="M88 150 l4-40 h18 l4 40" fill="rgba(242,237,228,0.07)" />
        <path d="M96 111 c-2-18-6-30-11-41 l7-3 c6 11 10 25 12 44" fill="rgba(242,237,228,0.07)" />
        <path d="M108 111 c0-22 0-36-2-51 l8 0 c2 15 2 31 0 51" fill="rgba(242,237,228,0.07)" />
        <path d="M120 111 c2-16 6-29 12-39 l7 4 c-6 11-11 23-13 37" fill="rgba(242,237,228,0.07)" />
        <path d="M89 119 c-10-4-17-11-21-19 l6-4 c5 8 10 13 18 17" fill="rgba(242,237,228,0.07)" />
        <circle cx="93" cy="112" r="2.2" />
        <circle cx="107" cy="112" r="2.2" />
        <circle cx="121" cy="112" r="2.2" />
        <path d="M97 76 l4 4 M106 62 l4 4" opacity="0.7" />
      </g>
    </svg>
  );
}

/** Луна в облаках — герой-сцена. */
export function HwMoon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" fill="none" className={className} aria-hidden focusable="false">
      <circle cx="150" cy="88" r="62" fill="url(#hwMoon)" filter="url(#hwRough)" />
      <circle cx="128" cy="66" r="9" fill="rgba(160,140,110,0.5)" />
      <circle cx="168" cy="104" r="13" fill="rgba(160,140,110,0.4)" />
      <circle cx="150" cy="120" r="6" fill="rgba(160,140,110,0.45)" />
      <g filter="url(#hwRough2)" stroke="#0d0916" strokeWidth="10" strokeLinecap="round" opacity="0.85">
        <path d="M14 84 c22-14 44-10 62 2" />
        <path d="M40 118 c26-16 60-12 86 4" />
        <path d="M120 146 c30-14 66-10 92 6" />
      </g>
      <g filter="url(#hwRough)" stroke="#f2ede4" strokeWidth="2" strokeLinecap="round" opacity="0.35">
        <path d="M14 84 c22-14 44-10 62 2" />
        <path d="M40 118 c26-16 60-12 86 4" />
      </g>
    </svg>
  );
}

/** Монета EYE — глаз в круге. */
export function HwCoin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden focusable="false">
      <circle cx="32" cy="32" r="27" fill="rgba(255,154,61,0.16)" stroke="#ffa64d" strokeWidth="2.6" filter="url(#hwRough)" />
      <path
        d="M12 32 c8-11 16-16 20-16 s12 5 20 16 c-8 11-16 16-20 16 s-12-5-20-16 Z"
        stroke="#ffa64d"
        strokeWidth="2.6"
        strokeLinejoin="round"
        filter="url(#hwRough)"
      />
      <circle cx="32" cy="32" r="6.5" fill="#ff7a1a" />
      <circle cx="32" cy="32" r="2.2" fill="#08060d" />
    </svg>
  );
}

/** Ржавый «шов» — рваная горизонтальная линия-разделитель. */
export function HwSeam({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 14" fill="none" preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <path
        d="M2 8 l38-4 30 6 42-7 36 6 40-5 34 7 42-6 30 4 24-3"
        stroke="#ff7a1a"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="26 7 14 9"
        opacity="0.7"
        filter="url(#hwRough)"
      />
    </svg>
  );
}
