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
    roadmap: "roadmap",
    pnl: "my positions",
    menu: "menu",
  },
  hero: {
    kicker: "AI video feed & real-or-synth raffles",
    title1: "watch what",
    title2: "shouldn’t exist.",
    title3: "call it.",
    sub: "Two feeds: an endless stream of AI cinema, and blind raffles where every clip is either REAL footage or a machine dream — call it, stake 10–50 EYE and the bank resolves in under a minute.",
    cta: "enter the raffles",
    cta2: "how it works",
    rec: "rec",
    tc: "tc 00:00:00",
    stat1: "10–50 EYE",
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
    s2d: "Open a clip, feel the seam, put 10–50 EYE on the side you trust. No wallet needed to watch — the bet opens the round.",
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
    "bet the seam — 10–50 EYE",
    "the bank resolves in under a minute",
    "the raffles: no hints, pure eye",
    "bring an eye — 20% of the rake is yours",
  ],
  common: {
    real: "REAL",
    synth: "SYNTH",
    open: "open the raffles",
  },
  bet: {
    inPool: "YOU'RE IN THE POOL",
    wasReal: "IT WAS REAL FOOTAGE",
    wasSynth: "IT WAS SYNTHETIC",
    eyeWorked: "your eye hit · +",
    onBalance: " to your balance",
    wentToBank: " went to the bank",
    notBet: "you didn't bet — catch the next seam",
    streak: "streak ×",
    next: "next →",
    shareResult: "share the result",
    copied: "link copied",
    moreSeams: "one more seam",
    cashoutPnl: "cash-out — in pnl",
    bankLive: "live bank",
    bankFrozen: "seam frozen",
    bonus: "bonus",
    googlePass: "google → PASS",
    youInPool: "you're in the pool",
    waitingSeam: "waiting for the seam…",
    payInvoice: "pay invoice",
    coins: "coins",
    balance: "balance",
    topup: "top up",
    cryptoOnly: "coins top-up · USDT via 2328 · credited after network confirmation",
    topupHint: "balance refills right after the 2328 webhook — your bet lands itself",
    openInvoice: "open 2328 invoice",
    invoiceExpired: "invoice expired — create a new one",
    demoCap: "demo limit for today",
    invoiceFailed: "invoice failed",
    networkDown: "network blinked",
    alreadyBet: "bet already in the bank",
    roundClosed: "seam closed — open the next one",
    betRejected: "the bank refused",
    awaitingNetwork: "waiting for network confirmation…",
    topupDone: "balance topped up ✓",
    googleCta: "sign in with Google — unlocks PASS and the daily bonus",
    noWalletNote: "no wallets, no forms · winnings land on your balance instantly",
    dailyPassBonus: "PASS daily bonus · +",
    yourPredict: "your predict",
    topupBalance: "top up the balance",
    topupSub: "top up — return to the pool",
    bestRate: "best rate",
    earnTitle: "earn EYE inside the game",
    earnBody: "watch the feed, call verdicts right, add clips — points are not for sale during season 1; top-ups return after the snapshot.",
    earnWatch: "+{N} for every {every} clips watched · daily",
    earnGuess: "+{N} for every correct prediction",
    earnVideo: "+{N} for adding a video to the feed",
    /* v10: auth-гейт для гостей + инфографика шансов */
    gateTitle: "want skin in the game?",
    gateSub: "you're watching live — sign in to place your prediction on this seam.",
    gateCoins: "100 EYE welcome — bet instantly, no deposits needed",
    gateDaily: "PASS daily bonus + rewards for watching and correct calls",
    gatePass: "leaderboard, streaks and the Season 1 snapshot",
    gateCta: "sign in — 15 seconds",
    gateNote: "sign in with telegram or email — the site stays open",
    guestCta: "sign in to bet · 100 EYE welcome",
    pays: "pays",
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
    roadmap: "роадмап",
    pnl: "мои позиции",
    menu: "меню",
  },
  hero: {
    kicker: "AI-видео лента и рафлы реал или синтик",
    title1: "смотри то, что",
    title2: "не должно существовать.",
    title3: "вынеси вердикт.",
    sub: "Две ленты: бесконечный поток AI-синема и слепые рафлы, где каждый клип — либо реальная съёмка, либо машинный сон. Вынеси вердикт, ставь 10–50 EYE — банк закрывается меньше чем за минуту.",
    cta: "войти в рафлы",
    cta2: "как это работает",
    rec: "зап",
    tc: "тс 00:00:00",
    stat1: "10–50 EYE",
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
    s2d: "Открой клип, почувствуй шов, поставь 10–50 EYE на сторону, которой веришь. Кошелёк не нужен, чтобы смотреть — раунд открывает ставка.",
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
    "ставка на шов — 10–50 EYE",
    "банк закрывается меньше чем за минуту",
    "рафлы: без подсказок, чистый глаз",
    "приведи глаз — 20% рейка твои",
  ],
  common: {
    real: "РЕАЛ",
    synth: "СИНТИК",
    open: "открыть рафлы",
  },
  bet: {
    inPool: "ТЫ В ПУЛЕ",
    wasReal: "ЭТО БЫЛО ЖИВОЕ",
    wasSynth: "ЭТО СИНТЕТИКА",
    eyeWorked: "твой глаз сработал · +",
    onBalance: " на баланс",
    wentToBank: " ушли в банк",
    notBet: "ты не ставил — заходи в следующий шов",
    streak: "серия ×",
    next: "следующий →",
    shareResult: "поделиться результатом",
    copied: "ссылка скопирована",
    moreSeams: "ещё шов",
    cashoutPnl: "кэшаут — в pnl",
    bankLive: "банк живой",
    bankFrozen: "шов замер",
    bonus: "бонус",
    googlePass: "google → PASS",
    youInPool: "ты в пуле",
    waitingSeam: "ждём шов…",
    payInvoice: "оплатить инвойс",
    coins: "монет",
    balance: "баланс",
    topup: "пополнение баланса",
    cryptoOnly: "пополнение монет · USDT через 2328 · зачисление после подтверждения сети",
    topupHint: "баланс пополнится сразу после вебхука 2328 — ставка дожмётся сама",
    openInvoice: "открыть инвойс 2328",
    invoiceExpired: "инвойс истёк — создай новый",
    demoCap: "demo-лимит на сегодня",
    invoiceFailed: "инвойс не создался",
    networkDown: "сеть дрогнула",
    alreadyBet: "ставка уже в банке",
    roundClosed: "шов закрылся — открой следующий",
    betRejected: "банк не принял",
    awaitingNetwork: "ждём подтверждение сети…",
    topupDone: "баланс пополнен ✓",
    googleCta: "вход через Google — откроет PASS и ежедневный бонус",
    noWalletNote: "без кошельков и форм · выигрыш приходит на баланс мгновенно",
    dailyPassBonus: "дневной бонус PASS · +",
    yourPredict: "твой предикт",
    topupBalance: "пополнение баланса",
    topupSub: "топни баланс — вернись в пул",
    bestRate: "лучший курс",
    earnTitle: "зарабатывай EYE внутри игры",
    earnBody: "смотри ленту, верно называй вердикты, добавляй клипы — очки не продаются в season 1; пополнение вернётся после снапшота.",
    earnWatch: "+{N} за каждые {every} просмотренных клипа · ежедневно",
    earnGuess: "+{N} за каждое верное предсказание",
    earnVideo: "+{N} за добавление видео в ленту",
    /* v10: auth-гейт для гостей + инфографика шансов */
    gateTitle: "хочешь поставить на шов?",
    gateSub: "ты смотришь трансляцию — войди, чтобы сделать предикшен.",
    gateCoins: "100 EYE приветственных — ставь сразу, без депозитов",
    gateDaily: "daily-бонус PASS + награды за просмотр и верные коллы",
    gatePass: "лидерборд, серии и снапшот Season 1",
    gateCta: "войти — 15 секунд",
    gateNote: "вход по telegram или email — сайт остаётся открыт",
    guestCta: "войти, чтобы ставить · 100 EYE в подарок",
    pays: "платит",
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
