# Кэширование v7 — Vercel сейчас, Supabase как задел

## Где что кэшируется

### 1. Edge/CDN (Vercel, Cloudflare, Netlify) — header'ы в `next.config.ts`

| Путь | Cache-Control | Зачем |
|------|---------------|-------|
| `/_next/static/*` | `public, max-age=31536000, immutable` | хэшированные бандлы |
| `/images|sfx|partner/*` | `max-age=604800, stale-while-revalidate=86400` | ассеты |
| `/api/posts` | `public, s-maxage=60, stale-while-revalidate=300, max-age=15` | единственный «контентный» API: edge держит 60с, браузер 15с, фоновое обновление 5 мин |
| остальные `/api/*` | `no-store` | ставки/сессии/деньги — никогда |
| `/admin/*` | CSP `frame-ancestors *` | white-label iframe |
| всё остальное | CSP `frame-ancestors 'self'` + nosniff/referrer/permissions | базовая защита |

HTML Next отдаёт сам (страницы динамические) — в Cloudflare достаточно
Cache Rule «Bypass для HTML» (см. docs/cloudflare-setup.md). На Vercel
`s-maxage` подхватывается автоматически — настроек не требует.

### 2. Серверный TTL-кэш — `src/lib/cache.ts`

Горячие чтения (обогащение постов рейтингом, сводки) идут через
`cacheWrap(key, ttlSec, fn)`:

- **memory** (по умолчанию): LRU на 500 ключей, нулевые задержки.
- **supabase** (активируется тремя env): REST-адаптер на PostgREST,
  кэш живёт в таблице и переживает рестарты/регионы.

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only, никогда не NEXT_PUBLIC
SUPABASE_CACHE_TABLE=cache         # опц., по умолчанию "cache"
```

Таблица (один раз выполнить в SQL-редакторе Supabase):

```sql
create table if not exists cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);
alter table cache enable row level security;
-- RLS без политик = писать может только service_role — то, что нужно
```

Без env-ключей адаптер не включается ни при каких условиях; при недоступности
Supabase `cacheWrap` молча деградирует в miss (запрос не роняется никогда).

### 3. Прочие кэши, уже живущие в коде

- `lib/csv.ts` — парс posts.csv по mtime (снапшот-фолбэк на serverless);
- `lib/favstats.ts` — счётчики избранного, in-memory 30с;
- `lib/posts.snapshot.ts` — встроенная копия CSV на случай FS-недоступности.

## Что сознательно НЕ кэшируется

`/api/me`, `/api/bet`, `/api/wallet/deposit`, `/api/webhooks/2328`,
`/api/admin/*`, `/api/reward/*` — деньги и сессии. Внутренний баланс —
источник истины в LedgerTxn; любой кэш здесь = риск рассинхрона.
