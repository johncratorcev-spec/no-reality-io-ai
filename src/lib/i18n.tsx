"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ================================================================
   i18n хаба (v3): RU + EN с первого дня.
   - дефолт EN (SEO/x-default), авто-детект navigator.language → ru;
   - ?lang=ru|en перекрывает всё (ссылки шарят язык);
   - localStorage "nr-lang" помнит выбор;
   - hreflang-альтернейты в metadata ведут на /?lang=ru.
   ================================================================ */

export type Lang = "en" | "ru";

const STORAGE_KEY = "nr-lang";

const en = {
  langLabel: "EN",
  otherLang: "RU",
  nav: {
    feed: "the feed",
    bet: "the raffles",
    how: "how it works",
    ref: "bring an eye",
    faq: "faq",
    predictions: "predictions",
    market: "prompt market",
    pnl: "my positions",
    menu: "menu",
  },
  hero: {
    kicker: "AI video feed & real-or-synth raffles",
    title1: "watch what",
    title2: "shouldn’t exist.",
    title3: "call it.",
    sub: "Two feeds: an endless stream of AI cinema, and blind raffles where every clip is either REAL footage or a machine dream — call it, stake $1–5 and the bank resolves in under a minute.",
    cta: "enter the raffles",
    cta2: "how it works",
    rec: "rec",
    tc: "tc 00:00:00",
    stat1: "$1–5",
    stat1cap: "per call",
    stat2: "<1 min",
    stat2cap: "to resolve",
    stat3: "20%",
    stat3cap: "ref rake share",
  },
  how: {
    kicker: "the loop",
    title: "watch. call. get paid.",
    s1t: "watch the feed",
    s1d: "An endless stream of machine dreams and terrifyingly real footage, mixed so you never know which is which. Full-screen, one swipe at a time.",
    s2t: "call REAL or SYNTH",
    s2d: "Open a clip, feel the seam, put $1–5 on the side you trust. No wallet needed to watch — the bet opens the round.",
    s3t: "the bank resolves",
    s3d: "The curator’s verdict settles the pool in under a minute. Winners split it pari-mutuel — and every loss is a prompt-upsell away from revenge.",
  },
  blind: {
    kicker: "the raffles",
    title: "no hints. no titles. pure eye.",
    body: "The raffle feed strips every clip of titles, authors and stickers: you judge the footage itself — the way it should be judged. Your win rate becomes your reputation.",
    toggle: "the raffles",
    on: "blind ON",
    off: "blind OFF",
  },
  ref: {
    kicker: "viral loop",
    title: "bring an eye — keep 20% of the rake",
    body: "Every clip you share carries your invite. When a friend stakes and the bank takes its cut, 20% of that rake is yours. Forever. Sharing is not vanity here — it’s a payout.",
    cta: "share the hub",
  },
  faq: {
    kicker: "faq",
    title: "questions the court asked",
  },
  feed: {
    title: "the feed",
    sub: "an endless stream of AI videos",
    all: "all",
    bettable: "real or synth?",
    open: "open court",
    share: "share this clip",
    empty: "the feed is empty",
    emptyHint: "clips appear here as the crew curates them",
    blindHint: "no hints — judge the footage itself",
    meta: "raffle",
  },
  theater: {
    more: "more from the feed",
    back: "back to the feed",
  },
  footer: {
    tagline: "watch what shouldn’t exist. call it. win the pool.",
    rights: "AI video feed & real-or-synth raffles",
    lang: "language",
  },
  ticker: [
    "watch what shouldn’t exist",
    "real or synth?",
    "bet the seam — $1–5",
    "the bank resolves in under a minute",
    "the raffles: no hints, pure eye",
    "bring an eye — 20% of the rake is yours",
  ],
  common: {
    real: "REAL",
    synth: "SYNTH",
    open: "open the raffles",
  },
};

/* без as const: строки ширятся до string — RU-словарь структурно совместим */
export type Dict = typeof en;

