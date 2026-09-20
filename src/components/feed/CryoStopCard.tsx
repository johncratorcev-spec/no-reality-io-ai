"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { CRYO } from "@/lib/cryo/config";
import type { CryoMarketView, CryoSide } from "@/lib/cryo/core";
import { hookCryoAudioUnlock, playCryoSfx } from "@/lib/cryo/audio";
import { ensureCryoWallet, executeCryoSwap, type CryoWallet } from "@/lib/cryo/wallet";

/* ================================================================
   Cryo-Stop (task 41) — оверлей рынка предсказаний на видеокарточке.

   Блок 1: активация вниманием (active) → video.pause() + захват кадра в canvas.
   Блок 2: freeze-FX 0.8s — циан-шок, скан-шум, ветвящиеся трещины, inner glow.
   Блок 3: SFX scan (t=0) + crack (t=400мс).
   Блок 4: панель рынка — frosted glass, посимвольный вопрос, кварцы ДА/НЕТ
           с плазмой настроения, кольцо-таймер с жидкостью (пульс = BPM).
   Блок 5: one-tap ставка → protected popup → изоляция blur(40px) saturate(0)
           → фиксация → кристалл улетает за экран.
   Блок 6: [ ПОЗИЦИЯ ЗАФИКСИРОВНА ] — кольцо замерзает инеем, полоса толпы,
           золотой контур своей ставки, состояние переживает перезагрузку.
   Блок 7: кипение за 10с → щелчок → белая корка, серый таймер, затухание.
   Блок 9: вердикт оракула → проигравший кристалл рассыпается в пыль,
           победитель плавится в золото → [ ЭКСТРАКЦИЯ НАГРАДЫ ] → монета.
   ================================================================ */

type Phase =
  | "dormant"
  | "freezing"
  | "market"
  | "pending"
  | "expired"
  | "resolved";

interface LocalBet {
  side: CryoSide;
  wallet: string;
  local: boolean;
  ts: number;
}

const betKey = (code: string) => `nr-cryo-bet-${code}`;
/** окно рынка для расчёта заполнения кольца (конфиг-константа, 48ч) */
const WINDOW_MS = 48 * 3600 * 1000;

function readLocalBet(code: string): LocalBet | null {
  try {
    const raw = localStorage.getItem(betKey(code));
    if (!raw) return null;
    const d = JSON.parse(raw) as LocalBet;
    if (d.side !== "yes" && d.side !== "no") return null;
    return d;
  } catch {
    return null;
  }
}

/** детерминированный «скрытый BPM» ролика: 84–123 из кода поста */
function hiddenBpm(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return 84 + (h % 40);
}

/** генерация морозных трещин: ветвящиеся ломаные из центра к краям */
interface Crack {
  d: string;
  delay: number;
  width: number;
}

