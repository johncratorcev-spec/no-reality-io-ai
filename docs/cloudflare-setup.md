# Cloudflare (free) — настройка для no-reality.fun

Task 44, приоритет №1. Всё ниже — на бесплатном тарифе. Код в репозитории
уже готов; здесь — что нажать руками. Порядок ровно как в ТЗ.

---

## 1. Подключить домен (DNS + Proxy)

1. Cloudflare Dashboard → **Add a site** → `no-reality.fun` (план **Free**).
2. Cloudflare сам просканирует DNS. Если домен уже на Vercel — перенесите
   записи:
   - `A` @ → `76.76.21.21` (Vercel), **Proxy: включён (оранжевое облако)**
   - `CNAME` www → `cname.vercel-dns.com`, **Proxy: включён**
   - Прочие записи (MX/TXT почты) — оставить как есть, прокси не трогать.
3. У регистратора домена сменить NS на выданные Cloudflare
   (`xxx.ns.cloudflare.com`). Делегирование подхватится за минуты–часы.
4. Vercel: домен уже привязан к проекту — менять ничего не нужно. В Cloudflare
   SSL/TLS → режим **Full (strict)**.

> Оранжевое облако = трафик идёт через границу CF. Vercel этого не боится,
> но если появятся циклы редиректов — переключить SSL на Full и включить
> «Always Use HTTPS».

## 2. Cache Rules (Caching → Cache Rules)

Три правила, сверху вниз (порядок важен):

| # | Имя | Условие | Действие |
|---|-----|---------|----------|
| 1 | **Bypass HTML + API** | `Hostname eq no-reality.fun` AND (URI Path **not** starts with `/_next/static/`) AND (URI Path **not** starts with `/images/`) AND (URI Path **not** starts with `/sfx/`) AND (URI Path **not** starts with `/partner/`) | **Bypass cache** |
| 2 | **Static immutable** | URI Path starts with `/_next/static/` | **Eligible for cache**, Edge TTL: respect origin (origin шлёт `immutable, 1 год`), Browser TTL: respect origin |
| 3 | **Ignore tracking params** | Applying to rules 1–2: в **Cache key** → Query String → **Ignore query string** — либо, точнее, *Exclude* параметры `utm_*`, `ref`, `fbclid`, `gclid`, `sp_*` |

Пояснения:
- HTML фида (лента динамическая) и всё `/api/*` — всегда bypass: ставки,
  сессии и статистика не должны попадать в кэш.
- `/_next/static` уже отдаётся с `Cache-Control: immutable` из
  `next.config.ts` — CF просто уважает заголовок.
- Игнор `utm_*`/`fbclid` в cache key: один и тот же бандл отдаётся
  независимо от рекламных меток (иначе кэш распухает от мусора).
  Атрибуция это не ломает: метки читает браузер, не CDN.

## 3. Worker для /r/[code] (быстрый 302 + асинхронный клик)

Код готов: `cloudflare/r-worker/`. Деплой с любой машины:

```bash
npm i -g wrangler
cd cloudflare/r-worker

# 1) KV для кэша назначений
wrangler kv namespace create POST_URLS
# → вставить полученный id в wrangler.toml (REPLACE_WITH_KV_NAMESPACE_ID)

# 2) секрет для записи кликов — ТОТ ЖЕ, что в Vercel env CLICK_WORKER_SECRET
wrangler secret put CLICK_WORKER_SECRET

# 3) задеплоить
wrangler deploy
```

Как работает (экономия latency):
- 302 отдаётся **с границы** из KV за доли мс (origin не ждём);
- назначение берётся из `GET /api/r-lookup/[code]` (JSON из CSV-кэша, без БД)
  и кэшируется в KV на 1 час;
- клик дописывается **асинхронно** (`ctx.waitUntil`) в существующую БД через
  `POST /api/track/click` — тот же `Click` + `PostStats`, тот же дедуп
  `unique(utmCode, visitorHash)`, рейтинг не ломается;
- неизвестные коды проксируются на origin `/r/[code]` (честные 404).

Включение приёма кликов на стороне сайта — env в Vercel:

```
FEATURE_CLICK_WORKER=1
CLICK_WORKER_SECRET=<секрет из шага 2>
```

Пока env не выставлены, `/api/track/click` отвечает 501, а `/r/[code]`
работает по-старому — ничто не ломается на переходном этапе.

## 4. Web Analytics

1. Cloudflare → **Analytics & Logs → Web Analytics** → Add a site →
   `no-reality.fun` → скопировать **token**.
2. Vercel env: `NEXT_PUBLIC_CF_BEACON_TOKEN=<token>` → redeploy.
   Beacon подключён в `layout.tsx` за флагом: без токена скрипт не грузится.
3. Опционально выключить автоматическую минификацию email — не требуется,
   beacon не конфликтует с Vercel Analytics (счётчики можно вести параллельно).

## 5. KV — где реально даёт выигрыш

- **Worker /r/**: кэш назначений редиректов (шаг 3) — главный выигрыш.
- Magic Link токены намеренно живут в SQLite (один источник правды с
  сессиями); переезд в KV имеет смысл только если БД начнёт упираться.
- Счётчик избранного кэшируется in-memory на сервере (30с) — KV не нужен.

## 6. Чек-лист после включения

- [ ] `curl -I https://no-reality.fun/` → `cf-ray` присутствует
- [ ] `curl -I https://no-reality.fun/_next/static/<любой чанк>` →
      `cf-cache-status: HIT` после второго запроса
- [ ] `curl -I https://no-reality.fun/api/posts` → `cf-cache-status: DYNAMIC|BYPASS`
- [ ] клик по `/r/<code>` → 302 мгновенно; в БД появился `Click`
- [ ] Web Analytics показывает pageviews
