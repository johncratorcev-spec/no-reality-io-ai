/**
 * Единая точка правды о проекте: имя, домен, соцсети, слоганы.
 *
 * Зачем одним файлом: домен и хэндлы соцсетей нужны в трёх местах —
 * метаданные лендинга, JSON-LD для поисковиков и карточки соцсетей.
 * Правится в одном месте, без поиска по кодовой базе.
 */
export const SITE = {
  name: "no reality.",
  url: "https://no-reality.io",
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
  /** их пост с крипто-донатом (сейчас pin 2; pin 1 — главное видео коллаба) */
  partnerPostUtm: "TK4_0wTI",
  /** пресеты крипто-доната (USDT) на пост партнёра — пилот 2328.io */
  donatePresetsUsdt: ["1.00", "3.00", "5.00"],
  /**
   * Благотворительная акция: все донаты — приютам для котиков.
   * Таймер 72ч убран по решению пользователя; осталась история
   * «куда идут деньги» (модалка с кнопки/строки в донат-карточке).
   */
  charityDrive: {
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
  } as {
    eyebrow: string;
    title: string;
    body: string;
    badge: string;
    steps: readonly { icon: "heart" | "coins" | "home"; text: string }[];
    cta: string;
  },
} as const;
