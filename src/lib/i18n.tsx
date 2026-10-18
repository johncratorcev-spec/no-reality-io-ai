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
    lb: "god eye",
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
    s3d: "The verdict lands in under a minute and the pool splits pari-mutuel — winners eat. Every loss is one tap away from revenge.",
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
    emptyHint: "clips drop in as the machines finish dreaming",
    moodEmpty: "mood “{m}” is empty",
    moodEmptyHint: "try another mood — new clips land every day",
    blindHint: "no hints — judge the footage itself",
    meta: "raffle",
    halloweenParty: "halloween party",
    hardMode: "hard",
    hardModeOn: "hard mode",
    hardHint: "hardest clips of the day",
    liveHint: "betting right now",
    hardCold: "hard mode went cold",
    hardColdHint: "in the last 48 hours the crowd hasn’t been wrong enough — come back later",
    leaderboardAria: "best eyes leaderboard",
    eyesChip: "eyes",
    close: "close",
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
  /* v13 — сезонный лидерборд «Глаз Бога» */
  lb: {
    kicker: "season leaderboard",
    title: "god eye.",
    sub: "best eyes of the season — humans only… for now.",
    rank: "#",
    player: "eye",
    winrate: "winrate",
    volume: "volume",
    correct: "correct",
    net: "net",
    streak: "streak",
    you: "you",
    empty: "no settled eyes yet — be the first the bank remembers.",
    minBets: "at least 3 settled calls to rank",
    season: "season",
    ends: "snapshot",
    badges: {
      "god-eye": "GOD EYE",
      eagle: "eagle",
      sharp: "sharp",
      unstoppable: "unstoppable",
      "hot-hand": "hot hand",
      "warming-up": "warming up",
      whale: "whale",
      "high-roller": "high roller",
    },
  },
  /* v13 — вирусные share-карточки результата */
  share: {
    row: "send the verdict",
    tg: "Telegram",
    x: "X",
    threads: "Threads",
    fb: "Facebook",
    ig: "Instagram",
    copy: "copy link",
    copied: "copied ✓",
    igHint: "copied — paste into your story or DM",
    winText: "I called it {as} and the bank paid me {amt} EYE. your eyes vs the machine — try it:",
    loseText: "the machine got me: it was {as}. call it better than me:",
    inviteText: "real or synth? blind bets, one minute, instant bank. 100 EYE on the house:",
    seamClip: "this frame shouldn’t exist. guess what’s alive here:",
    seamClipLabel: "share the frame",
    seamInviteLabel: "bring an eye — 20%",
  },
  /* v23 — быстрый флоу: три назначения вместо платформы.
     Лента+раффлы слиты в /bet, рефка и кошелёк живут в кабинете,
     «что это»/роадмап доступны с лендинга и в футере. */
  menu: {
    explore: "explore",
    account: "account",
    close: "close",
    open: "menu",
    items: [
      { href: "/bet", icon: "◈", label: "play", desc: "all raffles — call REAL or SYNTH, split the bank" },
      { href: "/cabinet", icon: "◉", label: "cabinet", desc: "EYE balance, top-up, PnL, badges, ref link" },
      { href: "/leaderboard", icon: "👁", label: "god eye", desc: "season leaderboard — best eyes ranked" },
    ],
  },
  /* v20 — личный кабинет (крючковая экономика) */
  cab: {
    title: "cabinet",
    sub: "everything your eye earned — and why it pays to come back",
    balance: "EYE balance",
    playOnly: "for play only — EYE never leaves the game",
    topup: "top up EYE",
    topupNote: "via 2328.io · USDT — the invoice opens in a new tab; EYE land on the balance right after the payment webhook",
    topupFailed: "could not create the invoice — try again in a minute",
    daily: "daily check-in",
    dailyClaim: "claim +50 EYE",
    dailyClaimed: "claimed today — come back tomorrow",
    shieldOn: "shield active",
    streak: "login streak",
    winStreak: "win streak",
    winrate: "winrate",
    pnlDay: "pnl today",
    pnlSeason: "pnl season",
    staked: "staked",
    won2: "won",
    bonuses: "bonuses",
    badges: "badges",
    badgesEmpty: "no badges yet — first win, streaks and invites are ahead",
    refs: "referrals",
    invited: "invited",
    activated: "activated",
    fromRefs: "EYE from referrals",
    invite: "your invite link",
    copy: "copy",
    copied: "copied!",
    share: "share",
    freebet: "freebet for a telegram nick",
    freebetHint: "type @username — +25 EYE once, no verification",
    freebetCta: "claim freebet",
    freebetDone: "freebet @{u} claimed",
    shop: "EYE shop",
    shopPumpkin: "pumpkin badge",
    shopShield: "streak shield · 1 day",
    buy: "buy",
    owned: "owned",
    shieldHint: "your login streak won't burn for a day even if you skip",
    positions: "open positions →",
    signin: "sign in to open the cabinet",
    snapshotNote: "the season snapshot turns weight into $NR — activity, streaks and referrals raise it",
    bet: "bet →",
  },
  /* v13 — лендинг кампании (EN) */
  land: {
    pill: "season 1 live",
    h1a: "real or",
    h1b: "synth",
    lines: [
      "watch a clip — real footage or a machine dream. no titles, no hints, nowhere to hide.",
      "call it: REAL or SYNTH. your eyes vs the machine.",
      "stake 10, 25 or 50 EYE into the pari-mutuel bank.",
      "the verdict lands in under a minute. reality is optional — the payout isn’t.",
      "winners split the losing side’s bank. straight to your ledger.",
      "make an account with email + password — 100 EYE on the house, once.",
      "streaks pay: 3/5/7/10 straight wins — bonuses stack.",
      "$NR goes to whoever saw it before the crowd. a late call is worth almost nothing. a wrong call — nothing. no rate promised.",
    ],
    cta: "call it",
    cta2: "just watch the feed",
    lb: "see the god eye →",
    snapshotIn: "snapshot in 7 days",
    snapshotOn: "snapshot on {d}",
    dayOf: "day {n} of 7",
    finalDay: "final day",
  },
  /* v21 — хэллоуин-лендинг: ОДИН экран-минимализм → /auth (судная ночь) */
  hwl: {
    pill: "the purge night · season 1 live",
    heroT1: "real",
    heroT2: "or",
    heroT3: "synth",
    heroSub: "watch a clip. call it REAL or SYNTH. winners split the bank — in under a minute.",
    m1: "watch 15 seconds",
    m2: "call real or synth",
    m3: "split the bank",
    cta: "play · +100 EYE gift",
    ghost: "just watch the feed",
    fine: "free to play · EYE is play-only · value exits through the season snapshot",
  },
  /* v13 — onboarding /bet (было жёстко RU) */
  onb: {
    kicker: "how it works",
    s1t: "watch the clip",
    s1d: "a frame with no captions, no likes — just the seam between the living and the machine",
    s2t: "hit REAL or SYNTH",
    s2d: "your verdict, 10–50 EYE — the stake drops into the shared bank",
    s3t: "sign in — we hand you coins",
    s3d: "100 EYE per account, PASS daily bonus — bets run on your internal balance",
    s4t: "the bank splits in a minute",
    s4d: "the verdict drops — the winning side splits the whole pool",
    next: "next",
    start: "start calling",
    skip: "skip",
  },
  /* v13 — Daily Challenge + серии */
  daily: {
    badge: "daily challenge",
    bonus: "win this one — +{N} EYE on top of the pool",
    streak: "win streak",
    streakBonus: "streak ×{n} — bonus +{amt} EYE",
    milestones: "bonuses at 3 / 5 / 7 / 10 straight wins",
  },
  bet: {
    /* v26 — тизеры: раффл ещё не открыт */
    soonChip: "predictions soon",
    soonTitle: "predictions coming soon",
    soonNote: "the footage is live in the feed — the betting window opens here shortly",
    inPool: "YOU'RE IN THE POOL",
    /* v15 — соревнования (первое соревнование) */
    competitionN: "competition {n}",
    competitionFirst: "the first competition",
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
    /* v14 — reveal card + packs */
    yourCall: "your call:",
    callAtSec: "your call landed at second",
    firstCorrect: "first correct call at second",
    packsTitle: "out of eyes — grab a pack",
    authNeeded: "sign in first",
    refPage: "ref link",
    refOff: "percentage off",
    refOn: "percentage on",
    refUnlockTitle: "turn on your 20%",
    refUnlockBody: "pay 3 USDT once — 20% of every pack your referrals buy, in USDT, lands on your balance. From their winnings in EYE you get nothing — that's the point.",
    refPay: "unlock · 3 USDT",
    refEarned: "earned",
    refBurned: "burned (before unlock)",
    refPaid: "paid out",
    refPending: "waiting payout (from 5 USDT)",
    refLinkTitle: "your link",
    refReffs: "your referrals' EYE winnings",
    refNoRefs: "no referrals yet — drop the link",
    refCopy: "copy",
    refCopied: "copied",
    bankLive: "live bank",
    bankFrozen: "seam frozen",
    bonus: "bonus",
    accountPass: "аккаунт → PASS",
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
    accountCta: "email + password — unlocks PASS and the daily bonus",
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
    gateNote: "email + password — the site stays open",
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
    lb: "глаз бога",
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
    s3d: "Вердикт падает меньше чем за минуту, пул делится пари-мьютюэль — победители жрут. Проигрыш в один тап превращается в реванш.",
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
    emptyHint: "клипы появятся, как только машины закончат мечтать",
    moodEmpty: "настроение «{m}» пусто",
    moodEmptyHint: "попробуй другое настроение — новые клипы падают каждый день",
    blindHint: "без подсказок — суди изображение само по себе",
    meta: "рафл",
    halloweenParty: "хэллоуин пати",
    hardMode: "хард",
    hardModeOn: "хард-режим",
    hardHint: "самые сложные клипы дня",
    liveHint: "ставят прямо сейчас",
    hardCold: "хард-режим остыл",
    hardColdHint: "за последние 48 часов толпа ещё не ошибалась достаточно — заходи позже",
    leaderboardAria: "лидерборд лучших глаз",
    eyesChip: "глаза",
    close: "закрыть",
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
  /* v13 — сезонный лидерборд «Глаз Бога» */
  lb: {
    kicker: "лидерборд сезона",
    title: "глаз бога.",
    sub: "лучшие глаза сезона — пока только люди.",
    rank: "#",
    player: "глаз",
    winrate: "винрейт",
    volume: "объём",
    correct: "верных",
    net: "нетто",
    streak: "серия",
    you: "ты",
    empty: "засчитанных глаз пока нет — будь первым, кого запомнит банк.",
    minBets: "минимум 3 засчитанных колла для зачёта",
    season: "сезон",
    ends: "снапшот",
    badges: {
      "god-eye": "ГЛАЗ БОГА",
      eagle: "орёл",
      sharp: "резкий",
      unstoppable: "неостановимый",
      "hot-hand": "горячая рука",
      "warming-up": "разогрев",
      whale: "кит",
      "high-roller": "хайроллер",
    },
  },
  /* v13 — вирусные share-карточки результата */
  share: {
    row: "отправь вердикт",
    tg: "Telegram",
    x: "X",
    threads: "Threads",
    fb: "Facebook",
    ig: "Instagram",
    copy: "копировать ссылку",
    copied: "скопировано ✓",
    igHint: "скопировано — вставь в сторис или в личку",
    winText: "я назвал {as} — и банк заплатил мне {amt} EYE. твои глаза против машины — попробуй:",
    loseText: "машина меня обошла: это было {as}. назови лучше меня:",
    inviteText: "реал или синтик? слепые ставки, минута, банк платит сразу. 100 EYE в подарок:",
    seamClip: "этот кадр не должен существовать. угадай, что здесь живое:",
    seamClipLabel: "шарить кадр",
    seamInviteLabel: "приведи глаз — 20%",
  },
  /* v23 — быстрый флоу: три назначения */
  menu: {
    explore: "разделы",
    account: "аккаунт",
    close: "закрыть",
    open: "меню",
    items: [
      { href: "/bet", icon: "◈", label: "играть", desc: "все раффлы — назови РЕАЛ или СИНТИК, дели банк" },
      { href: "/cabinet", icon: "◉", label: "кабинет", desc: "баланс EYE, пополнение, PnL, бейджи, реф-ссылка" },
      { href: "/leaderboard", icon: "👁", label: "глаз бога", desc: "лидерборд сезона — лучшие глаза" },
    ],
  },
  /* v20 — личный кабинет (крючковая экономика) */
  cab: {
    title: "кабинет",
    sub: "всё, что заработал твой глаз — и почему выгодно возвращаться",
    balance: "баланс EYE",
    playOnly: "только для игры — EYE нельзя вывести из игры",
    topup: "пополнить EYE",
    topupNote: "через 2328.io · USDT — инвойс откроется в новой вкладке; EYE упадут на баланс сразу после вебхука оплаты",
    topupFailed: "не получилось создать инвойс — попробуй через минуту",
    daily: "ежедневный вход",
    dailyClaim: "забрать +50 EYE",
    dailyClaimed: "за сегодня забрано — приходи завтра",
    shieldOn: "щит активен",
    streak: "стрик входов",
    winStreak: "серия верных",
    winrate: "винрейт",
    pnlDay: "PnL за день",
    pnlSeason: "PnL за сезон",
    staked: "поставлено",
    won2: "выиграно",
    bonuses: "бонусы",
    badges: "бейджи",
    badgesEmpty: "бейджей пока нет — впереди первая победа, стрики и приглашения",
    refs: "рефералы",
    invited: "приведено",
    activated: "активировано",
    fromRefs: "EYE с рефералов",
    invite: "твоя ссылка-приглашение",
    copy: "копировать",
    copied: "скопировано!",
    share: "поделиться",
    freebet: "фрибет за Telegram-ник",
    freebetHint: "укажи @username — +25 EYE один раз, без проверки",
    freebetCta: "получить фрибет",
    freebetDone: "фрибет @{u} получен",
    shop: "шоп EYE",
    shopPumpkin: "бейдж тыква",
    shopShield: "щит стрика · 1 день",
    buy: "купить",
    owned: "куплено",
    shieldHint: "стрик входов не сгорит даже если пропустить день",
    positions: "открытые позиции →",
    signin: "войдите, чтобы открыть кабинет",
    snapshotNote: "сезонный снапшот превращает вес в $NR — активность, стрики и рефералы его поднимают",
    bet: "ставить →",
  },
  /* v13 — лендинг кампании (RU) */
  land: {
    pill: "season 1 идёт",
    h1a: "реал или",
    h1b: "синтик",
    lines: [
      "смотри клип — живая съёмка или машинный сон. без заголовков, без подсказок, без шанса спрятаться.",
      "назови: РЕАЛ или СИНТИК. твои глаза против машины.",
      "ставь 10, 25 или 50 EYE в пари-мьютюэль банк.",
      "вердикт падает меньше чем за минуту. реальность опциональна — выплата нет.",
      "победители делят банк проигравшей стороны. напрямую в твой ledger.",
      "email с паролем — 100 EYE в подарок, один раз.",
      "серии платят: 3/5/7/10 побед подряд — бонусы растут.",
      "$NR получает тот, кто увидел раньше зала. Угадал в конце — почти ноль. Не угадал — ноль. Курс не обещаем.",
    ],
    cta: "назови",
    cta2: "просто смотри ленту",
    lb: "загляни в глаз бога →",
    snapshotIn: "снапшот через 7 дней",
    snapshotOn: "снапшот {d}",
    dayOf: "день {n} из 7",
    finalDay: "финальный день",
  },
  /* v21 — хэллоуин-лендинг: ОДИН экран-минимализм → /auth (судная ночь) */
  hwl: {
    pill: "судная ночь · сезон 1 идёт",
    heroT1: "реал",
    heroT2: "или",
    heroT3: "синтик",
    heroSub: "смотри клип. называй: РЕАЛ или СИНТИК. победители делят банк — меньше чем за минуту.",
    m1: "смотри 15 секунд",
    m2: "называй: реал или синтик",
    m3: "дели банк",
    cta: "играть · +100 EYE в подарок",
    ghost: "просто посмотри ленту",
    fine: "бесплатно · EYE только для игры · выход ценности — снапшот сезона",
  },
  /* v13 — onboarding /bet (RU) */
  onb: {
    kicker: "как это работает",
    s1t: "смотри клип",
    s1d: "кадр без подписей и лайков — только сам шов между живым и машинным",
    s2t: "жми РЕАЛ или СИНТИК",
    s2d: "твой вердикт, сумма 10–50 EYE — ставка падает в общий банк",
    s3t: "войди — дадим монеты",
    s3d: "100 EYE за аккаунт, daily-бонус PASS — ставки идут с внутреннего баланса",
    s4t: "банк делится за минуту",
    s4d: "вердикт падает — победившая сторона делит весь пул",
    next: "дальше",
    start: "начать угадывать",
    skip: "пропустить",
  },
  /* v13 — Daily Challenge + серии (RU) */
  daily: {
    badge: "daily challenge",
    bonus: "выиграй этот — +{N} EYE сверх банка",
    streak: "серия побед",
    streakBonus: "серия ×{n} — бонус +{amt} EYE",
    milestones: "бонусы за 3 / 5 / 7 / 10 побед подряд",
  },
  bet: {
    /* v26 — тизеры: раффл ещё не открыт */
    soonChip: "предсказания скоро",
    soonTitle: "скоро будут доступны предсказания",
    soonNote: "видео уже в ленте — окно ставок откроется здесь совсем скоро",
    inPool: "ТЫ В ПУЛЕ",
    /* v15 — соревнования (первое соревнование) */
    competitionN: "соревнование {n}",
    competitionFirst: "первое соревнование",
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
    /* v14 — карточка раскрытия + пачки */
    yourCall: "твой колл:",
    callAtSec: "верный колл на секунде",
    firstCorrect: "самый ранний верный колл:",
    packsTitle: "глаза кончились — возьми пачку",
    authNeeded: "сначала войди",
    refPage: "реф-ссылка",
    refOff: "процент выключен",
    refOn: "процент включён",
    refUnlockTitle: "включи свои 20%",
    refUnlockBody: "заплати 3 USDT один раз — 20% с каждой пачки, которую купит твой реферал, капает в USDT. С его выигрышей в EYE ты не получаешь ничего — в этом смысл.",
    refPay: "включить · 3 USDT",
    refEarned: "заработано",
    refBurned: "сгорело (до включения)",
    refPaid: "выплачено",
    refPending: "ждёт выплаты (от 5 USDT)",
    refLinkTitle: "твоя ссылка",
    refReffs: "выигрыши твоих рефералов в EYE",
    refNoRefs: "рефералов пока нет — кидай ссылку",
    refCopy: "копировать",
    refCopied: "скопировано",
    bankLive: "банк живой",
    bankFrozen: "шов замер",
    bonus: "бонус",
    accountPass: "аккаунт → PASS",
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
    accountCta: "email + пароль — откроют PASS и ежедневный бонус",
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
    gateNote: "email + пароль — сайт остаётся открыт",
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
