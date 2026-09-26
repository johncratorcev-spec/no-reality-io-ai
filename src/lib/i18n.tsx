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
    mosaic: "mosaic",
    how: "how it works",
    moods: "moods",
    blind: "blind court",
    ref: "bring an eye",
    faq: "faq",
    predictions: "predictions",
    market: "prompt market",
    pnl: "my positions",
    menu: "menu",
  },
  hero: {
    kicker: "the interactive hub of AI content & predictions",
    title1: "watch what",
    title2: "shouldn’t exist.",
    title3: "call it.",
    sub: "A mosaic of synthetic cinema. Every clip is either REAL footage or a machine dream — watch, call it, stake $1–5 and the bank resolves in under a minute.",
    cta: "enter the mosaic",
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
    s1t: "watch the mosaic",
    s1d: "Four mood channels of machine dreams and real footage, mixed so you never know which is which. Hover to peek, open to play.",
    s2t: "call REAL or SYNTH",
    s2d: "Open a clip, feel the seam, put $1–5 on the side you trust. No wallet needed to watch — the bet opens the round.",
    s3t: "the bank resolves",
    s3d: "The curator’s verdict settles the pool in under a minute. Winners split it pari-mutuel — and every loss is a prompt-upsell away from revenge.",
  },
  blind: {
    kicker: "blind court",
    title: "no hints. no titles. pure eye.",
    body: "Flip the mosaic into blind court: titles, authors and mood stickers disappear. You judge the footage itself — the way it should be judged. Your win rate becomes your reputation.",
    toggle: "blind court",
    on: "blind ON",
    off: "blind OFF",
  },
  moods: {
    kicker: "channels",
    title: "four moods of the seam",
    explore: "open channel",
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
    title: "the mosaic",
    sub: "machine dreams & real footage, shuffled",
    all: "all",
    bettable: "real or synth?",
    open: "open court",
    share: "share this clip",
    empty: "the mosaic is empty",
    emptyHint: "clips appear here as the crew curates them",
    blindHint: "blind court: metadata hidden — judge the footage itself",
    meta: "court",
  },
  theater: {
    more: "more from the mosaic",
    back: "back to the mosaic",
  },
  footer: {
    tagline: "watch what shouldn’t exist. call it. win the pool.",
    rights: "an interactive hub of AI content & predictions",
    lang: "language",
  },
  ticker: [
    "watch what shouldn’t exist",
    "real or synth?",
    "bet the seam — $1–5",
    "the bank resolves in under a minute",
    "blind court: no hints, pure eye",
    "bring an eye — 20% of the rake is yours",
  ],
  common: {
    real: "REAL",
    synth: "SYNTH",
    open: "open the mosaic",
  },
};

/* без as const: строки ширятся до string — RU-словарь структурно совместим */
export type Dict = typeof en;

const ru: Dict = {
  langLabel: "RU",
  otherLang: "EN",
  nav: {
    mosaic: "мозаика",
    how: "как это работает",
    moods: "настроения",
    blind: "слепой суд",
    ref: "приведи глаз",
    faq: "вопросы",
    predictions: "предсказания",
    market: "промпт-маркет",
    pnl: "мои позиции",
    menu: "меню",
  },
  hero: {
    kicker: "интерактивный хаб AI-контента и предсказаний",
    title1: "смотри то, что",
    title2: "не должно существовать.",
    title3: "вынеси вердикт.",
    sub: "Мозаика синтетического синема. Каждый клип — либо реальная съёмка, либо машинный сон: смотри, выноси вердикт, ставь $1–5 — банк закрывается меньше чем за минуту.",
    cta: "войти в мозаику",
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
    s1t: "смотри мозаику",
    s1d: "Четыре канала-настроения: машинные сны и реальная съёмка вперемешку — никогда не знаешь, что из этого кто. Наведение — предпросмотр, клик — полный экран.",
    s2t: "вердикт: реал или синтик",
    s2d: "Открой клип, почувствуй шов, поставь $1–5 на сторону, которой веришь. Кошелёк не нужен, чтобы смотреть — раунд открывает ставка.",
    s3t: "банк закрывается",
    s3d: "Кураторский вердикт закрывает пул меньше чем за минуту. Победители делят банк пари-мьютюэль — а проигрыш в один тап превращается в промпт-апселл и реванш.",
  },
  blind: {
    kicker: "слепой суд",
    title: "без подсказок. без заголовков. чистый глаз.",
    body: "Переключи мозаику в слепой суд: заголовки, авторы и стикеры исчезают. Ты судишь само изображение — так, как оно и должно судиться. Твой винрейт становится твоей репутацией.",
    toggle: "слепой суд",
    on: "слепой вкл",
    off: "слепой выкл",
  },
  moods: {
    kicker: "каналы",
    title: "четыре настроения шва",
    explore: "открыть канал",
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
    title: "мозаика",
    sub: "машинные сны и реальная съёмка вперемешку",
    all: "все",
    bettable: "реал или синтик?",
    open: "открыть суд",
    share: "поделиться клипом",
    empty: "мозаика пуста",
    emptyHint: "клипы появятся, когда куратор разметит ленту",
    blindHint: "слепой суд: метаданные скрыты — суди изображение само по себе",
    meta: "суд",
  },
  theater: {
    more: "ещё из мозаики",
    back: "назад в мозаику",
  },
  footer: {
    tagline: "смотри то, что не должно существовать. выноси вердикт. забирай банк.",
    rights: "интерактивный хаб AI-контента и предсказаний",
    lang: "язык",
  },
  ticker: [
    "смотри то, что не должно существовать",
    "реал или синтик?",
    "ставка на шов — $1–5",
    "банк закрывается меньше чем за минуту",
    "слепой суд: без подсказок, чистый глаз",
    "приведи глаз — 20% рейка твои",
  ],
  common: {
    real: "РЕАЛ",
    synth: "СИНТИК",
    open: "открыть мозаику",
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

/** Кнопка-переключатель языка в духе VHS-zine: [RU|EN] на плёнке */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  const other: Lang = lang === "en" ? "ru" : "en";
  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      aria-label={t.footer.lang}
      title={t.footer.lang}
      className={`vhz-lang-switch ${className}`}
    >
      <span className={lang === "ru" ? "is-on" : ""}>ru</span>
      <span aria-hidden>/</span>
      <span className={lang === "en" ? "is-on" : ""}>en</span>
    </button>
  );
}
