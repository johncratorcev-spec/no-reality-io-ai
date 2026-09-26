/* ============================================================
   no reality. — рисованные персонажи лендинга (чистый SVG).
   Джокеры (шутовские колоды = настроения ленты) и вороны
   в шляпах с очками (кураторы). Никаких растровых картинок —
   всё векторно, стилистически едино: кровавый карнавал.
   ============================================================ */

const BLOOD = "#FF003C";
const BLOOD_DEEP = "#A30026";
const WINE = "#4A0E1C";
const GOLD = "#D9A441";
const GOLD_DEEP = "#8F6A24";
const BONE = "#EFE9DC";
const CROW = "#191522";
const CROW_RIM = "#312A42";

/* ------------------------------------------------------------------ */
/*  ВОРОНА В ШЛЯПЕ С ОЧКАМИ — бюст куратора, три варианта headwear.   */
/* ------------------------------------------------------------------ */

export type CrowHat = "top" | "bowler" | "fez";
export type CrowGlasses = "round" | "monocle" | "shade";

export function CrowInHat({
  hat = "top",
  glasses = "round",
  redEyes = false,
  className = "",
}: {
  hat?: CrowHat;
  glasses?: CrowGlasses;
  redEyes?: boolean;
  className?: string;
}) {
  const eyeFill = redEyes ? BLOOD : BONE;
  return (
    <svg viewBox="0 0 200 230" className={className} role="img" aria-label="Curator crow in a hat and glasses">
      {/* бюст: плечи + крылья */}
      <path
        d="M22 230 C24 180 52 152 100 152 C148 152 176 180 178 230 Z"
        fill={CROW}
        stroke={CROW_RIM}
        strokeWidth="2"
      />
      {/* перья на плечах */}
      <path d="M56 196 q10 -16 26 -20 M74 210 q10 -14 24 -18 M126 192 q-10 -16 -26 -20 M108 206 q-10 -14 -24 -18"
        stroke={CROW_RIM} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* шея-голова */}
      <ellipse cx="100" cy="102" rx="50" ry="48" fill={CROW} stroke={CROW_RIM} strokeWidth="2" />
      {/* блики на голове */}
      <path d="M64 78 q10 -18 30 -24" stroke={CROW_RIM} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* клюв */}
      <path d="M100 116 L113 133 L100 160 L87 133 Z" fill={GOLD} />
      <path d="M100 133 L113 133 L100 160 Z" fill={GOLD_DEEP} />
      <path d="M100 116 L113 133 L87 133 Z" fill={GOLD} />
      {/* глаза */}
      <circle cx="78" cy="94" r="8.5" fill={eyeFill} />
      <circle cx="122" cy="94" r="8.5" fill={eyeFill} />
      <circle cx="80" cy="96" r="3.4" fill="#0A080E" />
      <circle cx="120" cy="96" r="3.4" fill="#0A080E" />

      {/* очки */}
      {glasses === "round" && (
        <g stroke={GOLD} strokeWidth="3" fill="none">
          <circle cx="78" cy="94" r="15" />
          <circle cx="122" cy="94" r="15" />
          <path d="M93 94 q7 -6 14 0" />
          <path d="M63 90 L48 84" />
          <path d="M137 90 L152 84" />
        </g>
      )}
      {glasses === "monocle" && (
        <g stroke={GOLD} strokeWidth="3" fill="none">
          <circle cx="122" cy="94" r="16" />
          <path d="M133 108 q4 14 -2 26" />
          <circle cx="130" cy="132" r="2.4" fill={GOLD} stroke="none" />
        </g>
      )}
      {glasses === "shade" && (
        <g>
          <path d="M58 84 h84 l-4 14 q-4 14 -20 14 q-14 0 -18 -14 q-4 14 -18 14 q-16 0 -20 -14 Z"
            fill="#0A080E" stroke={GOLD} strokeWidth="2.6" />
          <path d="M66 90 l12 12 M96 90 l14 14" stroke={BLOOD} strokeWidth="2" opacity="0.7" />
        </g>
      )}

      {/* шляпы */}
      {hat === "top" && (
        <g transform="rotate(-7 100 52)">
          <ellipse cx="100" cy="52" rx="56" ry="11" fill="#0C0A10" stroke={CROW_RIM} strokeWidth="2" />
          <path d="M66 52 C66 20 74 6 100 6 C126 6 134 20 134 52 Z" fill="#0C0A10" stroke={CROW_RIM} strokeWidth="2" />
          <rect x="66" y="38" width="68" height="12" fill={BLOOD} />
          <circle cx="100" cy="44" r="3.4" fill={BONE} />
        </g>
      )}
      {hat === "bowler" && (
        <g transform="rotate(5 100 54)">
          <ellipse cx="100" cy="56" rx="52" ry="10" fill="#0C0A10" stroke={CROW_RIM} strokeWidth="2" />
          <path d="M68 56 C68 26 82 12 100 12 C118 12 132 26 132 56 Z" fill="#0C0A10" stroke={CROW_RIM} strokeWidth="2" />
          <path d="M72 44 q28 -14 56 0" stroke={BLOOD} strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      )}
      {hat === "fez" && (
        <g transform="rotate(6 100 54)">
          <path d="M66 58 L70 16 Q100 6 130 16 L134 58 Z" fill={BLOOD_DEEP} stroke={WINE} strokeWidth="2" />
          <rect x="64" y="52" width="72" height="10" rx="4" fill={WINE} />
          <circle cx="130" cy="14" r="5" fill={GOLD} />
          <path d="M130 19 q6 10 2 18" stroke={GOLD} strokeWidth="2.4" fill="none" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ЛИЦО ДЖОКЕРА — шутовской колпак с бубенцами, широкая ухмылка.     */
/* ------------------------------------------------------------------ */

export function JokerFace({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 240" className={className} role="img" aria-label="Joker with a three-pointed hat and a wide grin">
      {/* воротник-зубцы */}
      <path
        d="M28 226 L46 190 L62 224 L78 186 L94 222 L110 184 L126 222 L142 186 L158 224 L174 190 L192 226 L168 236 L52 236 Z"
        fill={WINE}
        stroke={BLOOD_DEEP}
        strokeWidth="2"
      />
      <path d="M52 212 l6 -10 M78 208 l6 -10 M110 206 l6 -10 M142 208 l6 -10 M168 212 l6 -10" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" />

      {/* лицо: узкая челюсть, острый подбородок */}
      <path
        d="M62 96 C62 150 78 196 110 204 C142 196 158 150 158 96 C158 62 138 44 110 44 C82 44 62 62 62 96 Z"
        fill={BONE}
      />
      {/* тень под колпаком */}
      <path d="M62 78 q48 22 96 0 l0 -14 q-48 20 -96 0 Z" fill="#D9CDB8" opacity="0.8" />

      {/* глаза: один прищур, один распахнут */}
      <g fill="#0A080E">
        <path d="M80 108 q10 -8 20 0 q-10 8 -20 0 Z" />
        <circle cx="136" cy="108" r="6.5" />
      </g>
      <path d="M74 94 q12 -10 26 -4" stroke="#0A080E" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M124 90 q12 -4 22 4" stroke="#0A080E" strokeWidth="3.4" fill="none" strokeLinecap="round" />

      {/* нос */}
      <path d="M110 122 l7 12 l-14 0 Z" fill="#C9BBA2" />

      {/* ухмылка до ушей со стежками */}
      <path d="M76 146 q34 30 68 0" stroke="#0A080E" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M78 146 l-8 -6 M142 146 l8 -6" stroke="#0A080E" strokeWidth="3" strokeLinecap="round" />
      {/* зубы */}
      <path d="M88 156 q22 14 44 0 l-3 6 q-19 10 -38 0 Z" fill="#FFFFFF" stroke="#0A080E" strokeWidth="1.6" />
      <path d="M96 158 l0 7 M110 161 l0 8 M124 158 l0 7" stroke="#0A080E" strokeWidth="1.6" />

      {/* колпак: тулья + три мотающихся зубца с бубенцами */}
      <path d="M60 82 C58 46 80 24 110 24 C140 24 162 46 160 82 q-50 -22 -100 0 Z" fill={BLOOD} stroke={BLOOD_DEEP} strokeWidth="2" />
      {/* ромбы на колпаке */}
      <path d="M92 52 l8 10 l-8 10 l-8 -10 Z M120 46 l8 10 l-8 10 l-8 -10 Z" fill={WINE} />

      <g fill={BLOOD} stroke={BLOOD_DEEP} strokeWidth="2">
        {/* левый зубец */}
        <path d="M62 74 C40 70 26 56 22 34 C40 44 56 52 66 62 Z" />
        {/* правый зубец */}
        <path d="M158 74 C180 70 194 56 198 34 C180 44 164 52 154 62 Z" />
        {/* средний зубец */}
        <path d="M100 28 C96 14 100 6 110 0 C118 8 120 18 116 28 Z" />
      </g>
      <g fill={GOLD} stroke={GOLD_DEEP} strokeWidth="1.6">
        <circle cx="21" cy="31" r="7" />
        <circle cx="199" cy="31" r="7" />
        <circle cx="111" cy="0" r="6.4" />
      </g>
      <circle cx="18.5" cy="28.5" r="1.8" fill="#FFF3D6" />
      <circle cx="196.5" cy="28.5" r="1.8" fill="#FFF3D6" />
      <circle cx="109" cy="-2.4" r="1.6" fill="#FFF3D6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ДЖОКЕРСКАЯ КАРТА — колода настроений (SWAG / FUTURE / CREEPY /    */
/*  UFO). pattern — фон из ромбов, joker в центре, индексы по углам.  */
/* ------------------------------------------------------------------ */

export function JokerCard({
  label,
  accent = BLOOD,
  className = "",
}: {
  label: string;
  accent?: string;
  className?: string;
}) {
  /* ромбическая сетка фона */
  const diamonds: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      diamonds.push({ x: 44 + col * 52 + (row % 2 ? 26 : 0), y: 52 + row * 46 });
    }
  }

  return (
    <svg viewBox="0 0 240 344" className={className} role="img" aria-label={`Joker card — ${label}`}>
      {/* рубашка */}
      <rect x="4" y="4" width="232" height="336" rx="18" fill="#14101C" stroke="#332B45" strokeWidth="2.5" />
      <rect x="14" y="14" width="212" height="316" rx="12" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.55" />
      {diamonds.map((d, i) => (
        <path
          key={i}
          d={`M${d.x} ${d.y - 9} l7 9 l-7 9 l-7 -9 Z`}
          fill={accent}
          opacity={0.16}
        />
      ))}

      {/* рамка-портрет */}
      <ellipse cx="120" cy="172" rx="74" ry="96" fill="#0E0B14" stroke={accent} strokeWidth="2" opacity="0.9" />
      <g transform="translate(2 6) scale(1.05)">
        <JokerFaceRaw accent={accent} />
      </g>

      {/* угловые индексы */}
      <g fill={BONE}>
        <text x="26" y="46" fontSize="26" fontWeight="800" fontFamily="inherit">J</text>
        <text x="214" y="322" fontSize="26" fontWeight="800" fontFamily="inherit" textAnchor="end" transform="rotate(180 214 316)">J</text>
      </g>
      <path d="M30 56 l6 8 l-6 8 l-6 -8 Z M210 288 l6 8 l-6 8 l-6 -8 Z" fill={accent} />

      {/* имя настроения */}
      <text x="120" y="312" fontSize="15" fontWeight="800" letterSpacing="6" textAnchor="middle" fill={BONE} fontFamily="inherit">
        {label}
      </text>
    </svg>
  );
}

/* упрощённый джокер внутри карты (без дублирования ключей id) */
function JokerFaceRaw({ accent }: { accent: string }) {
  return (
    <g transform="translate(18 66) scale(0.72)">
      <path
        d="M40 96 C40 150 56 196 88 204 C120 196 136 150 136 96 C136 62 116 44 88 44 C60 44 40 62 40 96 Z"
        fill={BONE}
      />
      <g fill="#0A080E">
        <path d="M58 108 q10 -8 20 0 q-10 8 -20 0 Z" />
        <circle cx="114" cy="108" r="6.5" />
      </g>
      <path d="M54 154 q34 30 68 0" stroke="#0A080E" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M66 164 q22 14 44 0 l-3 6 q-19 10 -38 0 Z" fill="#FFFFFF" stroke="#0A080E" strokeWidth="1.6" />
      <path d="M38 82 C36 46 58 24 88 24 C118 24 140 46 138 82 q-50 -22 -100 0 Z" fill={accent} />
      <g fill={accent} stroke="#7A0022" strokeWidth="2">
        <path d="M40 74 C18 70 4 56 0 34 C18 44 34 52 44 62 Z" />
        <path d="M136 74 C158 70 172 56 176 34 C158 44 142 52 132 62 Z" />
        <path d="M78 28 C74 14 78 6 88 0 C96 8 98 18 94 28 Z" />
      </g>
      <g fill={GOLD}>
        <circle cx="-1" cy="31" r="7" />
        <circle cx="177" cy="31" r="7" />
        <circle cx="89" cy="0" r="6.4" />
      </g>
    </g>
  );
}