function makeCracks(w: number, h: number, seed: number): Crack[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const cracks: Crack[] = [];
  const arms = 7;
  for (let i = 0; i < arms; i++) {
    const angle = (i / arms) * Math.PI * 2 + rnd() * 0.7;
    const cx = w / 2 + (rnd() - 0.5) * w * 0.2;
    const cy = h / 2 + (rnd() - 0.5) * h * 0.2;
    const reach = Math.max(w, h) * (0.55 + rnd() * 0.45);
    let x = cx;
    let y = cy;
    let a = angle;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const segs = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < segs; k++) {
      a += (rnd() - 0.5) * 0.9;
      const len = (reach / segs) * (0.6 + rnd() * 0.8);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      // дочерняя ветка (морозный узор)
      if (rnd() > 0.35 && k < segs - 1) {
        const ba = a + (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.6);
        const bl = len * (0.35 + rnd() * 0.5);
        d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
        d += ` L ${(x + Math.cos(ba) * bl).toFixed(1)} ${(y + Math.sin(ba) * bl).toFixed(1)}`;
        d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    cracks.push({ d, delay: 0.05 + rnd() * 0.3, width: 0.8 + rnd() * 1.6 });
  }
  return cracks;
}

/** тайл скан-шума (матрица сканирования) → data-URL */
function makeNoiseTile(): string {
  const size = 140;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = 255;
    img.data[i + 3] = Math.random() > 0.82 ? 26 + Math.random() * 40 : 0;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

/* ---------------- подкомпоненты ---------------- */

function RingTimer({
  remainingMs,
  boiling,
  frozenOver,
  accent,
  bpm,
}: {
  remainingMs: number;
  boiling: boolean;
  frozenOver: boolean;
  accent: string;
  bpm: number;
}) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const progress = Math.max(0, Math.min(1, remainingMs / WINDOW_MS));
  const pulseDur = (60 / bpm).toFixed(3);
  return (
    <div
      className={`nr-cryo-ring ${boiling ? "nr-cryo-boil" : ""} ${
        frozenOver ? "nr-cryo-ring-dead" : ""
      }`}
      style={{ ["--pulse" as string]: `${pulseDur}s` }}
      aria-hidden
    >
      <svg viewBox="0 0 128 128" className="nr-cryo-ring-svg">
        <defs>
          <linearGradient id={`cryo-liq-${accent.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2ea8ff" />
            <stop offset="55%" stopColor="#0f6bff" />
            <stop offset="100%" stopColor={frozenOver ? "#9aa7b5" : "#7ce7ff"} />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} className="nr-cryo-ring-track" />
        <circle
          cx="64"
          cy="64"
          r={R}
          className="nr-cryo-ring-liq"
          stroke={`url(#cryo-liq-${accent.slice(1)})`}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
        />
        <circle cx="64" cy="64" r={R} className="nr-cryo-ring-frost" />
      </svg>
      {boiling && !frozenOver && (
        <span className="nr-cryo-bubbles">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <i key={i} style={{ ["--i" as string]: i }} />
          ))}
        </span>
      )}
      <span className="nr-cryo-ring-core">
        {frozenOver ? (
          <span className="nr-cryo-ring-dead-label">0:00</span>
        ) : (
          <span className="nr-cryo-ring-time">
            {formatRemaining(remainingMs)}
          </span>
        )}
        <span className="nr-cryo-ring-cap">event horizon</span>
      </span>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}h`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Crystal({
  side,
  label,
  odds,
  accent,
  dim,
  gold,
  melting,
  flying,
  disabled,
  onPick,
}: {
  side: CryoSide;
  label: string;
  odds: number | null;
  accent: string;
  dim?: boolean;
  gold?: boolean;
  melting?: boolean;
  flying?: boolean;
  disabled?: boolean;
  onPick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-label={`Outcome ${label} — fixed $1.00 USDC at ×${odds ?? "—"}`}
      className={[
        "nr-cryo-crystal",
        side === "yes" ? "nr-cryo-crystal-yes" : "nr-cryo-crystal-no",
        dim ? "nr-cryo-crystal-dim" : "",
        gold ? "nr-cryo-crystal-gold" : "",
        melting ? "nr-cryo-crystal-melt" : "",
        flying ? "nr-cryo-flyout" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ["--accent" as string]: accent }}
    >
      <span className="nr-cryo-crystal-plasma" aria-hidden />
      <span className="nr-cryo-crystal-facets" aria-hidden />
      <span className="nr-cryo-crystal-label">{label}</span>
      <span className="nr-cryo-crystal-odds">×{odds ?? "—"}</span>
      <span className="nr-cryo-crystal-price">$1.00</span>
    </button>
  );
}

function CrowdBar({
  yesPool,
  noPool,
  accent,
  mySide,
}: {
  yesPool: number;
  noPool: number;
  accent: string;
  mySide: CryoSide | null;
}) {
  const total = yesPool + noPool;
  const yesShare = total > 0 ? yesPool / total : 0.5;
  return (
    <div className="nr-cryo-crowd">
      <span className="nr-cryo-crowd-sums">
        <b style={{ color: accent }}>${yesPool.toFixed(2)}</b>
        <i>the crowd</i>
        <b>${noPool.toFixed(2)}</b>
      </span>
      <span
        className={`nr-cryo-crowd-bar ${mySide ? "nr-cryo-crowd-my" : ""}`}
        role="img"
        aria-label={`Crowd distribution: yes $${yesPool.toFixed(2)} / no $${noPool.toFixed(2)}`}
      >
        <i
          className="nr-cryo-crowd-yes"
          style={{ width: `${yesShare * 100}%`, background: accent }}
        />
        <i className="nr-cryo-crowd-no" style={{ width: `${(1 - yesShare) * 100}%` }} />
        {mySide && (
          <i
            className="nr-cryo-crowd-marker"
            style={{ left: `${(mySide === "yes" ? yesShare / 2 : 1 - (1 - yesShare) / 2) * 100}%` }}
          />
        )}
      </span>
    </div>
  );
}

/** Изоляция внимания (Block 5): страница позади поп-апа перестаёт существовать */
function ProtectedOverlay({ side, label, accent }: { side: CryoSide; label: string; accent: string }) {
  return (
    <div className="nr-cryo-iso" role="dialog" aria-modal aria-label="Phantom protected popup">
      <div className="nr-cryo-iso-card">
        <span className="nr-cryo-iso-head">
          <i className="nr-cryo-iso-ghost" aria-hidden />
          <b>Phantom</b>
          <em>protected</em>
        </span>
        <span className="nr-cryo-iso-swap">
          <span className="nr-cryo-iso-amt">
            <small>you pay</small>
            <b>1.00 USDC</b>
          </span>
          <span className="nr-cryo-iso-arrow" aria-hidden>→</span>
          <span className="nr-cryo-iso-amt">
            <small>you get</small>
            <b style={{ color: accent }}>
              OUTCOME {side === "yes" ? "ДА" : label.toUpperCase()}
            </b>
          </span>
        </span>
        <span className="nr-cryo-iso-status">
          <i className="nr-cryo-iso-spin" aria-hidden />
          confirming via Jupiter…
        </span>
      </div>
    </div>
  );
}

/** Block 9: проигравшие токены рассыпаются в пыль (2D particles) */
function Disintegration({
  trigger,
  accent,
  onDone,
}: {
  trigger: boolean;
  accent: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!trigger) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const ox = rect.width * 0.74;
    const oy = rect.height * 0.52;
    type P = { x: number; y: number; vx: number; vy: number; life: number; size: number };
    const parts: P[] = [];
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.4 + Math.random() * 2.4;
      parts.push({
        x: ox + (Math.random() - 0.5) * 60,
        y: oy + (Math.random() - 0.5) * 90,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.7,
        life: 0.9 + Math.random() * 0.9,
        size: 0.8 + Math.random() * 2.2,
      });
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const dt = (t - t0) / 1000;
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = 0;
      for (const p of parts) {
        const l = p.life - dt;
        if (l <= 0) continue;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045; // пыль оседает
        p.vx *= 0.985;
        ctx.globalAlpha = Math.max(0, Math.min(1, l));
        ctx.fillStyle = l > 0.55 ? accent : "#8b98a8";
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (alive > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trigger, accent, onDone]);
  if (!trigger) return null;
  return <canvas ref={ref} className="nr-cryo-particles" aria-hidden />;
}

/* ---------------- главный компонент ---------------- */

export interface CryoStopCardProps {
  market: CryoMarketView;
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
}

export default function CryoStopCard({ market, videoRef, active }: CryoStopCardProps) {
  const [phase, setPhase] = useState<Phase>("dormant");
  const [captured, setCaptured] = useState(false);
  const [noiseUrl, setNoiseUrl] = useState("");
  const [cracks, setCracks] = useState<Crack[]>([]);
  const [wallet, setWallet] = useState<CryoWallet | null>(null);
  const [bet, setBet] = useState<{ side: CryoSide; local: boolean } | null>(null);
  const [betting, setBetting] = useState<CryoSide | null>(null);
  const [popup, setPopup] = useState<CryoSide | null>(null);
  const [flyout, setFlyout] = useState<CryoSide | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<"win" | "lose" | null>(null);
  const [dispersed, setDispersed] = useState(false);
  const [melting, setMelting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [payout, setPayout] = useState<string | null>(null);
  const [coinDrop, setCoinDrop] = useState(false);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const freezeRan = useRef(false);
  const lastStatus = useRef<string>(market.status);

  const bpm = useMemo(() => hiddenBpm(market.postCode), [market.postCode]);
  const endsAtMs = useMemo(
    () => new Date(market.endsAt).getTime(),
    [market.endsAt]
  );
  const remainingMs = endsAtMs - now;
  const boiling = remainingMs <= CRYO.boilLeadSec * 1000 && remainingMs > 0;

  /* локальная ставка из прошлого визита (Block 6: память карточки) */
  useEffect(() => {
    const lb = readLocalBet(market.postCode);
    if (lb && !bet) setBet({ side: lb.side, local: lb.local });
    hookCryoAudioUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* серверная позиция сильнее локальной (та же identity — по кошельку) */
  useEffect(() => {
    if (market.myBet && bet?.side !== market.myBet) {
      setBet({ side: market.myBet, local: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.myBet]);

  /* тикающие часы (countdown / кипение / истечение) */
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* локальное истечение: сервер-поллинг может опаздывать — UX живёт по часам */
  useEffect(() => {
    if (
      remainingMs <= 0 &&
      (phase === "market" || phase === "pending") &&
      market.status === "live"
    ) {
      setPhase("expired");
      void playCryoSfx("click", { volume: 0.8 });
    }
  }, [remainingMs, phase, market.status]);

  /* вердикт оракула пришёл по поллингу → Block 9 */
  useEffect(() => {
    if (market.status === "resolved" && lastStatus.current !== "resolved") {
      setPhase("resolved");
      setMelting(false);
    }
    lastStatus.current = market.status;
  }, [market.status]);

  /* Block 9: win/lose определяется как только известны И вердикт, И позиция
     (ставка может доехать позже кадра — например, из localStorage при маунте) */
  useEffect(() => {
    if (
      phase !== "resolved" ||
      flash !== null ||
      !bet ||
      market.status !== "resolved" ||
      !market.result
    ) {
      return;
    }
    if (bet.side === market.result) {
      setFlash("win");
      setPayout(market.myPayout ?? null);
      return;
    }
    setFlash("lose");
  }, [phase, flash, bet, market.status, market.result, market.myPayout]);

  /* золото проступает через 0.9с после вердикта (плавление кристалла) */
  useEffect(() => {
    if (flash !== "win" || melting) return;
    const t = setTimeout(() => setMelting(true), 900);
    return () => clearTimeout(t);
  }, [flash, melting]);

  /* Block 1: захват кадра — canvas копия пиксельного буфера видео */
  const captureFrame = useCallback((): boolean => {
    const v = videoRef.current;
    const c = frameRef.current;
    if (!v) return false;
    try {
      v.pause();
    } catch {
      /* игнорируем */
    }
    if (!c || !v.videoWidth || v.readyState < 2) return false;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    try {
      ctx.drawImage(v, 0, 0);
      return true;
    } catch {
      return false;
    }
  }, [videoRef]);

  /* Block 1+2+3: триггер вниманием → пауза → захват → заморозка 0.8s */
  useEffect(() => {
    if (!active || !market || freezeRan.current) return;

    const instant =
      (market.status === "live" && Boolean(bet)) ||
      market.status === "expired" ||
      market.status === "resolved";

    freezeRan.current = true;

    const seed =
      (Date.now() ^ market.postCode.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0)) >>> 0;
    setCracks(makeCracks(1280, 720, seed));
    setNoiseUrl(makeNoiseTile());

    if (instant) {
      setCaptured(captureFrame());
      setPhase(
        market.status === "resolved"
          ? "resolved"
          : market.status === "expired"
            ? "expired"
            : "pending"
      );
      return;
    }

    // анимированная заморозка: ровно 0.8s (Block 2)
    setPhase("freezing");
    void playCryoSfx("scan", { volume: 0.9 });
    let tries = 0;
    const grab = () => {
      tries++;
      if (captureFrame()) setCaptured(true);
      else if (tries < 4) setTimeout(grab, 220);
    };
    grab();
    const crackT = setTimeout(() => {
      void playCryoSfx("crack", { volume: 0.85 });
    }, CRYO.crackDelayMs);
    const panelT = setTimeout(() => {
      setPhase("market");
    }, CRYO.freezeMs);
    return () => {
      clearTimeout(crackT);
      clearTimeout(panelT);
    };
  }, [active, market, bet, captureFrame]);

  /* Block 5: one-tap исполнение */
  const pick = useCallback(
    async (side: CryoSide) => {
      if (phase !== "market" || betting || bet) return;
      setBetting(side);
      setPopup(side);
      const w = await ensureCryoWallet();
      setWallet(w);
      const swap = await executeCryoSwap({
        exchange: market.exchange,
        inputMint: CRYO.jupiterInputMint,
        outputMint: CRYO.jupiterOutputMint,
        amountUsdc: CRYO.betAmountUsdc,
      });

      let fixed = false;
      let localOnly = false;
      try {
        const r = await fetch("/api/cryo/bet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            postCode: market.postCode,
            side,
            wallet: w.address,
            mode: swap.mode,
            txSig: swap.txSig,
          }),
        });
        if (r.ok) fixed = true;
        else if (r.status === 503) localOnly = true;
        else if (r.status === 409) fixed = true; // позиция уже есть — показываем её
      } catch {
        localOnly = true; // сеть недоступна — локальная фиксация
      }

      if (fixed || localOnly) {
        try {
          localStorage.setItem(
            betKey(market.postCode),
            JSON.stringify({ side, wallet: w.address, local: localOnly, ts: Date.now() } satisfies LocalBet)
          );
        } catch {
          /* приватный режим — живём в сессии */
        }
        setBet({ side, local: localOnly });
        setFlyout(side); // кристалл отрывается и улетает за экран (Block 5)
        setTimeout(() => setPhase("pending"), 720);
      }
      setPopup(null);
      setBetting(null);
    },
    [phase, betting, bet, market]
  );

  /* Block 9: экстракция награды */
  const extract = useCallback(async () => {
    if (claiming || !bet) return;
    setClaiming(true);
    const w = wallet ?? (await ensureCryoWallet());
    setWallet(w);
    let done = false;
    let amount: string | null = null;
    if (!bet.local) {
      try {
        const r = await fetch("/api/cryo/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postCode: market.postCode, wallet: w.address }),
        });
        if (r.ok) {
          const d = (await r.json()) as { payout?: string };
          amount = d.payout ?? null;
          done = true;
        }
      } catch {
        /* упадём в demo-экстракцию */
      }
    }
    if (!done) {
      amount = bet.local ? CRYO.betAmountUsdc : payout; // локальная позиция — demo-экстракция
      done = Boolean(amount);
    }
    if (done) {
      setPayout(amount);
      setCoinDrop(true);
      void playCryoSfx("coin", { volume: 0.9 });
    }
    setClaiming(false);
  }, [claiming, bet, wallet, market.postCode, payout]);

  if (!active && phase === "dormant") return null;

  const frozen = phase !== "dormant";
  const mySide = bet?.side ?? null;
  const ringDead = phase === "expired" || phase === "resolved";
  const showPanel =
    phase === "market" || phase === "pending" || phase === "resolved" || phase === "expired";
  const verdictLabel = market.result === "yes" ? market.labelYes : market.labelNo;

  return (
    <div
      className={`nr-cryo-root ${frozen ? "nr-cryo-on" : ""} ${
        phase === "expired" ? "nr-cryo-expired" : ""
      }`}
      style={{ ["--accent" as string]: market.accent }}
      aria-label="Cryo-stop prediction market"
    >
      {/* ── Block 2: циан-шок через frost-слой (работает и без захвата кадра) ── */}
      {frozen && <div className="nr-cryo-frost" aria-hidden />}

      {/* ── Block 1: захваченный кадр — видео скрыто под статичной картинкой ── */}
      <canvas
        ref={frameRef}
        aria-hidden
        className={`nr-cryo-frame ${captured ? "nr-cryo-frame-on" : "nr-cryo-frame-off"}`}
      />

      {frozen && (
        <>
          <div
            className="nr-cryo-noise"
            aria-hidden
            style={noiseUrl ? { backgroundImage: `url(${noiseUrl})` } : undefined}
          />
          <svg
            className="nr-cryo-cracks"
            viewBox="0 0 1280 720"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            {cracks.map((c, i) => (
              <path
                key={i}
                d={c.d}
                pathLength={1}
                strokeWidth={c.width}
                style={{ ["--cd" as string]: `${c.delay}s` }}
              />
            ))}
          </svg>
          <div className="nr-cryo-glow" aria-hidden />
        </>
      )}

      {/* ── панель рынка (Block 4) ── */}
      {showPanel && (
        <div className={`nr-cryo-panel nr-cryo-panel-up`}>
          <div className="nr-cryo-panel-top">
            <RingTimer
              remainingMs={remainingMs}
              boiling={boiling}
              frozenOver={ringDead}
              accent={market.accent}
              bpm={bpm}
            />
            <div className="nr-cryo-qwrap">
              <p className="nr-cryo-q" aria-label={market.question}>
                {market.question.split("").map((ch, i) => (
                  <span
                    key={i}
                    style={{ ["--ci" as string]: `${0.05 + i * 0.05}s` }}
                    className={phase === "market" ? "nr-cryo-ch" : ""}
                  >
                    {ch === " " ? "\u00A0" : ch}
                  </span>
                ))}
              </p>

              {/* Block 6: статус-блок */}
              {phase === "pending" && (
                <p className="nr-cryo-locked">[ ПОЗИЦИЯ ЗАФИКСИРОВАНА ]</p>
              )}
              {phase === "expired" && (
                <p className="nr-cryo-locked nr-cryo-locked-dead">
                  [ MARKET FROZEN SHUT ]
                </p>
              )}
              {phase === "resolved" && flash && (
                <p
                  className={`nr-cryo-locked ${
                    flash === "win" ? "nr-cryo-locked-gold" : "nr-cryo-locked-dust"
                  }`}
                >
                  {flash === "win"
                    ? "[ РЕАЛЬНОСТЬ ПОДТВЕРЖДЕНА — YOU WON ]"
                    : "[ ИЛЛЮЗИЯ РАССЕЯЛАСЬ — DISSOLVED ]"}
                </p>
              )}

              {/* Block 9: вердикт без позиции — тихая плашка */}
              {phase === "resolved" && !mySide && (
                <p className="nr-cryo-verdict">
                  oracle verdict: <b style={{ color: market.accent }}>{verdictLabel}</b>
                </p>
              )}
            </div>
          </div>

          {/* кристаллы: market → выбор, pending → моя в золоте, resolved → судьба */}
          {phase !== "expired" && (
            <div className="nr-cryo-crystals">
              <Crystal
                side="yes"
                label={market.labelYes}
                odds={market.oddsYes}
                accent={market.accent}
                disabled={phase !== "market" || Boolean(betting)}
                dim={Boolean(mySide && mySide !== "yes") || (phase === "resolved" && market.result !== "yes")}
                gold={(mySide === "yes" && (phase === "pending" || phase === "resolved")) || (phase === "resolved" && market.result === "yes")}
                melting={melting && mySide === "yes" && flash === "win"}
                flying={flyout === "yes"}
                onPick={() => void pick("yes")}
              />
              <Crystal
                side="no"
                label={market.labelNo}
                odds={market.oddsNo}
                accent={market.accent}
                disabled={phase !== "market" || Boolean(betting)}
                dim={Boolean(mySide && mySide !== "no") || (phase === "resolved" && market.result !== "no")}
                gold={(mySide === "no" && (phase === "pending" || phase === "resolved")) || (phase === "resolved" && market.result === "no")}
                melting={melting && mySide === "no" && flash === "win"}
                flying={flyout === "no"}
                onPick={() => void pick("no")}
              />
              <Disintegration
                trigger={flash === "lose" && !dispersed}
                accent={market.accent}
                onDone={() => setDispersed(true)}
              />
            </div>
          )}

          {/* полоса толпы (Block 6) */}
          {(phase === "market" || phase === "pending") && (
            <CrowdBar
              yesPool={market.yesPool}
              noPool={market.noPool}
              accent={market.accent}
              mySide={mySide}
            />
          )}

          {/* Block 9: экстракция */}
          {phase === "resolved" && flash === "win" && melting && (
            market.myClaimed && !coinDrop ? (
              <p className="nr-cryo-extracted">
                [ +${(payout ?? market.myPayout ?? "0.00")} USDC EXTRACTED ]
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void extract()}
                disabled={claiming || Boolean(coinDrop)}
                className="nr-cryo-extract"
              >
                {coinDrop
                  ? `+$${payout ?? "0.00"} USDC → wallet`
                  : claiming
                    ? "extracting…"
                    : "[ ЭКСТРАКЦИЯ НАГРАДЫ ]"}
              </button>
            )
          )}
          {bet?.local && phase === "resolved" && flash === "win" && melting && (
            <p className="nr-cryo-local-note">local position — demo extraction</p>
          )}

          {/* Block 7: белая корка поверх управления */}
          {phase === "expired" && <div className="nr-cryo-crust" aria-hidden />}
        </div>
      )}

      {/* Block 5: изоляция внимания на время поп-апа кошелька */}
      {popup && (
        <ProtectedOverlay
          side={popup}
          label={popup === "yes" ? market.labelYes : market.labelNo}
          accent={market.accent}
        />
      )}

      {/* Block 9: полёт монеты в кошелёк */}
      {coinDrop && (
        <span className="nr-cryo-coin-layer" aria-hidden>
          <i className="nr-cryo-coin" />
          <svg className="nr-cryo-wallet" viewBox="0 0 24 24" fill="none">
            <path
              d="M21 7H5a2 2 0 0 1 0-4h13a1 1 0 0 1 1 1v3Zm0 0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5m18 2h-6a3 3 0 1 0 0 6h6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
    </div>
  );
}
