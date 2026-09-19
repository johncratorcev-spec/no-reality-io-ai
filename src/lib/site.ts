/**
 * Единая точка правды о проекте: имя, домен, соцсети, слоганы.
 *
 * Зачем одним файлом: домен и хэндлы соцсетей нужны в трёх местах —
 * метаданные лендинга, JSON-LD для поисковиков и карточки соцсетей.
 * Правится в одном месте, без поиска по кодовой базе.
 */
export const SITE = {
  name: "no reality.",
  url: "https://no-reality.fun",
  tagline: "your only limit is mind",
  title: "no reality. — AI Video Feed & Prompt Marketplace",
  description:
    "no reality. is a curated discovery feed of AI-generated video from Threads — swag, creepy, welcome-to-the-future. Watch the feed, share deep links and unlock the exact prompts: creators keep 75%.",
} as const;

export const SOCIALS = [
  {
    key: "instagram",
    label: "Instagram",
    handle: "@your_betfriend",
    url: "https://www.instagram.com/your_betfriend",
    blurb: "Behind-the-scenes stills, moodboards and drop announcements.",
  },
  {
    key: "threads",
    label: "Threads",
    handle: "@your_betfriend",
    url: "https://www.threads.com/@your_betfriend",
    blurb: "Where the raw feed lives — follow the source of the signal.",
  },
  {
    key: "telegram",
    label: "Telegram",
    handle: "@your_betfriend",
    url: "https://t.me/your_betfriend",
    blurb: "Daily best-of clips, prompt giveaways and the crew’s notes.",
  },
] as const;

/**
 * Prompt drop — одноразовая продажа промпта персонажа из коллаб-видео
 * (чёрный кот в толстовке «LOKI»). Модель «flash drop»: инвойс на фикс.
 * цену, после оплаты промпт показывается revealSeconds секунд и исчезает.
 *
 * Stateless (как донат): состояние инвойса живёт у 2328.io — ни БД, ни
 * /tmp. Текст промпта живёт только в env PROMPT_LOKI_FLASH (в гит не
 * попадает): пока env не задан, чекаут отдаёт 503 и никто не платит зря.
 */
export const PROMPT_DROP = {
  /** наш внутренний код продукта (в orderId не участвует) */
  code: "loki-hoodie",
  /** после какого поста ленты вставлять рекламную карточку */
  afterUtm: "71vsIPUu",
  priceUsdt: "100.00",
  /** кадр персонажа, вырезанный из коллаб-видео (13.4s) */
  image: "/images/loki-prompt.webp",
  /** сколько секунд показывать промпт после подтверждения оплаты */
  revealSeconds: 60,
} as const;

/**
 * Prompt Market — витрина продажи промптов (/market).
 * Пока в витрине один товар — PROMPT_DROP (loki-hoodie);
 * новые дропы просто добавляются в MARKET.items.
 */
export const MARKET = {
  /** путь витрины (для ссылок из хедера/лендинга/карточек) */
  path: "/market",
  /** якорь карточки loki внутри витрины — «ссылка на саму карточку» */
  itemAnchor: "loki-hoodie",
} as const;

/**
 * Реферальная модель: если кто-то оплатил по приглашению —
 * пригласивший получает долю от суммы оплаченного инвойса.
 *
 * Как работает (MVP, без БД-зависимости для атрибуции):
 *  1) подключивший MetaMask кошелёк получает детерминированный код
 *     ref = f(wallet) (src/lib/referral.ts) — одинаковый на всех устройствах;
 *  2) приглашение = ссылка с ?ref=<code> — код ловится на клиенте
 *     и живёт в localStorage (90 дней, last-touch);
 *  3) при чекауте код уходит на сервер и ВШИВАЕТСЯ в orderId
 *     (pd-<id>-<ref>) — 2328.io хранит orderId у себя в платёжe,
 *     поэтому атрибуция не теряется даже без нашей БД;
 *  4) факт оплаты → ReferralEvent в БД (best-effort) + ручная
 *     выплата по реестру /api/admin/referrals?key=…
 */
export const REFERRAL = {
  /** доля рефереру от суммы оплаченного инвойса (env REFERRAL_RATE_PCT перекрывает) */
  defaultRatePct: 0.2,
  /** сколько живёт атрибуция в localStorage, дней */
  attributionDays: 90,
  /** ключ localStorage с кодом пригласившего */
  storageKey: "nr-ref",
  /** формат приглашальной ссылки */
  invitePath: "/market",
} as const;

/**
 * Партнёр недели: кастомный блок на лендинге (#partner).
 * Меняется раз в неделю правкой этого объекта — оформление подставится само.
 */
export const PARTNER_OF_WEEK = {
  week: "this week’s partner",
  name: "paw crew daily",
  handle: "@pawcrewdaily",
  url: "https://www.instagram.com/pawcrewdaily?stkn=MTR0eDRnYTVqaDhtMw==",
  kind: "cats, every single day",
  blurb:
    "A daily dose of dopamine from the fluffiest crew on Instagram — the team curates the most expressive cats on the planet while we curate the machines that dream. Different feed, same obsession: catching the perfect frame.",
  /** посты партнёра с крипто-донатом: pin 1 (главное видео коллаба) + pin 2 (пилот) — на обоих мяукает переход */
  donatePostUtms: ["71vsIPUu", "TK4_0wTI"] as readonly string[],
  /** пресеты крипто-доната (USDT) на постах партнёра — пилот 2328.io */
  donatePresetsUsdt: ["1.00", "3.00", "5.00"],
  /**
   * Благотворительная акция: все донаты — приютам для котиков.
   * Донат «закрыт» до момента openingAtUtc: на постах тикает таймер,
   * клик по кнопке/чипу открывает модалку с отсчётом и историей акции.
   * Когда время выйдет — кнопка открывает обычный донат-флоу.
   */
  charityDrive: {
    /** момент открытия доната в UTC (ISO) — 24 часа от запуска */
    openingAtUtc: "2026-09-18T06:00:00Z",
    eyebrow: "charity drive",
    title: "every paw counts",
    body: "we’re running a charity drive: every crypto donation on this post goes straight to cat shelters — food, warm beds, litter and vet care for cats waiting for their human.",
    badge: "100% goes to shelters",
    steps: [
      { icon: "heart", text: "you donate crypto" },
      { icon: "coins", text: "2328.io settles it" },
      { icon: "home", text: "shelters get supplies" },
    ],
    cta: "donate now",
    lockedCta: "donations open soon",
  } as {
    openingAtUtc: string;
    eyebrow: string;
    title: string;
    body: string;
    badge: string;
    steps: readonly { icon: "heart" | "coins" | "home"; text: string }[];
    cta: string;
    lockedCta: string;
  },
} as const;
