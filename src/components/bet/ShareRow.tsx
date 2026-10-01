"use client";

import { useState } from "react";
import { AtSign, Link2, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

/* ================================================================
   v13 — вирусный ShareRow: 6 целей шеринга вердикта.
   Telegram / X / Threads / Facebook / Instagram (copy + подсказка) /
   copy link. Тексты — дерзкие, свои для победы и поражения, ru+en.
   IG не имеет веб-интента — копируем текст+ссылку и подсказываем.
   ================================================================ */

type Target = "telegram" | "x" | "threads" | "facebook" | "instagram" | "copy";

export function buildShareText(
  lang: "en" | "ru",
  won: boolean,
  asReal: boolean,
  amountCoins: number
): string {
  const t = (template: string, as: string, amt: string) =>
    template.replace("{as}", as).replace("{amt}", amt);
  if (lang === "ru") {
    return won
      ? t("я назвал {as} — и банк заплатил мне {amt} EYE. твои глаза против машины — попробуй:", asReal ? "РЕАЛ" : "СИНТИК", String(amountCoins))
      : t("машина меня обошла: это было {as}. назови лучше меня:", asReal ? "РЕАЛ" : "СИНТИК", String(amountCoins));
  }
  return won
    ? t("I called it {as} and the bank paid me {amt} EYE. your eyes vs the machine — try it:", asReal ? "REAL" : "SYNTH", String(amountCoins))
    : t("the machine got me: it was {as}. call it better than me:", asReal ? "REAL" : "SYNTH", String(amountCoins));
}

export function buildInviteText(lang: "en" | "ru"): string {
  return lang === "ru"
    ? "реал или синтик? слепые ставки, минута, банк платит сразу. 100 EYE в подарок:"
    : "real or synth? blind bets, one minute, instant bank. 100 EYE on the house:";
}

export default function ShareRow({
  url,
  text,
  onTrack,
  compact = false,
}: {
  url: string;
  text: string;
  onTrack?: (target: Target) => void;
  compact?: boolean;
}) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState<Target | null>(null);
  const [igHint, setIgHint] = useState(false);

  const full = `${text} ${url}`;

  const fire = (target: Target, href?: string) => {
    try {
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");
      } else {
        void navigator.clipboard.writeText(full);
      }
      setCopied(target);
      setTimeout(() => setCopied(null), 1600);
      if (target === "instagram") {
        setIgHint(true);
        setTimeout(() => setIgHint(false), 3200);
      }
    } catch {
      /* буфер мог быть недоступен — молча */
    }
    onTrack?.(target);
  };

  const u = encodeURIComponent(url);
  const txt = encodeURIComponent(text);

  const items: { id: Target; label: string; href?: string; icon: React.ReactNode }[] = [
    {
      id: "telegram",
      label: t.share.tg,
      href: `https://t.me/share/url?url=${u}&text=${txt}`,
      icon: <SendIcon />,
    },
    {
      id: "x",
      label: t.share.x,
      href: `https://twitter.com/intent/tweet?text=${txt}&url=${u}`,
      icon: <XIcon />,
    },
    {
      id: "threads",
      label: t.share.threads,
      href: `https://www.threads.net/intent/post?text=${encodeURIComponent(full)}`,
      icon: <AtSign className="h-3.5 w-3.5" aria-hidden />,
    },
    {
      id: "facebook",
      label: t.share.fb,
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${txt}`,
      icon: <FbIcon />,
    },
    {
      id: "instagram",
      label: t.share.ig,
      icon: <IgIcon />,
    },
    {
      id: "copy",
      label: copied === "copy" ? t.share.copied : t.share.copy,
      icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
    },
  ];

  return (
    <div className="w-full">
      <p className="mb-1.5 text-center text-[0.55rem] font-black uppercase tracking-[0.24em] text-white/35">
        {t.share.row}
      </p>
      <div className={`grid grid-cols-3 gap-1.5 ${compact ? "" : "sm:grid-cols-6"}`}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => fire(it.id, it.href)}
            aria-label={it.label}
            className="nb-btn nb-btn-real inline-flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[0.66rem] font-bold"
          >
            {copied === it.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-none opacity-70" aria-hidden />
            ) : (
              it.icon
            )}
            <span className="truncate">{it.label}</span>
          </button>
        ))}
      </div>
      {igHint && (
        <p className="mt-1.5 text-center text-[0.6rem] font-bold text-white/55">
          {t.share.igHint}
        </p>
      )}
    </div>
  );
}

/* --- бренд-иконки (инлайн, чтобы не тянуть пакеты) --- */
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M21.9 4.6 18.6 19c-.2 1-0.8 1.2-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.4-4.8L18 6.7c.4-.3-.1-.5-.6-.2L6.9 13.2l-4.6-1.4c-1-.3-1-1 .2-1.4l17.9-6.9c.8-.3 1.6.2 1.5 1.1z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.3 4.8H5.5l11.2 14.3z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.2-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
    </svg>
  );
}
function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
