"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { track } from "@/lib/bet/trackClient";

/* ================================================================
   ShareEyeCta (v20, ТЗ §4): после победы/стрика — сильный CTA
   «Поделись результатом и получи EYE». Один вид награды — раз в
   UTC-день (сервер дедуплицирует refKey). Клиент показывает состояние
   (готово/сегодня уже забрано) и сразу начисляет.
   ================================================================ */

interface ShareEyeCtaProps {
  won: boolean;
  streak: number;
  /** deep-link с реф-кодом (withRef уже добавил ?ref=) */
  shareUrl: string;
}

export default function ShareEyeCta({ won, streak, shareUrl }: ShareEyeCtaProps) {
  const { lang } = useLang();
  const [state, setState] = useState<"idle" | "busy" | "done" | "already">("idle");
  const [amount, setAmount] = useState(0);
  const [authed, setAuthed] = useState(true);

  const kind: "win" | "streak" = streak >= 3 ? "streak" : "win";

  /* сегодня уже забирали? */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch("/api/share/claim", { cache: "no-store" });
        if (!alive) return;
        const d = (await r.json()) as { authed?: boolean; win?: boolean; streak?: boolean };
        setAuthed(Boolean(d.authed));
        if (d[kind]) setState("already");
      } catch {
        /* кнопка просто останется активной */
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  const claim = useCallback(async () => {
    if (state === "busy") return;
    setState("busy");
    track("share_reward_click", undefined, { kind });
    try {
      /* нативный share → фоллбэк копия (шеринг засчитывается по клику) */
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      try {
        if (nav.share) {
          await nav.share({
            title: "no reality.",
            text: won
              ? lang === "ru"
                ? "я назвал верно — банк заплатил. попробуй обыграть меня:"
                : "I called it right and the bank paid. try to beat me:"
              : lang === "ru"
                ? "реал или синтик? слепая ставка за минуту:"
                : "real or synth? a blind bet in a minute:",
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
        }
      } catch {
        /* отмена шеринга — награду всё равно фиксируем по клику CTA */
      }
      const r = await fetch("/api/share/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const d = (await r.json().catch(() => ({}))) as {
        credited?: boolean;
        amountCents?: number;
        error?: string;
      };
      if (r.status === 401) {
        setAuthed(false);
        setState("idle");
        return;
      }
      if (d.credited) {
        setAmount(d.amountCents ?? 0);
        setState("done");
      } else {
        setState("already");
      }
    } catch {
      setState("idle");
    }
  }, [state, kind, shareUrl, won, lang]);

  if (!won && streak < 3) {
    /* CTA показывается после победы или на стрике ≥3 */
    return null;
  }

  const ru = lang === "ru";

  return (
    <button
      type="button"
      onClick={() => void claim()}
      disabled={state === "busy" || state === "done" || state === "already"}
      className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[0.74rem] font-black tracking-[0.06em] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
      style={{
        background: "rgba(200,255,0,.14)",
        color: "var(--nb-poison, #C8FF00)",
        border: "1px solid rgba(200,255,0,.4)",
      }}
      aria-live="polite"
    >
      {state === "busy" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : state === "done" ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Gift className="h-3.5 w-3.5" aria-hidden />
      )}
      {state === "done"
        ? ru
          ? `+${amount} EYE зачислено — возвращайся завтра`
          : `+${amount} EYE added — come back tomorrow`
        : state === "already"
          ? ru
            ? "за сегодня забрано — завтра снова +EYE"
            : "claimed today — tomorrow it's back"
          : ru
            ? `поделиться результатом → +${streak >= 3 ? 25 : 15} EYE`
            : `share the result → +${streak >= 3 ? 25 : 15} EYE`}
      {!authed && <span className="sr-only">sign in required</span>}
    </button>
  );
}
