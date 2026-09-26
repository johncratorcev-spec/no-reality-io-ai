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
    q: "What is no reality.?",
    a: "no reality. is an interactive hub of AI content and predictions. It curates a mosaic of short clips where every clip is either REAL footage or a machine dream (AI-generated video). You watch, call REAL or SYNTH, and stake $1–5 on your call — the pari-mutuel pool pays the winning side.",
    ru: {
      q: "Что такое no reality.?",
      a: "no reality. — интерактивный хаб AI-контента и предсказаний. Мы курируем мозаику коротких клипов, где каждый — либо реальная съёмка, либо машинный сон (AI-видео). Ты смотришь, выносишь вердикт РЕАЛ или СИНТИК и ставишь $1–5 — пари-мьютюэль пул платит угадавшей стороне.",
    },
  },
  {
    q: "How does a REAL/SYNTH bet work?",
    a: "Open any clip and the betting round opens with it. Pick REAL or SYNTH, stake $1–5, and the round locks after a short window. When the curator's verdict resolves the round, the pool is split pari-mutuel among winners — the platform keeps a 10% rake, and part of it goes to the clip author and referrers.",
    ru: {
      q: "Как устроена ставка РЕАЛ/СИНТИК?",
      a: "Открой любой клип — вместе с ним открывается раунд ставок. Выбери РЕАЛ или СИНТИК, поставь $1–5, через короткое окно раунд закрывается. Когда кураторский вердикт резолвит раунд, пул делится пари-мьютюэль между угадавшими — платформа держит рейк 10%, часть уходит автору клипа и реферерам.",
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
    q: "What is blind court mode?",
    a: "Blind court is the mosaic with the metadata hidden: titles, authors and mood stickers disappear, so you judge the footage itself, not the packaging. It is the purest test of your eye for synthetic content.",
    ru: {
      q: "Что такое режим слепого суда?",
      a: "Слепой суд — это мозаика со скрытыми метаданными: заголовки, авторы и стикеры настроений исчезают, и ты судишь само изображение, а не упаковку. Это самый чистый тест твоего глаза на синтетику.",
    },
  },
  {
    q: "What are the four mood channels?",
    a: "The mosaic is curated into four moods: swag (machine-made style), creepy (the uncanny valley), future (machine dreams of tomorrow) and ufo (anomalies and skies that lie). Each mood has its own page, its own pool of clips and its own community of judges.",
    ru: {
      q: "Что за четыре канала-настроения?",
      a: "Мозаика курируется по четырём настроениям: свэг (машинный стиль), жуть (зловещая долина), будущее (машинные сны о завтра) и НЛО (аномалии и небеса, которые врут). У каждого настроения своя страница, свой пул клипов и свои судьи.",
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
