/**
 * FAQ хаба (v3) — единый источник для UI лендинга и JSON-LD.
 * EN — язык структурированных данных (Google/AI-движки),
 * RU — локализованная пара для интерфейса.
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
    a: "Accounts with EYE and at least 5 valid (settled) bets during the season. Accounts that only claimed the welcome bonus and never bet are excluded, same as obvious duplicates. The weight formula is fixed for the whole season: weight = eye * min(1, valid_bets / 10). Rules will not change mid-season.",
    ru: {
      q: "Кто попадает в снапшот?",
      a: "Аккаунты с EYE и минимум 5 валидными (засчитанными) ставками за сезон. Аккаунты «только welcome и 0 ставок» и явные дубли отсеваются. Формула веса зафиксирована на весь сезон: weight = eye * min(1, valid_bets / 10). Правила в середине сезона не меняются.",
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
    a: "no reality. is a curation project and prediction game for AI video. It runs two feeds: the feed — an endless stream of curated AI clips you can just watch — and the raffles, where every clip is either REAL footage or a machine dream. You call REAL or SYNTH and stake 10–50 EYE — the pari-mutuel pool pays the winning side.",
    ru: {
      q: "Что такое no reality.?",
      a: "no reality. — проект-кураторство и игра-предсказание вокруг AI-видео. На сайте две ленты: лента — бесконечный поток курируемых AI-клипов, просто смотри; и рафлы, где каждый клип — либо реальная съёмка, либо машинный сон. Ты выносишь вердикт РЕАЛ или СИНТИК и ставишь 10–50 EYE — пари-мьютюэль пул платит угадавшей стороне.",
    },
  },
  {
    q: "How does a REAL/SYNTH bet work?",
    a: "Open any clip and the betting round opens with it. Pick REAL or SYNTH, stake 10–50 EYE, and the round locks after a short window. When the curator's verdict resolves the round, the pool is split pari-mutuel among winners — the platform keeps a 10% rake, and part of it goes to the clip author and referrers.",
    ru: {
      q: "Как устроена ставка РЕАЛ/СИНТИК?",
      a: "Открой любой клип — вместе с ним открывается раунд ставок. Выбери РЕАЛ или СИНТИК, поставь 10–50 EYE, через короткое окно раунд закрывается. Когда кураторский вердикт резолвит раунд, пул делится пари-мьютюэль между угадавшими — платформа держит рейк 10%, часть уходит автору клипа и реферерам.",
    },
  },
  {
    q: "Do I need a wallet to watch or bet?",
    a: "Watching is free and needs nothing. A bet opens a crypto invoice through 2328.io — pay it from any wallet, and your winnings accumulate on the platform until you request a cashout to your own wallet. No wallet is forced on you until you actually withdraw.",
    ru: {
      q: "Нужен ли кошелёк, чтобы смотреть или ставить?",
      a: "Смотреть бесплатно и без всего. Ставка открывает крипто-инвойс через 2328.io — оплати с любого кошелька, выигрыши копятся на платформе, пока ты не закажешь кэшаут на свой кошелёк. Кошелёк не навязывается до самого вывода.",
    },
  },
  {
    q: "What are the raffles?",
    a: "The raffles are blind prediction rounds: titles and authors are hidden, so you judge the footage itself, not the packaging. Call REAL or SYNTH, stake 10–50 EYE and split the bank when the verdict lands. It is the purest test of your eye for synthetic content.",
    ru: {
      q: "Что такое рафлы?",
      a: "Рафлы — слепые раунды-предсказания: заголовки и авторы скрыты, ты судишь само изображение, а не упаковку. Вынеси вердикт РЕАЛ или СИНТИК, поставь 10–50 EYE и дели банк, когда упадёт вердикт. Это самый чистый тест твоего глаза на синтетику.",
    },
  },
  {
    q: "How does the referral program work?",
    a: "Every deep link you share can carry your invite code. When someone you brought stakes on a clip, you receive 20% of the platform's rake from that bet — for as long as they play. Attribution lives for 90 days and survives across devices via the invite link.",
    ru: {
      q: "Как работает реферальная программа?",
      a: "Каждый deep-link, которым ты делишься, может нести твой код приглашения. Когда приведённый тобой человек ставит на клип, ты получаешь 20% рейка платформы с этой ставки — всё время, пока он играет. Атрибуция живёт 90 дней и переживает смену устройства через ссылку-приглашение.",
    },
  },
  {
    q: "Is the answer revealed before the round resolves?",
    a: "Never. The curator's verdict (real or synth) never reaches your browser before the round resolves — it lives server-side, so no amount of page-source digging reveals the answer. The seam stays sealed until the bank opens.",
    ru: {
      q: "Раскрывается ли ответ до резолва раунда?",
      a: "Никогда. Кураторский вердикт (реал или синтик) не попадает в твой браузер до резолва раунда — он живёт на сервере, поэтому покопаться в исходниках страницы не поможет. Шов запечатан, пока банк не откроется.",
    },
  },
];
