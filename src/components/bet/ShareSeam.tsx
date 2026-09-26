"use client";

import { useState } from "react";
import { track } from "@/lib/bet/trackClient";
import { withRef } from "@/lib/shareRef";

/**
 * ShareSeam — мотивация шеринга (вместо охватов): одна кнопка, два
 * мотива:
 *   - clip:   поделиться КЛИПОМ (/v/CODE?ref=MOY) — «real or synth?
 *             реши сам» — приведённый глаз ставит ставку → 20% его рейка;
 *   - invite: поделиться ПРИГЛАШЕНИЕМ (/) — чистый рекрут.
 *
 * navigator.share, если платформа умеет (мобильный — главный канал),
 * иначе копирование в буфер + «скопировано». Атрибуция ?ref= вшивается
 * withRef() (свой код или захваченный — цепочка не рвётся).
 * Аналитика: share_click (§4.3.10) — best-effort.
 */

interface ShareSeamProps {
  mode: "clip" | "invite";
  clip?: string;
  className?: string;
  label?: string;
}

const COPY = {
  clip: {
    title: "real or synth?",
    text: "этот кадр не должен существовать. угадай, что здесь живое — шов есть.",
    label: "шарить кадр",
  },
  invite: {
    title: "no reality.",
    text: "смотри то, чего не должно быть — и спорь на шов. 20% рейка приведённых глаз — твои.",
    label: "приведи глаз — 20%",
  },
} as const;

export default function ShareSeam({ mode, clip, className, label }: ShareSeamProps) {
  const [copied, setCopied] = useState(false);
  const copy = COPY[mode];

  const share = async () => {
    const base = clip ? `/v/${clip}` : "/";
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}${withRef(base)}`;
    track("share_click", clip, { mode });

    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: copy.title, text: copy.text, url });
        return;
      }
      await navigator.clipboard.writeText(`${copy.text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* отменил шоурил — не ошибка */
    }
  };

  return (
    <button
      onClick={() => void share()}
      className={className ?? "nb-btn nb-btn-real rounded-full px-4 py-2.5 text-[0.72rem] font-bold"}
    >
      {copied ? "скопировано ✓" : label ?? copy.label}
    </button>
  );
}
