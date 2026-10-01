"use client";

import { useState } from "react";
import { track } from "@/lib/bet/trackClient";
import { withRef } from "@/lib/shareRef";
import { useLang } from "@/lib/i18n";

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
 * v13: копирайт из i18n (ru/en), без смеси языков.
 * Аналитика: share_click (§4.3.10) — best-effort.
 */

interface ShareSeamProps {
  mode: "clip" | "invite";
  clip?: string;
  className?: string;
  label?: string;
}

export default function ShareSeam({ mode, clip, className, label }: ShareSeamProps) {
  const [copied, setCopied] = useState(false);
  const { t, lang } = useLang();

  const copy = {
    title: "no reality.",
    text:
      mode === "clip"
        ? t.share.seamClip
        : t.share.inviteText,
    label:
      mode === "clip" ? t.share.seamClipLabel : t.share.seamInviteLabel,
  };
  void lang;

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
      {copied ? t.share.copied : label ?? copy.label}
    </button>
  );
}
