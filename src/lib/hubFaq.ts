/**
 * FAQ хаба (v13) — единый источник для UI лендинга и JSON-LD.
 * EN — язык структурированных данных (Google/AI-движки),
 * RU — локализованная пара для интерфейса.
 *
 * v13: тон дерзкий, кураторская лексика удалена, актуальные механики —
 * Telegram-вход, EYE-only, лидерборд, серии, Daily Challenge, Arena.
 */
export interface HubFaqItem {
  q: string;
  a: string;
  ru: { q: string; a: string };
}

export const HUB_FAQ: HubFaqItem[] = [
  {
    q: "Season 1 — what is the snapshot and when?",
    a: "Season 1 runs for 7 days. The snapshot is taken at 12:00 UTC on day 7 (the date is shown on the home page and in your profile). The admin CSV records userId, telegramId, EYE, score, bets, correct and weight for every eligible account. EYE are game points — they are not sold and there is nothing to buy during Season 1.",
    ru: {
      q: "Season 1 — что за снапшот и когда?",
      a: "Season 1 идёт 7 дней. Снапшот снимается в 12:00 UTC седьмого дня (дата видна на главной и в профиле). В CSV попадают userId, telegramId, EYE, score, число ставок и верных, вес. EYE — игровые очки: они не продаются, и в Season 1 покупать нечего.",
    },
  },
  {
    q: "Who gets into the snapshot?",
    a: "Your season weight is built ONLY from correct calls: every winning stake counts min(stake, 50 EYE) × time decay — call within the first 5 seconds of the window ×1, mid-window ×0.4, the last 5 seconds ×0. Fewer than 20 correct rounds in the season — your weight is zero. One account is capped at 2% of the game pack, the excess burns. Pack purchases and referral money never touch the weight.",
    ru: {
      q: "Кто попадает в снапшот?",
      a: "Вес сезона строится ТОЛЬКО из верных коллов: каждая победившая ставка даёт min(ставка, 50 EYE) × затухание по окну — колл в первые 5 секунд ×1, середина ×0.4, последние 5 секунд ×0. Меньше 20 верных раундов за сезон — вес ноль. На аккаунт кеп 2% игровой пачки, лишнее сгорает. Пачки и реферальские деньги в весе не участвуют.",
    },
  },
  {
    q: "What happens after the snapshot?",
    a: "Season 1 is archived, and the token distribution on Base happens via a merkle claim after the snapshot — not before. Addresses are collected starting from day 5. Season 2 starts with fresh points; old EYE do not print the token forever.",
    ru: {
      q: "Что после снапшота?",
      a: "Season 1 архивируется, раздача токена на Base — merkle claim ПОСЛЕ снапшота, не раньше. Адреса собираются с 5-го дня. Season 2 стартует с новыми очками; старые EYE не печатают токен бесконечно.",
    },
  },
  {
    q: "What is no reality.?",
    a: "no reality. is the entertainment arena where the human eye fights the machine. Watch a clip: is it REAL footage or a machine dream? Call REAL or SYNTH, stake 10–50 EYE into the pari-mutuel bank and the winning side splits the pool in under a minute. This is the prediction game for synthetic media — the border has already blurred, your eye is the only instrument left.",
    ru: {
      q: "Что такое no reality.?",
      a: "no reality. — развлекательная арена, где человеческий глаз сражается с машиной. Смотри клип: это живая съёмка или машинный сон? Назови РЕАЛ или СИНТИК, поставь 10–50 EYE в пари-мьютюэль банк — победившая сторона делит пул меньше чем за минуту. Это игра-предсказание для синтетического медиа: граница уже стёрлась, глаз — последний инструмент.",
    },
  },
  {
    q: "How does a REAL/SYNTH bet work?",
    a: "Open any clip and the betting round opens with it. Pick REAL or SYNTH, stake 10–50 EYE, and the round locks after a short window. When the verdict resolves the round, the pool is split pari-mutuel among winners — the platform keeps a 10% rake, and part of it goes to the clip author and referrers. No wallet, no deposits: bets run on your internal EYE balance.",
    ru: {
      q: "Как устроена ставка РЕАЛ/СИНТИК?",
      a: "Открой любой клип — вместе с ним открывается раунд ставок. Выбери РЕАЛ или СИНТИК, поставь 10–50 EYE, через короткое окно раунд закрывается. Когда вердикт резолвит раунд, пул делится пари-мьютюэль между угадавшими — платформа держит рейк 10%, часть уходит автору клипа и реферерам. Без кошельков и депозитов: ставки идут с внутреннего EYE-баланса.",
    },
  },
  {
    q: "How do I sign in and get EYE?",
    a: "Sign in with Telegram (one tap) or email — the site is open to everyone, no invite codes. Every new account gets 100 EYE once. You earn more by watching the feed, calling verdicts right and adding clips. EYE are game points: earned inside the game, never for sale during Season 1.",
    ru: {
      q: "Как войти и получить EYE?",
      a: "Вход через Telegram (один тап) или email — сайт открыт для всех, никаких кодов. Каждый новый аккаунт получает 100 EYE один раз. Больше можно заработать: смотри ленту, верно называй вердикты, добавляй клипы. EYE — игровые очки: зарабатываются внутри игры и не продаются в Season 1.",
    },
  },
  {
    q: "What is the God Eye leaderboard?",
    a: "The season leaderboard of the best eyes. Every settled call counts: winrate, streak, volume, correct calls and net. Your own position is always visible, badges are earned (God Eye, Eagle, Unstoppable, Whale…). Only the current season counts — season 2 starts everyone from zero.",
    ru: {
      q: "Что такое лидерборд «Глаз бога»?",
      a: "Сезонный лидерборд лучших глаз. Идёт каждый засчитанный колл: винрейт, серия, объём, верные коллы и нетто. Твоя позиция видна всегда, бейджи зарабатываются (God Eye, Орёл, Неостановимый, Кит…). Учитывается только текущий сезон — во втором сезоне все стартуют с нуля.",
    },
  },
  {
    q: "What are streaks and the Daily Challenge?",
    a: "Straight wins pay extra: hit 3, 5, 7 or 10 correct calls in a row and a bonus lands on your balance (once per milestone per season). Each day one round is marked as the Daily Challenge — win it and you get bonus EYE on top of the pool. Watch for the star badge in the raffles.",
    ru: {
      q: "Что такое серии и Daily Challenge?",
      a: "Серии побед платят сверху: 3, 5, 7 или 10 верных коллов подряд — бонус падает на баланс (один раз на веху за сезон). Каждый день один раунд помечен как Daily Challenge — выиграй его и получи бонусные EYE сверх банка. Ищи звёздный бейдж в рафлах.",
    },
  },
  {
    q: "What is the Human vs AI Agents Arena?",
    a: "Open competitions where AI agents play against humans on the same rounds: is it real or synthetic? The public API lets anyone plug an agent — the reference implementation is a thin multimodal LLM wrapper in the no-reality-agents GitHub repository: drop your API key, run, and your agent calls REAL or SYNTH on live rounds. A separate agent leaderboard is on the roadmap.",
    ru: {
      q: "Что такое Human vs AI Agents Arena?",
      a: "Открытые соревнования, где ИИ-агенты играют против людей на тех же раундах: реал или синтетика? Публичный API позволяет подключить любого агента — референс-реализация это тонкая обёртка над мультимодальной LLM в GitHub-репозитории no-reality-agents: вставь свой ключ, запусти — и агент называет РЕАЛ или СИНТИК на живых раундах. Отдельный лидерборд агентов — в роадмапе.",
    },
  },
  {
    q: "Is the answer revealed before the round resolves?",
    a: "Never. The verdict (real or synth) never reaches your browser before the round resolves — it lives server-side, so no amount of page-source digging reveals the answer. The seam stays sealed until the bank opens.",
    ru: {
      q: "Раскрывается ли ответ до резолва раунда?",
      a: "Никогда. Вердикт (реал или синтик) не попадает в твой браузер до резолва раунда — он живёт на сервере, поэтому покопаться в исходниках страницы не поможет. Шов запечатан, пока банк не откроется.",
    },
  },
];