const ru: Dict = {
  langLabel: "RU",
  otherLang: "EN",
  nav: {
    feed: "лента",
    bet: "рафлы",
    how: "как это работает",
    ref: "приведи глаз",
    faq: "вопросы",
    predictions: "предсказания",
    market: "промпт-маркет",
    pnl: "мои позиции",
    menu: "меню",
  },
  hero: {
    kicker: "AI-видео лента и рафлы реал или синтик",
    title1: "смотри то, что",
    title2: "не должно существовать.",
    title3: "вынеси вердикт.",
    sub: "Две ленты: бесконечный поток AI-синема и слепые рафлы, где каждый клип — либо реальная съёмка, либо машинный сон. Вынеси вердикт, ставь $1–5 — банк закрывается меньше чем за минуту.",
    cta: "войти в рафлы",
    cta2: "как это работает",
    rec: "зап",
    tc: "тс 00:00:00",
    stat1: "$1–5",
    stat1cap: "на вердикт",
    stat2: "<1 мин",
    stat2cap: "до резолва",
    stat3: "20%",
    stat3cap: "рейка по рефке",
  },
  how: {
    kicker: "цикл",
    title: "смотри. суди. забирай.",
    s1t: "смотри ленту",
    s1d: "Бесконечный поток машинных снов и пугающе реальной съёмки вперемешку — никогда не знаешь, что из этого кто. Полный экран, один свайп за раз.",
    s2t: "вердикт: реал или синтик",
    s2d: "Открой клип, почувствуй шов, поставь $1–5 на сторону, которой веришь. Кошелёк не нужен, чтобы смотреть — раунд открывает ставка.",
    s3t: "банк закрывается",
    s3d: "Кураторский вердикт закрывает пул меньше чем за минуту. Победители делят банк пари-мьютюэль — а проигрыш в один тап превращается в промпт-апселл и реванш.",
  },
  blind: {
    kicker: "рафлы",
    title: "без подсказок. без заголовков. чистый глаз.",
    body: "Рафлы вычищают у клипа всё: заголовки, авторов, стикеры. Ты судишь само изображение — так, как оно и должно судиться. Твой винрейт становится твоей репутацией.",
    toggle: "рафлы",
    on: "слепой вкл",
    off: "слепой выкл",
  },
  ref: {
    kicker: "вирусный цикл",
    title: "приведи глаз — забирай 20% рейка",
    body: "Каждый клип, которым ты делишься, несёт твоё приглашение. Друг ставит — банк забирает свою долю — 20% этой доли твои. Всегда. Шеринг здесь не тщеславие, а выплата.",
    cta: "поделиться хабом",
  },
  faq: {
    kicker: "вопросы",
    title: "то, о чём спрашивал суд",
  },
  feed: {
    title: "лента",
    sub: "бесконечный поток AI-видео",
    all: "все",
    bettable: "реал или синтик?",
    open: "открыть суд",
    share: "поделиться клипом",
    empty: "лента пуста",
    emptyHint: "клипы появятся, когда куратор разметит ленту",
    blindHint: "без подсказок — суди изображение само по себе",
    meta: "рафл",
  },
  theater: {
    more: "ещё из ленты",
    back: "назад в ленту",
  },
  footer: {
    tagline: "смотри то, что не должно существовать. выноси вердикт. забирай банк.",
    rights: "AI-видео лента и рафлы реал или синтик",
    lang: "язык",
  },
  ticker: [
    "смотри то, что не должно существовать",
    "реал или синтик?",
    "ставка на шов — $1–5",
    "банк закрывается меньше чем за минуту",
    "рафлы: без подсказок, чистый глаз",
    "приведи глаз — 20% рейка твои",
  ],
  common: {
    real: "РЕАЛ",
    synth: "СИНТИК",
    open: "открыть рафлы",
  },
};

const DICTS: Record<Lang, Dict> = { en, ru };

interface LangCtx {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangCtx>({
  lang: "en",
  t: en,
  setLang: () => {},
});

function initialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const url = new URL(window.location.href);
  const q = url.searchParams.get("lang");
  if (q === "ru" || q === "en") return q;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {}
  if (navigator.language?.toLowerCase().startsWith("ru")) return "ru";
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    /* rAF: setState не синхронен с телом эффекта (SSR-безопасный язык) */
    const id = requestAnimationFrame(() => setLangState(initialLang()));
    return () => cancelAnimationFrame(id);
  }, []);

  /* <html lang> синхронно с UI — важный сигнал для SEO/доступности */
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    /* ?lang= в адресе — чтобы ссылку можно было шарить с языком */
    const url = new URL(window.location.href);
    url.searchParams.set("lang", l);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const value = useMemo<LangCtx>(
    () => ({ lang, t: DICTS[lang], setLang }),
    [lang, setLang]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** Кнопка-переключатель языка: тёмная пилюля [RU|EN] (blood-carnival) */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const other: Lang = lang === "en" ? "ru" : "en";
  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      aria-label={t.footer.lang}
      title={t.footer.lang}
      className={`inline-flex h-9 items-center gap-1 rounded-full border border-white/12 bg-[rgba(16,13,22,0.72)] px-2.5 text-[0.66rem] font-extrabold tracking-[0.08em] text-white/45 backdrop-blur-md transition-colors hover:text-white ${className}`}
    >
      <span className={lang === "ru" ? "text-white" : ""}>ru</span>
      <span aria-hidden className="text-white/25">/</span>
      <span className={lang === "en" ? "text-white" : ""}>en</span>
    </button>
  );
}
