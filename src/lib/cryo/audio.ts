"use client";

/**
 * Cryo-Stop аудио-слой (Block 3 спеки).
 *
 * SFX: /sfx/cryo-scan.wav (цифровой затвор, t=0), /sfx/cryo-crack.wav
 * (треск айсберга, t=400мс — играет CryoStopCard), /sfx/cryo-coin.wav
 * (экстракция награды), /sfx/cryo-click.wav (сухой электрический щелчок
 * истечения).
 *
 * Браузеры требуют user activation: контекст разблокируется первым
 * pointerdown/keydown где угодно на странице. До разблокировки звуки
 * тихо пропускаются (механика спеки не требует нажатий — UX не страдает).
 */

type SfxName = "scan" | "crack" | "coin" | "click";

const FILES: Record<SfxName, string> = {
  scan: "/sfx/cryo-scan.wav",
  crack: "/sfx/cryo-crack.wav",
  coin: "/sfx/cryo-coin.wav",
  click: "/sfx/cryo-click.wav",
};

const buffers = new Map<SfxName, AudioBuffer>();
let ctx: AudioContext | null = null;
let unlocked = false;
let hooked = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Первый жест пользователя разблокирует звук на всей странице */
export function hookCryoAudioUnlock(): void {
  if (typeof window === "undefined" || hooked) return;
  hooked = true;
  const unlock = () => {
    const c = ensureCtx();
    if (c && c.state === "suspended") {
      c.resume().catch(() => {});
    }
    unlocked = true;
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

async function load(name: SfxName): Promise<AudioBuffer | null> {
  const c = ensureCtx();
  if (!c) return null;
  const hit = buffers.get(name);
  if (hit) return hit;
  try {
    const r = await fetch(FILES[name]);
    if (!r.ok) return null;
    const arr = await r.arrayBuffer();
    const buf = await c.decodeAudioData(arr);
    buffers.set(name, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Играть SFX. unlock+gain: до жеста пользователя — тихий пропуск. */
export async function playCryoSfx(
  name: SfxName,
  opts: { volume?: number; rate?: number } = {}
): Promise<void> {
  const c = ensureCtx();
  if (!c || !unlocked) return;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      return;
    }
  }
  const buf = await load(name);
  if (!buf) return;
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = c.createGain();
    g.gain.value = opts.volume ?? 1;
    src.connect(g).connect(c.destination);
    src.start();
  } catch {
    /* звук не критичен */
  }
}
