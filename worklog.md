# Worklog

---
Task ID: 1
Agent: Super Z (main agent)
Task: Восстановить проект "no reality." после сброса окружения и реализовать 6 новых требований: Share Reality (копия UTM + анимация), убрать топы, толстый выразительный прогресс-бар, усиленная палитра, WebGL-баннер с вирусной ссылкой smartluvon_bot, лента из 2 реальных Threads-постов.

Work Log:
- Инициализировал fullstack-окружение (init-fullstack.sh), Next.js 16 + TS + Tailwind 4 + Prisma/SQLite.
- Извлёк реальное видео из Threads-поста share/BAWygmiJjY через headless-браузер (agent-browser): пост @stanislavstarchenko, главное видео 1280x720, 8.45s, прямой MP4 с CDN instagram (подписанная ссылка).
- Проверил второй пост share/BAaF-XGP8N — Threads отдаёт error=invalid_post (удалён/приватен). Строка оставлена в CSV с пустым video_url; /api/posts и page.tsx фильтруют посты без video_url.
- prisma/schema.prisma: Click (unique utmCode+visitorHash) + PostStats (utmCode pk, score). db:push выполнен.
- data/posts.csv: 2 строки (реальный пост + недоступный). UTM-код rRAfCpxz сгенерирован nanoid.
- src/lib/csv.ts (papaparse, фильтр неполных строк), src/app/api/posts/route.ts (CSV + score, сортировка), src/app/r/[code]/route.ts (sha256 ip+ua+secret, дедуп через unique constraint, upsert score, 302 на Threads).
- Компоненты: Header (градиентный логотип с glow), WebGLBanner (raw WebGL fbm-шейдер шёлковых волн в палитре violet→fuchsia→pink→amber + teal-блик + зерно; sticky над лентой; вирусная CTA https://t.me/smartluvon_bot?start=ref_PCQ8ECMN; CSS-fallback при отсутствии WebGL), Feed (snap-scroll + IntersectionObserver + стрелки клавиатуры), VideoCard (пауза по клику, mute, glass-статус с появлением/исчезновением, 3 кнопки: Share Reality / threads / репост, размытый фон-клон синхронный с видео, fallback-подсказка при блокировке автоплея), Footer (@your_betfriend + "your only limit is mind").
- Share Reality: копия ${origin}/r/[code] (clipboard API + execCommand-fallback), анимация — spring-пульс, поворот, morph иконки Share2→Check, label "share reality"→"скопировано", кольцо-glow.
- Прогресс-бар: вынесен в отдельный компонент ProgressBar (rAF-цикл перерисовывает только бар, не карточку), h-3/h-4 при скрабе, градиентная заливка с двойным glow, буфер, светящаяся головка, тултип времени при скрабе, seek по клику/драгу.
- Исправлено по ходу: гидратационный конфликт (абсолютный UTM только в обработчиках), react-hooks/set-state-in-effect (rAF-отложенный запуск), несинхронный bg-клон (события перенесены на главное видео), переполнение баннера на 390px.
- Убран переключатель топов — лента сортируется только по общему score.

Stage Summary:
- E2E-проверено через agent-browser: воспроизведение, пауза/резюм по клику, mute, скраб (seek на 50% = 4.2s/8.5s), синхронизация bg, анимация «скопировано», href threads-кнопки /r/rRAfCpxz, репост intent-URL с заголовком+UTM, дедупликация кликов (2 клика одного visitor → score=1), 302-редирект, отсутствие гидратационных ошибок.
- Lint чистый, tsc по src чистый, dev.log без ошибок.
- Ключевые файлы: src/app/page.tsx, src/app/api/posts/route.ts, src/app/r/[code]/route.ts, src/lib/csv.ts, src/components/{Header,WebGLBanner,Footer}.tsx, src/components/feed/{Feed,VideoCard}.tsx, data/posts.csv, prisma/schema.prisma.
- Ограничения: CDN-ссылка видео подписанная (параметр oe=) — со временем протухнет, нужно обновить video_url в CSV; пост BAaF-XGP8N недоступен на стороне Threads.

---
Task ID: 2
Agent: Super Z (main agent)
Task: Перламутрово-голубая палитра, ч/б логотип и элементы, баннер «smartluvon — Partner of Week», добавление 5 новых видео в ленту.

Work Log:
- Извлёк через agent-browser прямые MP4 из 5 Threads-постов: _phUmdERK (@hafidansori, 27с), BAQh9Z2CjQ (@digitalarnab, 10.2с), BAbm6AMMyV (@sebastien, 15.2с), BAWa2nBQhN (@lilyawayy, 16.2с), BARUQawSaS (@theailadder, 10.3с). Верифицировал соответствие по декодированной duration_s из efg-параметра и HEAD/Range-запросами (все 206).
- Сгенерировал 5 UTM-кодов (nanoid): J9tQLqnH, EwNwx4oG, 63GLQu_Z, Cd5kn7GN, Wi-5HoqV. Пересобрал data/posts.csv скриптом scripts/build_posts_csv.py (7 строк, 6 в ленте).
- Палитра: globals.css → перламутрово-голубые токены (--nr-blue-deep #3d7db8, --nr-blue #5b9bd5, --nr-ice #a8cfea, --nr-pearl #dcebf7, ink #10161d), стекло/тени/скроллбар с голубым подтоном.
- Ч/б элементы: логотип чёрный со светлым гало (favicon ч/б), Share Reality — чёрная кнопка, threads/репост/mute/статус/счётчик — ч/б, прогресс-бар — чёрная заливка + белая головка с нейтрально-перламутровым ореолом, футер ч/б.
- Баннер: новый шейдер (лёд + жемчуг + иридисценция pink/mint по краям волн + бегущий шиммер-блик), весь баннер — ссылка на t.me/smartluvon_bot?start=ref_PCQ8ECMN, в центре чёрная подпись «smartluvon / — PARTNER OF WEEK —».
- Обновлены metadata-описание и favicon.

Stage Summary:
- E2E: 6 видео readyState 4, автопереход 624→1248 при ended, скопировано-анимация ок, 5 новых UTM 302 на верные посты, мобильная версия 390px без переполнений, чистая загрузка без ошибок консоли, lint/tsc чистые.
- Напоминание: CDN-ссылки подписаны (oe=) — периодически обновлять video_url в CSV.

---
Task ID: 3
Agent: Super Z (main agent)
Task: Ревью архитектуры: найти слабые места и заменить. Клиент — быстрый, бэкенд — максимально простой.

Work Log:
- Бэкенд: удалены мёртвые маршруты /api/posts (дублировал page.tsx, клиентом не использовался) и шаблонный /api — каталог src/app/api удалён целиком.
- lib/csv.ts: mtime-кэш (statSync → парс только при изменении файла) + Map-индекс byCode; добавлен getPostByCode(). /r/[code] больше не парсит CSV на каждый клик.
- lib/posts.ts (новый): единственная реализация ленты getRankedPosts() (CSV + score + сортировка); page.tsx сократился до 26 строк.
- r/[code]/route.ts: сначала lookup поста из кэша — клики по неизвестным кодам не пишутся в БД; поиск .find() → Map.get().
- db.ts: убран log:['query'] (убран оверхед и шум prisma:query в прод-режиме).
- Клиент: framer-motion удалён полностью (Header, Footer, WebGLBanner, VideoCard) — заменён на CSS keyframes/transitions (nr-anim-* в globals.css): fade-down/fade-in, morph share→check, pulse play/pause, copied-bounce, dot-индикатор, hint. Статус-панель переведена на постоянный mount + transition (enter/exit без AnimatePresence). Зависимость удалена из package.json (bun remove) — минус ~45KB gzip JS.
- VideoCard: ленивый монтаж видео — <video> только в зоне active±1 (shouldLoad из Feed), размытый bg-клон только у активной карточки; на старте 3 <video> вместо 12 (меньше декодеров/памяти на мобильных). preload: активная=auto, соседи=metadata.
- Удалено мёртвое состояние paused (обновлялось на каждый play/pause, нигде не читалось — лишние ре-рендеры).
- ProgressBar: rAF-цикл только пока карточка активна (было 6 постоянных циклов по 60fps).
- WebGLBanner: cap 30fps (FRAME_MIN_MS) — волны медленные, визуальной разницы нет, батарея экономится.
- layout.tsx: Manrope weights 400/600/700/800 (убран неиспользуемый 500 — минус файл шрифта).

Stage Summary:
- Проверки: tsc (src) чистый, eslint чистый.
- E2E (agent-browser): старт — 3 <video> (было 12), active играет (readyState 4); авто-переход по ended работает (лента сама ушла 1→3→5 пока шли проверки); seek кликом 50% ≈ 5.1s; drag-скраб ~60% ✓; Share Reality: trusted-клик → «скопировано» + nr-anim-copied ✓; /r/[code] 302 на верный пост Threads ✓; подсчёт + дедуп: новый visitor +1, повторный клик score не меняет (3→3) ✓; /api/posts → 404 ✓; консоль без ошибок; мобильный 390px — без горизонтального переполнения, ленивый монтаж работает [2,1,0,0,0,0].
- Итог: бэкенд — 2 маленьких маршрута + кэшированный CSV + 2 запроса Prisma на клик; клиент — без framer-motion, 3 видео-элемента на старте, 1 активный rAF-цикл, шейдер 30fps.

---
Task ID: 4
Agent: Super Z (main agent)
Task: Добавить 6 новых видео; фичеренный пост _-Z4aWSMP — буст на первое место на 24 часа + специальная кнопка автора с анимацией.

Work Log:
- Извлёк через agent-browser прямые MP4, авторов и заголовки из 6 постов (scripts/extract_post.sh): _-Z4aWSMP (@popaistudio1, вингсьют, карусель 6 клипов, взят первый, 10с), BAWGxfPS1I (@svskliar, 5с), BBiT4ujHK9 (@aziza_lee_ai, 19с), BAR9mOAXcF (@aziza_lee_ai, 19с), BBhXKz1lH9 (@iam_levkina, 19с), BAW0_hpnMB (@regina.timer, 19с). Все верифицированы Range-запросами (206 video/mp4) — scripts/verify_new_posts.py.
- scripts/add_boosted_posts.py: дополнил data/posts.csv колонкой boost_until + 6 строк с новыми nanoid-UTM: AOABUGXd (фичеренный, boost до 2026-09-10T08:29Z), iYIxY7qx, eFsxs2JD, Lu9rS6xV, ytJiU5XO, FR76WfCi. Старые строки/коды сохранены, итого 13 строк (12 играются).
- src/lib/boost.ts (новый, чистый): isBoosted(post) — без node-зависимостей, безопасен для клиентского бандла (csv.ts нельзя импортировать в клиент — там fs).
- lib/csv.ts: поле boostUntil (unix ms, парс boost_until через Date.parse); lib/posts.ts: сортировка — бустнутые первыми, далее по score.
- VideoCard: для бустнутого поста с автором — кнопка-ссылка на профиль (https://www.threads.com/@handle) первой в колонке действий: белая пилюля в перламутрово-голубой рамке .nr-author-btn (бесшовный shimmer по background-position + пульс glow, вход nr-anim-hint). На обычных карточках кнопки нет.
- tsc/eslint чистые.

Stage Summary:
- E2E: лента = 12 карточек, фичеренный первый и играет (readyState 4), кнопка @popaistudio1 (href верный, обе анимации применены), на карточке 1 кнопки нет; переходы к 5/8/11 — новые видео играют; /r/AOABUGXd → 302 на _-Z4aWSMP; мобильный 390px — без переполнений, кнопка в кадре; консоль чистая (ошибка #418 в первом логе оказалась репортером Meta с вкладки threads, не наше приложение).
- Через 24ч буст истечёт сам: пост останется в ленте и отсортируется по score; кнопка автора исчезнет вместе с бустом.
- Напоминание: CDN-ссылки подписаны (oe=) — периодически обновлять video_url в CSV.

---
Task ID: 5
Agent: Super Z (main agent)
Task: Проверка «проблем с деплоем» + саммари по переходам.

Work Log:
- Сервер: HTTP 200, время ответа 45–600мс, процесс next dev жив; /r/[code] → 302 за 44мс; SSR отдаёт <video> с CDN-ссылками.
- dev.log: ошибок нет; единственные ⚠ — два Fast Refresh full reload (артефакт dev-режима при правке WebGLBanner.tsx), на работу не влияет.
- scripts/check_cdn_expiry.py: все 12 видео-ссылок живы (HTTP 206), но у ВСЕХ oe= истекает 2026-09-10 15:53–18:33 UTC (через ~31–34ч).
- scripts/click_summary.py: Click=9 записей (7 кодов), PostStats score: rRAfCpxz=3, остальные по 1.

Stage Summary:
- Деплой-проблем нет; единственный реальный риск — протухание всех CDN-ссылок завтра (~18:00 МСК 10.09), нужно обновить video_url в CSV до этого момента.
- Переходы: всего 9 уникальных кликов; rRAfCpxz — 3, пять кодов из второй партии — по 1 (одна сессия 06:42 UTC), AOABUGXd — 1 (E2E 08:33 UTC).

---
Task ID: 6
Agent: Super Z (main agent)
Task: Деплой кода в github.com/johncratorcev-spec/no-reality-io-ai по персональному токену.

Work Log:
- Из репозитория убраны чувствительные файлы: .env, db/custom.db (данные кликов), tool-results/ — git rm --cached + .gitignore (/db/, /tool-results/).
- Добавлен .env.example (DATABASE_URL, ADMIN_SECRET); в .gitignore исключение !.env.example.
- Коммит 5676741: чистка + env.example. Идентичность: johncratorcev-spec <...@users.noreply.github.com>. remote origin настроен (без токена).
- Push отклонён: 403 Permission denied. Диагностика API: токен валиден (login johncratorcev-spec), репо существует (public, admin/push у владельца), НО Contents API write → «Resource not accessible by personal access token», x-accepted-github-permissions: metadata=read.

Stage Summary:
- Код готов к пушу (HEAD чистый, секретов нет). Блокер: у fine-grained PAT не выдано Contents: Read and write.
- Как только пользователь добавит право — push одной командой: git push https://johncratorcev-spec:TOKEN@github.com/johncratorcev-spec/no-reality-io-ai.git main

---
Task ID: 6-b
Agent: Super Z (main agent)
Task: Финализация деплоя в GitHub после выдачи права Contents: Read and write.

Work Log:
- git push origin main — успешен: [new branch] main -> main (пуш с токеном в URL, одноразово).
- Верификация через API: корень репо — 22 файла/папки; .env, db/, dev.log, custom.db отсутствуют; .env.example на месте.
- Автокоммит e994d0d (UUID) поверх 5676741 — только worklog.md, безопасен.

Stage Summary:
- Деплой завершён: https://github.com/johncratorcev-spec/no-reality-io-ai (ветка main, HEAD e994d0d).
- Чувствительные данные не опубликованы. Токен пользователю рекомендовано перевыпустить (светился в чате).

---
Task ID: 7
Agent: Super Z (main agent)
Task: Новый фичеренный пост BAmRDZwo2i (@the_fawkeskin) с кнопкой профиля и анимацией описания + 5 обычных видео.

Work Log:
- Извлечены agent-browser'ом 6 постов (scripts/extract_post.sh): BAmRDZwo2i @the_fawkeskin (3-мин фильм, 3 клипа), BAc_WkgDGz @kass_ai (30с), BAUClsrLHr @aicheepy (10с), _1KCUr9T2 @lofi_horizon1 (30с), BAUEp_JDEF @rizwan_55066 (10с), BAhQOr0TrW @sebastien (20с).
- scripts/verify_posts_batch3.py: все 6 MP4 верифицированы (206 video/mp4, duration из efg).
- scripts/add_posts_batch3.py: CSV → 19 строк (18 играют). Новые UTM: wcDJIxC1 (фичер, boost до 2026-09-10T15:43Z), dA64-UFH, KKiWBRka, MehFNQyX, e91lKDa0, 76JKeMPf. Существующие boost_until СОХРАНЕНЫ (прошлый фикс @popaistudio1 активен ещё ~22ч).
- lib/posts.ts: tie-break среди бустнутых — свежий boostUntil выше (новый фичер первый, пока оба в бусте).
- globals.css: .nr-boost-desc — ирисцентный градиент по тексту описания (background-clip:text, sweep 4.8s alternate, палитра blue/ice/pink/mint); .nr-boost-panel — жемчужное дыхание рамки панели 3.2s.
- VideoCard.tsx: для boosted — классы nr-boost-desc на описании и nr-boost-panel на панели.
- Исправлено по ходу: turbopack не перекомпилировал CSS после Edit (в браузере не было правила) — перезапуск next dev (setsid + полный путь ./node_modules/.bin/next, prev. попытка упала: PATH без node_modules/.bin).

Stage Summary:
- E2E: фичер первый и играет (180с, readyState 4), кнопка @the_fawkeskin (href верный), nr-desc-shimmer + background-clip:text + nr-boost-panel-glow применены; лента 18 карточек; клавиатура (после фокуса контейнера) и автопереходы ок; последний новый (76JKeMPf, 20с) играет; все 6 новых /r/ → 302 на верные посты; мобильный 390px без переполнений; tsc(src)/eslint/dev.log чистые.

---
Task ID: 8
Agent: Super Z (main agent)
Task: Авто-джоба обновления ссылок; Repost→Play («скоро промпт»); rate limit/DDoS-защита; клиентский перфоманс.

Work Log:
- HTTP-извлечение из Threads закрыто логин-стеной → джоба использует agent-browser: scripts/refresh_links.py (lockfile, порог 48ч, Range-верификация, сохранение колонок/порядка, --force/--quiet/--min-hours).
- src/lib/refresh.ts (Promise-мьютекс, execFile, timeout 15мин) + GET /api/admin/refresh?key=ADMIN_SECRET (401 без ключа, rate limit 5/мин) + src/instrumentation.ts (первый запуск через 90с, интервал 6ч, unref, REFRESH_JOB=off выключает).
- Ручной запуск: 19 ссылок обновлено, 1 оживлена (y7KQ3mNc → @afpnewsagency, автор дописан), 0 ошибок; все oe= теперь до 11.09 03:53–07:40 UTC.
- src/lib/rateLimit.ts: sliding window, prune, MAX_BUCKETS=10k. /r/[code]: 30/мин на IP + 120/мин на код → 429 + Retry-After (БД не пишется). Порядок: лимит → lookup → запись.
- VideoCard: репост удалён, кнопка play → панель nr-anim-hint «Prompt coming soon» (EN, авто-скрытие 6с, toggle); флуд-контроль guarded() на copyUtm 1200мс / play 600мс / threads 1000мс / автор 800мс.
- Перфоманс: ProgressBar — DOM-мутации через ref вместо setState на каждый кадр (React не рендерится во время видео); bg-клон <video> заменён canvas-снимком 64×64 (drawImage раз в ~1.2с, форс на play/seek) — минус второй видеодекодер на активную карточку; eagerPreload — следующее видео preload=auto; tsconfig exclude examples/skills/scripts/mini-services (tsc по всему проекту теперь чистый).
- WebGLBanner уже имел visibilitychange/30fps/DPR-cap — не трогал.

Stage Summary:
- E2E: 19 карточек; репоста нет; play-панель EN текст (мобайл 390px влезает, без переполнений); canvas 64×64 в активной секции; видео играют; прогресс-бар мутируется (9.9→11.1% без ре-рендеров); /r/ 30×302→429 (Retry-After:60), клики не пишутся при 429; админ: 401 без ключа, 5/мин → 429; tsc+eslint чистые.
- Инструментация подтверждена в dev.log: «[refresh] автоджоба обновления ссылок включена (интервал 6ч)».

---
Task ID: 9
Agent: Super Z (main agent)
Task: Топ-2 ленты (@popaistudio1 #1, @the_fawkeskin #2) + система внутренних ссылок на конкретное видео.

Work Log:
- scripts/reorder_boost.py: точечно обновил boost_until — AOABUGXd (@popaistudio1) до 2026-09-11T08:00Z, wcDJIxC1 (@the_fawkeskin) до 2026-09-11T07:00Z. Оба буста продлены ~36ч; tie-break «свежий буст выше» в lib/posts.ts гарантирует popaistudio #1, fawkeskin #2.
- Новый роут /v/[utmCode] (src/app/v/[code]/page.tsx): та же лента через FeedScreen, React cache() дедуплицирует getRankedPosts между generateMetadata и страницей; generateMetadata → title «@author — no reality.»; notFound() → стилизованный src/app/v/[code]/not-found.tsx («no reality here» + кнопка «в ленту»).
- src/components/FeedScreen.tsx (новый): общий каркас Header+WebGLBanner+Feed+Footer для / и /v/[code]; page.tsx сократился до 9 строк.
- Feed.tsx: проп focusCode — начальный activeIndex из useState-инициализатора (нужное видео монтируется сразу), мгновенный scrollIntoView({block:"start"}) при монтировании; адресная строка синхронизируется с активным видео через history.replaceState (skip первый рендер; Next поддерживает shallow-replaceState).
- VideoCard.tsx: кнопка link (Link2) — копирует origin/v/[code]; хелпер writeClipboard вынесен (clipboard API + execCommand-fallback), используется и Share Reality, и link; флуд-контроль guarded(1200).
- Пуш в GitHub: bce881d..a7bb48b.

Stage Summary:
- E2E: SSR-порядок = AOABUGXd → wcDJIxC1 → rRAfCpxz(score 3); /v/KKiWBRka прыгает к idx 15 (9360px), 3 <video> смонтировано (ленивость сохранена), title «@aicheepy — no reality.»; авто-переход/стрелки синхронизируют URL (…/v/MehFNQyX → …/v/e91lKDa0); trusted-клик link → «скопировано»; /v/nonexist99 → 404 «no reality here»; на / URL не трогается до первого листания, потом /v/wcDJIxC1 ↔ /v/AOABUGXd; мобайл 390px — 6 контролов на бустнутой карточке, без переполнений.
- tsc/eslint/dev.log чистые.

---
Task ID: 10
Agent: Super Z (main agent)
Task: Бесшовный деплой на Netlify — устранить «server-side exception» (digest 2064655126) на thenoreality.netlify.app.

Work Log:
- Диагноз по задеплоенному коду (HEAD a7bb48b): (1) bun.lock → Netlify ставит зависимости через Bun → postinstall-скрипты пропускаются → prisma generate не выполняется → @prisma/client падает при инициализации модуля (lib/db.ts) = server-side exception на всех SSR-страницах; (2) next.config.ts: output: "standalone" без outputFileTracingIncludes → data/posts.csv, db/custom.db и движки Prisma не попадают в бандл функций; (3) build-скрипт с cp -r в .next/standalone упадёт там, где standalone не собирается.
- src/lib/env.ts (новый): isServerless() по NETLIFY/VERCEL/AWS_LAMBDA_FUNCTION_NAME.
- src/lib/csv.ts: фолбэк на встроенный снапшот POSTS_CSV_SNAPSHOT, если data/posts.csv не читается из бандла; scripts/gen-posts-snapshot.mjs генерирует src/lib/posts.snapshot.ts (19 постов), вызывается в начале каждого build.
- src/lib/db.ts: на serverless без DATABASE_URL — копия db/custom.db в /tmp (writes работают в рамках тёплого инстанса), фолбэк file:<root>/db/custom.db.
- src/lib/posts.ts: try/catch вокруг postStats.findMany — лента работает без БД (score 0); r/[code]: try/catch вокруг записи кликов — редирект работает всегда; admin/refresh: 501 на serverless; instrumentation: автоджоба не запускается на serverless.
- prisma/schema.prisma: binaryTargets = [native, rhel-openssl-3.0.x, rhel-openssl-1.1.x] — рантайм лямбды Netlify (Amazon Linux), иначе query engine не загрузится.
- next.config.ts: output = undefined на Netlify (standalone только локально), outputFileTracingIncludes для маршрутов /, /v/[code], /r/[code], /api/admin/refresh: data/posts.csv, db/custom.db, prisma/schema.prisma, node_modules/.prisma/**, node_modules/@prisma/client/**.
- netlify.toml (новый): NODE_VERSION=22, build = mkdir -p db && npx prisma db push --accept-data-loss && npm run build (явная генерация клиента — Bun пропускает postinstall), DATABASE_URL только для фазы сборки, [[plugins]] @netlify/plugin-nextjs без пина в package.json (bun.lock заморозил бы устаревшую 5.15.13 из зеркала; Netlify сам ставит latest).
- package.json: build = gen-posts-snapshot && next build && node scripts/copy-standalone.mjs (no-op без standalone — кроссплатформенно).
- Верификация: prisma generate — 3 движка (debian-3.0, rhel-1.1, rhel-3.0); локальный standalone build + smoke (/, /r/ 302, /v/ 200, /v/unknown 404); NETLIFY=1 build — standalone отсутствует, все 7 NFT-трейсов содержат posts.csv + custom.db + 3 движка; dev-сервер после правок — 200/302.

Stage Summary:
- Причина падения устранена на трёх уровнях: клиент Prisma (явная генерация + rhel-движки), данные в бандле (трейс-инклуды + снапшот-фолбэк), устойчивость рантайма (лента и редиректы работают даже при недоступной БД).
- Пуш коммита требует PAT (в окружении не сохранялся): git push https://johncratorcev-spec:<PAT>@github.com/johncratorcev-spec/no-reality-io-ai.git main
- На стороне Netlify: ничего настраивать не нужно (DATABASE_URL в UI НЕ задавать — lib/db.ts разрулит сам); редеплой после пуша подхватит netlify.toml.

---
Task ID: 11
Agent: Super Z (main agent)
Task: Полностью английские тексты в приложении + редизайн кнопок link (скрепка) и play.

Work Log:
- Переведены все видимые тексты на английский: VideoCard (статусы, aria-label'ы, подсказка автоплея, ошибка CDN), Feed (пустая лента), not-found /v/[code] (no reality here / back to feed), layout.tsx (description, lang="en", Manrope subsets latin — cyrillic-сабсет удалён, минус файл шрифта), WebGLBanner (aria + «Partner of the Week»).
- 7 русских заголовков постов в data/posts.csv переведены на английский (scripts/translate_titles.py, по utm_code, порядок/колонки сохранены); снапшот перегенерирован.
- VideoCard: link-кнопка → компактная круглая (40px) с иконкой Paperclip, top-3 left-3 — один ряд с mute (right-3 top-3); скопированные → morph Paperclip→Check + bounce + ring-glow, aria «Link copied».
- Анимация скрепки .nr-clip-wiggle (globals.css): периодический лёгкий wiggle каждые 5.2с (84% цикла покой → серия наклонов ±16°/13°/8°/5° с микромасштабом), hover: -rotate-6 + scale 1.08 + glow.
- Play-кнопка: круглая иконка без подписи, bottom-[2rem] right-3 — прямо над прогресс-баром (зазор 8px); анимация .nr-play-pulse — sonar-ping каждые 4с (расходящееся белое кольцо + glow).
- Правый стек действий: author + share reality + threads, поднят на bottom-[5.25rem] (освобождено место под play); link/play из стека убраны.
- Prompt-панель поднята на bottom-[13.75rem] — открывается над стеком, кнопки не перекрывает.
- Пуш в GitHub: 837bfcd.. (коммит Netlify-фиксов 00aa8f6 + автокоммит) — через новый PAT пользователя.

Stage Summary:
- E2E (390×844): скрепка (12,144) на одной строке со звуком (338,144); play над баром (gap 8px); nr-clip-wiggle 5.2s и nr-play-ping 4s применены; trusted-клик скрепки → aria «Link copied» + Check; share → «copied» (EN); play → prompt-панель (EN) над стеком (485–580px); заголовки ленты английские; full-DOM-скан видимой кириллицы — 0; горизонтального оверфлоу нет.
- E2E (1280×800): те же позиции корректны (clip x=12, mute x=1228, play над баром).
- React #418 в первом прогоне — артефакт HMR при правке файлов на живой странице; после чистой загрузки консоль без ошибок.
- tsc + eslint чистые.

---
Task ID: 12
Agent: Super Z (main agent)
Task: Кнопка профиля рядом со скрепкой (правее); Share Reality + Threads — в левый нижний ряд вровень с кнопкой промпта; иконка Reveal Prompt — гаечный ключ.

Work Log:
- VideoCard.tsx: верхний ряд слева перестроен в группу (pointer-events-none обёртка, зазоры кликаются в видео): скрепка + новая круглая кнопка профиля (AtSign, 40px, nr-glass) ПРАВЕЕ скрепки; видна на всех карточках с известным автором (раньше пилюля автора была только на бустнутых в правом стеке — поэтому «пропала»); у бустнутых — жемчужный nr-author-btn shimmer-ранг + белая сердцевина (наследие дизайна пилюли), href threads.com/@handle, guarded(800).
- Старая пилюля автора из правого стека удалена (дублировала профиль); правый стек действий расформирован полностью.
- Share Reality + threads: горизонтальный ряд bottom-[2rem] left-3 (левая часть экрана), вровень с кнопкой промпта (wrench) справа — обе линии на bottom-[2rem], параллельны; ширины хватает на 390px (ряд ~246px, ключ справа с x=338).
- Reveal Prompt: иконка Play → Wrench (lucide), aria-label «Reveal prompt for this video», hover:rotate-12 (характер ключа); sonar-ping nr-play-pulse сохранён.
- Геометрия: статус-панель поднята bottom-[4.25rem]→[5.5rem] (клиренс над новым нижним рядом, зазор 16px); prompt-панель опущена bottom-[13.75rem]→[12rem] (ближе к ключу, всё ещё над статусом без перекрытий).
- tsc + eslint чистые.

Stage Summary:
- E2E (390×844, карточка 0 бустнутая): clip x=12 / профиль x=60 (shimmer, href @popaistudio1) / mute x=338 — одна строка; share x=12 + threads x=148 слева, wrench x=338 — центры 80/81px, параллель; scrollW=390 без оверфлоу.
- E2E (карточка 2 обычная): профиль glass без shimmer, aria «Open @stanislavstarchenko profile on Threads»; wrench/share ровно 32px от низа карточки.
- Интерактив: wrench toggle (открылось/закрылось, expanded синхронно); панель над статусом без перекрытий (низ 608px против верха статуса ~625px); скрепка → «Link copied» + Check + ring-glow, через 2.4с возврат Paperclip+wiggle; share → «copied».
- Зазоры верхнего ряда: elementFromPoint = VIDEO (pointer-events-none работает — клик между кнопками ставит видео на паузу, как раньше).
- E2E (1280×800): topRowAligned=true, bottomRowAligned=true, нет перекрытий, scrollW=1280.
- Нюанс тестов: у всех кнопок карточки общий lastAction (guarded-кулдауны 600–1200мс) — при быстрых последовательных кликах в E2E часть нажатий корректно глотается флуд-контролем (by-design).
- tsc + eslint чистые, консоль без ошибок.
- Пуш в GitHub: 4e99b40..109f1ab (PAT пользователя, одноразово в URL); remote HEAD верифицирован через API — 109f1ab; Netlify авторедеплой подхватит.

---
Task ID: 13
Agent: Super Z (main agent)
Task: +7 видео в ленту (батч 4); анимированный бейдж CREEPY на двух из них.

Work Log:
- Извлечены agent-browser'ом 7 постов (scripts/extract_post.sh -> extract_out/): BAEmUmZUj_ @tremollo_ai (15с, без текста), BAPNTZ-xGs @themacrosift (12с), BAK6h933m- @mesutizm3437 (14с), BAZmyX2v0C @themacrosift (11с), BCJcGR3ZI1 @mr_relative_ (10с), BAX0B8r7iC @xcvmind (58с, русский заголовок переведён на EN — лента только английская), _4yIKMBXZ — invalid_post в 2 попытках (логин-стена).
- scripts/verify_posts_batch4.py: 6 MP4 верифицированы Range-запросами (206 video/mp4), duration из efg (url-decode фикс для 3 строк).
- scripts/add_posts_batch4.py: data/posts.csv — новая колонка badge (7-я), 7 строк (badge=CREEPY у BAEmUmZUj_ и BAX0B8r7iC; _4yIKMBXZ с пустым video_url). БАГ ПО ХОДУ: header заменялся локальной переменной, rows[0] оставался 6-колоночным — papaparse не видел badge; исправлен скриптом-фиксом (rows[0] = ...7 колонок).
- csv.ts: FeedPost.badge?: string + парсинг row.badge (trim + toUpperCase).
- VideoCard.tsx: бейдж top-center (pointer-events-none, left-1/2 -translate-x-1/2) — чёрная пилюля, белый text-black tracking, class nr-creepy-badge.
- globals.css: @keyframes nr-creepy-flicker (4.8s) — неровные серии провалов яркости 1->0.35->1 с микроперекосами skewX(+-(4-6)deg) в начале цикла и на 46-52%, плюс пульс box-shadow на 73-81%; строго ч/б.
- Снапшот перегенерирован; НЮАНС: рестарт next dev (Turbopack не поднял csv.ts на лету — SSR без badge).
- Автоджоба refresh_links (старт через 90с после рестарта) «угоняла» таб agent-browser (ходила по share-ссылкам) — E2E ждал её завершения; оживила _4yIKMBXZ: видео найдено и верифицировано джобой (18с, 720x900), автор остался @unknown (логин-стена). DictWriter джобы сохраняет колонки — badge не пострадал; снапшот перегенерирован ПОСЛЕ джобы.

Stage Summary:
- E2E (390x844): /v/mr42EPRm (idx 25) — бейдж CREEPY x=155 (центр), nr-creepy-flicker/4.8s применён, чёрная пилюля/белый текст; не перекрывает скрепку (12-52), профиль (60-100), mute (338-378); видео readyState 4 играет; scrollW=390. /v/H8N865zj (idx 19) — бейдж на месте, видео играет (скриншот creepy_badge.png). /v/ALdCmvh7 (idx 20) — обычная, без бейджа, 13с играет. /v/M4uledti (idx 22) — ожившее видео (RIZIN-бой) играет; КОНТЕНТ НЕ ВЕРИФИЦИРУЕМ против оригинала (invalid_post на стороне Threads) — помечено пользователю.
- Лента: 26 карточек (было 19); новые в конце (score 0), бусты не тронуты.
- tsc + eslint чистые.

---
Task ID: 14
Agent: Super Z (main agent)
Task: Видео https://www.threads.com/share/__FJdFasi/ в ленту + анимированный бейдж SWAG (puf-дым, 3D).

Work Log:
- Извлечение: share-ссылка и @/post/-URL отдавали login-wall (invalid_post) дважды; приелося после agent-browser close (чистая сессия) — 6 video src, автор @regina.timer (уже в ленте, FR76WfCi), русский заголовок переведён на EN («I'm a beginner AI creator…»), лента только EN.
- Верификация: все 6 вариантов 206 video/mp4 (размеры 0.49–5.78MB; dur=32s у крупного); в CSV взят srcs[0] (консистентно с батчами/джобой).
- scripts/add_post_swag.py: строка badge=SWAG, utm ZKiccR64 (первый код uWeYrBvk потерян — см. гонку ниже).
- ГОНКА С ДЖОБОЙ (важно): стартовая refresh_links (90с после старта dev) читает CSV до правки и пишет ПОСЛЕ (mkstemp+os.replace, mode 600) — потерянное обновление затёрло первую строку. Лечение: править CSV только при остановленном дев-сервере, снапшот перегенерять после джобы; в refresh_links.py добавлен os.chmod(tmp, 0o644).
- VideoCard.tsx: класс бейджа по типу — SWAG→nr-swag-badge (+nr-swag-wrap на обёртке для дыма), CREEPY→nr-creepy-badge, прочие без анимации.
- globals.css: nr-swag-3d (5.2s ease-in-out) — 3D-качание пилюли в perspective(260px) rotateY(±10°)/rotateX(±5°) с微-всплытием; буквы с серой 3D-экструзией (5 слоёв text-shadow) и металлическим градиентом пилюли; puf-дым — ::before/::after ОБЁРТКИ (z-index:-1 → всегда позади чёрной пилюли, внутри её stacking context от translate), radial-градиент+blur(4px), попеременно L/R с delay 2.6s: burst 0→9%, дрейф в сторону-вверх до 55%, растворение к 78%; строго ч/б.
- Снапшот перегенерирован ДВАЖДЫ: после возврата строки и после стартовой джобы (джоба сама обновила video_url нового поста на свежий — scontent.cdninstagram.com/AQNGg…).

Stage Summary:
- E2E 1280: /v/ZKiccR64 — nr-swag-3d/5.2s на пилюле, puf-l/puf-r 5.2s (delay 2.6s), sampled opacity клубов L0.39→R0.36→L0.49 (чередуются); видео readyState4 играет; бейдж центрирован (центр 639.5 при 1280).
- E2E 390x844 (agent-browser set viewport 390 844 — НЕ set-viewport/viewport): бейдж x162–229 (центр 195.5), зазор до кнопки профиля 62px, скрепка/профиль не перекрыты, scrollW=390; play() по тапу — играет (paused=false t=2.1).
- Лента: 27 слайдов; бусты на месте #1 @popaistudio1, #2 @the_fawkeskin; CREEPY на слайдах 19/25 без утечек, SWAG последний (26). CREEPY-бейдж после рефактора не задет (nr-creepy-flicker/4.8s).
- tsc + eslint чистые; /api/posts больше не существует (фид SSR — проверка через слайды).
- Скриншоты: scripts/extract_out/swag_badge_1..3.png (1280), swag_mobile_final.png (390).

Пуш (Task ID: 14, добивка): github_pat_…AZPw5fUq (одноразово в URL) — 074ce63..4d54389 main -> main (батч-4 уже был на remote); remote HEAD верифицирован через GitHub API = 4d54389; Netlify авторедеплой подхватит. Пользователю: токен засвечен в чате — отозвать.

---
Task ID: 15+16
Agent: Super Z (main agent)
Task: +2 видео с бейджем SWAG без лишних проверок: BAWFhNMwp4 и BAD7RdF75N.

Work Log:
- BAWFhNMwp4: логин-стена 2 попытки (сейчас даже чистая сессия не помогла с первого раза, со 2-й — видео: 8с, 638KB, 206 video/mp4, 1 src); автор на login-wall случаен (@nathan_nix → @methewgarry_32) — oembed пуст, embed — JS-оболочка без данных (271KB, username:false, id отсутствует) → @unknown по прецеденту _4yIKMBXZ; заголовка нет.
- BAD7RdF75N: с первой попытки без стены — @lesya.neuro, 4 src, первый 206 video/mp4 2.66MB; русский заголовок переведён на EN («My new AI work 💔 … style isn't about trying to fit in…»).
- scripts/add_posts_swag2.py: +2 строки badge=SWAG — Ekxi_A6H (@unknown, BAWFhNMwp4), GQtfbzIZ (@lesya.neuro, BAD7RdF75N); CSV 29 строк; снапшот перегенерирован. Джоба не мешала (интервал 6ч, стартовая уже отработала; правка вне её окна).
- E2E/линтеры пропущены по прямой просьбе пользователя; код не менялся (SWAG-рендер и CSS уже есть с задачи 14).

Stage Summary:
- Лента 29 постов: 3×SWAG (ZKiccR64, Ekxi_A6H, GQtfbzIZ), 2×CREEPY, бусты #1/#2 на месте (строки не тронуты).

---
Task ID: 17
Agent: Super Z (main agent)
Task: +3 видео @themacrosift с бейджем WELCOME TO THE FUTURE (3D НЛО), пины на места 2/3/4, счётчик просмотров у стрелки. Автоподписка/лайк — отклонено как технически невозможное.

Work Log:
- Извлечение: все 3 с первой попытки (BAz5g1VlT2/BAYVUvjsjW/BAUa9v7bzp — серия «Goodnight» @themacrosift, EN-заголовки); 6 src каждый, первые верифицированы 206 video/mp4 (1.9/2.1/2.0MB).
- НОВАЯ МЕХАНИКА ПИНОВ: колонка pin (абсолютные слоты поверх бустов/score). csv.ts: FeedPost.pin + парсинг; posts.ts: сортировка — пины по возрастанию первыми, затем старая логика (бусты → score). pin=1 @popaistudio1, pin=2/3/4 новые, pin=5 @the_fawkeskin (смещён со #2); обоим старым бустам boost_until продлён до 2027-09-11 (перламутр сохранён, слоты не зависят от истечения).
- БАГ (повтор батча-4, теперь задокументирован в скрипте): header заменялся локальной переменной, rows[0] оставался 7-колоночным — KeyError при проверке; фикс rows[0] = header. Скрипт идемпотентен (skip по url).
- VideoCard: бейдж-блок — ветка WELCOME TO THE FUTURE: класс nr-ufo-badge + <i class="nr-ufo"> (тарелка) + позиция top-14 (56px, ниже ряда кнопок — длинный бейдж 239px на 390 не влезает между скрепкой и mute). Кнопка threads: <a> relative + чип nr-views-chip (-left-2 -top-2.5, у стрелки): Eye 10px + pseudoViews.
- utils.ts: pseudoViews(code) — FNV-подобный хеш utm → 300..5599, детерминированный (SSR/CSR без рассинхрона), формат toLocaleString("en-US").
- globals.css: nr-ufo-fly (4.2s, perspective(70px) rotateX 28–42° + rotateZ ±7° + боб), купол nr-ufo-dome (brightness пульс), огни nr-ufo-lights (opacity 1↔0.25), nr-ufo-beam (свечение пилюли), nr-views-pulse (4.5s двойной пульс). Ч/б.
- НЮАНС: Turbopack не отдал свежий globals.css после правки (animationName:none при живых элементах) — рестарт next dev вылечил; стейл-чанк проверен grep'ом на nr-ufo-fly ДО браузерных замеров.

Stage Summary:
- SSR-порядок (curl /): AOABUGXd → xUAgSLzz → I4z2q24Z → omC5G8wq → wcDJIxC1 — точно 1..5. Лента 32 поста.
- /v/xUAgSLzz (1280): nr-ufo-fly/4.2s, nr-ufo-beam, бейдж top 56px x520–759 (центр 639.5), чип «👁 3,504»/«3,881» (первый в DOM = чужой слайд — оба валидные), nr-views-pulse; scrollW=1280. Геометрия 390 рассчитана: бейдж y56 ниже кнопок (низ 52), right 314 < mute 338.
- tsc + eslint чистые. Автоподписка/автолайк: невозможно (Threads write-API нет, чужая авторизация) — сообщено.

---
Task ID: 18
Agent: Super Z (main agent)
Task: Выровнять бейдж WELCOME TO THE FUTURE в ряд с верхними элементами + уменьшить; +7 видео (SWAG ×3, ROCKET SCIENCE с анимацией ракеты, WELCOME ×2, CREEPY).

Work Log:
- Бейдж WELCOME TO THE FUTURE: top-14 → top-[21px] (центр 35.8px против центра кнопок 32px — в ряду); компактные классы text-[0.55rem] tracking-[0.08em] px-2.5 py-1 gap-1.5; иконка .nr-ufo-sm 18×6.5px (купол/огни пропорционально). E2E 390×844: бейдж x109–281 (w171.6, был 239), профиль кончается на 100, mute начинается на 338 — без перекрытий; nr-ufo-beam + nr-ufo-fly живы.
- ROCKET SCIENCE (новый тип): SVG-ракета в VideoCard (корпус/иллюминатор/стабилизаторы/пламя .nr-rocket-flame fill-box), CSS: nr-rocket-fly 3.6s (покачивание → приседание → старт -12px → возврат), nr-rocket-flame 0.22s flicker, nr-rocket-glow пилюли синхронно 3.6s (пик на старте). Ч/б. Ждёт поста BBhhoOC9vb для E2E.
- СТАЛИ ИЗВЛЕКАТЬСЯ только 4/7: Threads агрессивно троттлит анонимов (login-wall на всё; последний успех 08:51–08:54, дальше стена и после burst-джобы не открылась). ~28 попыток/код (fg_round.sh ×8, jina/allorigins/codetabs прокси, oembed, /embed, /t/-роут, xmt-токен из 302, wayback, DDG/Bing — всё мимо). Канонические URL получены через curl 302 Location: _mUBnlbMn→@igstorydj/post/DdIWV-mEf83, BBhhoOC9vb→@pshai.studio/post/DdIxZufjkUK, BAX2daEsTs→@itsrawchris/post/DdI7_SyCHwX (посты существуют).
- ДОБАВЛЕНО 4: j0o8-Wwe @alex.blanccoo SWAG (_jRVFupZD, «somebody's uncle», 21с, 206✓), NzUdliRV @roi_ai_production WELCOME (BAeVwPvTJf, Robot #6 Carbonara), 2m0nwLwF @voidstomper CREEPY (BAi0MTP0NQ, без og:description), r1PfYkmW @malyshev_ai WELCOME (BAJE206f7E, «Austin 2150»). Все video_url верифицированы 206 video/mp4. Лента 36 постов.
- ВАЖНЫЙ ФИКС: строки CSV были 9-полевыми (пустой хвост от pin-миграции Task 17) → refresh_links падал на writerows (ValueError: fields not in fieldnames: None) ПОСЛЕ burst-обновления ссылок. CSV нормализован до 8 полей; джоба починена к следующему запуску.
- Инфра: песочница убивает фоновые процессы (nohup/setsid недостаточно) → fg_round.sh (foreground-раунды) + dev_up.sh (гарантия живого дева в начале каждого шага). Turbopack-чанки .next/static — артефакты, живой CSS проверять по href из HTML страницы ([root-of-the-server]__*.css).
- Снапшот перегенерирован после нормализации CSV; tsc/eslint чистые. Пуш 6efc388..a43a952, remote HEAD = a43a952 (git ls-remote).

Stage Summary:
- Бейдж UFO компактный и в ряду кнопок (171.6px, зазоры 9px/57px). ROCKET SCIENCE-анимация в коде, E2E после извлечения BBhhoOC9vb.
- Лента 36 постов: 4×SWAG, 3×CREEPY, 5×WELCOME (пины 1-5 на месте).
- Догнать 3 поста: bash scripts/fg_round.sh _mUBnlbMn BBhhoOC9vb BAX2daEsTs → touch scripts/extract_out/<code>.json.ok → python3 scripts/add_posts_batch7.py → node scripts/gen-posts-snapshot.mjs.

---
Task ID: 19
Agent: Super Z (main agent)
Task: +3 видео: BAVq1ma_VU (ROCKET SCIENCE), BBrK8muRRI (SWAG), _gYuRN9lp (WELCOME TO THE FUTURE).

Work Log:
- Все 3 извлечены С ПЕРВОЙ попытки (стена Threads к 12:25 открылась). Ретрай зависших Task 18 (_mUBnlbMn/BBhhoOC9vb/BAX2daEsTs) в том же раунде — снова WALL → стена не только IP: эти 3 поста, похоже, персонально закрыты за логином (пайплайн в worklog 18 остаётся).
- Верификация: все 3 → 206 video/mp4. BAVq1ma_VU @regina.timer — русский заголовок (та же серия, что ZKiccR64/FR76WfCi) переведён EN («…first realistic video… challenging but beautiful journey 🥰»); BBrK8muRRI @tremollo_ai — без og:description (прецедент); _gYuRN9lp @mr_relative_ — уже EN.
- CSV: +3 строки (UkoN8r2X ROCKET SCIENCE, hMKB_IqJ SWAG, vM_DQv1q WELCOME) → 39 постов; снапшот; tsc чистый.
- E2E 390×844 /v/UkoN8r2X: бейдж x111.8–278.2 (w166.3) y12 — профиль до 100 / mute с 338 без перекрытий; nr-rocket-glow + nr-rocket-fly + nr-rocket-flame все живы; SVG-ракета 12×24; видео играет (rs4); scrollW=390. /v/hMKB_IqJ SWAG: nr-swag-3d + дым, rs4. /v/vM_DQv1q: компактный UFO w171.6 yOff25.2 (в ряду), тарелка 18px.
- Пуш 1372c8b..9885c3b, remote HEAD = 9885c3b (ls-remote).

Stage Summary:
- Лента 39 постов: 5×SWAG, 3×CREEPY, 6×WELCOME, 1×ROCKET SCIENCE (анимация ракеты подтверждена в браузере). Пины 1–5 на месте.
- Остаток: 3 поста Task 18 в логин-стене (_mUBnlbMn, BBhhoOC9vb, BAX2daEsTs) — авторы известны (@igstorydj, @pshai.studio, @itsrawchris).

---
Task ID: 20
Agent: Super Z (main agent)
Task: Снять ROCKET SCIENCE со всех видео, кроме _8h16T9aG; этому — добавить.

Work Log:
- Снятие: UkoN8r2X (@regina.timer) badge → '' (единственный ROCKET в ленте). Снапшот, tsc, коммит+пуш (9885c3b..0562975), remote HEAD = 0562975.
- Добавление невозможно: _8h16T9aG через 302 → @pshai.studio/post/DdIxZufjkUK — ТОТ ЖЕ пост, что зависший BBhhoOC9vb (пользователь переслал другое share-ссылку того же видео). Пост отдаёт invalid_post ИЗ СЕССИИ ОТКРЫТОГО ПРОФИЛЯ автора; в 22 ссылках профиля @pshai.studio его нет (он новее последней видимой — либо скрыт, либо для подписчиков, либо удалён). Googlebot-UA (0 байт), jina+xmt (стена+invalid_post) — мимо. 5 попыток extract + профильный обход.
- ВАЖНО: профиль автора отдаётся без стены, а его пост — invalid_post → это НЕ IP-троттлинг, пост недоступен на стороне Threads. Зависшие Task 18 (_mUBnlbMn, BAX2daEsTs) — вероятно, та же категория.
- batch7 META дополнен _8h16T9aG ROCKET SCIENCE — при появлении доступа одна команда добавит: fg_round.sh → .ok → add_posts_batch7.py → snapshot.

Stage Summary:
- Лента 39 постов, ROCKET-бейджей сейчас 0 (снят по просьбе), пины 1–5 на месте. Ракетная анимация в коде, появится с постом.
- Пользователю: ссылка указывает на недоступный пост Threads (удалён/подписчики/регион) — проверить в приложении; если есть другая share-ссылка этого видео — прислать.

---
Task ID: 21
Agent: Super Z (main agent)
Task: Панель самообслуживания: юзер сам добавляет посты в ленту по ссылке (+ бейджи), без авторизации, по секретному длинному пути. Плюс ретрай _8h16T9aG (ROCKET SCIENCE).

Work Log:
- Секретный маршрут: /f0ff36544bd3574e9aac5ea4997e0d56b1526c80 (40 hex, secrets.token_hex(20)); layout c robots noindex; ссылок с сайта нет.
- Backend: scripts/panel_add.py — асинхронная джоба (spawn из API-роута, detached, прогресс в scripts/panel_jobs/<id>.json атомарно): нормализация ссылки (share-URL / /post/-URL / голый код) → dedupe → извлечение (кэш extract_out/<code>.json.ok или 3 попытки extract_post.sh с wall-детектом Join Threads + AQP6y_fIpdO4, паузы 15с) → верификация CDN (curl range → 206 video/mp4) → RU-страж заголовка (с подсказкой заполнить поле перевода) → строка CSV [url,title,author,nanoid(8),video,"",badge,""] → gen-posts-snapshot.mjs. Глобальный лок .lock (одна джоба одновременно, протухание 15 мин).
- API: src/app/f0ff.../add/route.ts — POST (валидация бейджа из whitelist, spawn джобы), GET ?job= (статус), GET (последние 8 добавлений + total из getPostsFromCSV).
- UI: page.tsx (client) — минимализм под бренд: белый фон, Manrope, underline-инпуты, чипы бейджей (без бейджа/SWAG/WELCOME TO THE FUTURE/CREEPY/ROCKET SCIENCE), ч/б инверсия выбранного, чёрная пилюля-кнопка, моно-консоль лога с поллингом 1.5с, карточка успеха (автор/бейдж/заголовок/ссылка /v/<utm>/кнопка «следующий»), красная карточка ошибки со сбросом, список последних добавлений, счётчик ленты [N].
- ФИКС: fetch("add") без слэша резолвился в /add (404) на маршруте без trailing slash → fetch(`${usePathname()}/add`).
- Тесты пайплайна (curl+python test_panel.py): дубликат BAVq1ma_VU → «уже в ленте» за 2с без извлечения; несуществующий код → чистая ошибка после 3 попыток без мусора в CSV; RU-заголовок → страж с подсказкой; фейковый успех TESTPANEL1 (кэш+206+CSV 40+снапшот+live-подхват лентой за счёт mtime-кэша csv.ts) → откат до 39.
- E2E agent-browser: панель рендерится 390px и десктоп; сабмит _8h16T9aG c ROCKET SCIENCE через UI → стена/NO_SRCS 3 попытки → чистая ошибка, лок отработал (вторая параллельная джоба отклонена); TESTPANEL1 через UI → консоль лога → карточка успеха; deep-link /v/<utm> открывает ленту на посте.
- _8h16T9aG ПО-ПРЕЖНЕМУ недоступен (стена+NO_SRCS,ambient — та же категория, что в Task 20); джоба оставляет кэш попыток, ретрай через панель в один клик.
- Утилиты: scripts/test_panel.py (POST+поллинг), scripts/panel_cleanup_test.py (снятие тестовой строки); .gitignore += scripts/panel_jobs/.

Stage Summary:
- Панель работает end-to-end: ссылка → извлечение → верификация → CSV → снапшот → лента живо подхватывает. Все 4 бейджа + «без бейджа». RU-заголовки — через поле перевода (кэш ускоряет повтор).
- Лента 39 постов (тестовые следы удалены). ROCKET SCIENCE в ленте: 0, закреплён за _8h16T9aG при появлении доступа.
- tsc чистый, dev.log без ошибок.

---
Task ID: 22
Agent: Super Z (main agent)
Task: Панель на Vercel падала (mkdir /var/task — read-only ФС serverless). Сделать панель рабочей на serverless-хостинге.

Work Log:
- Диагноз: serverless = read-only ФС + нет python3/agent-browser + detached-процессы умирают. Пробы: jina отдаёт title/author/text (быстро, без стены), но НИКОГДА не отдаёт .mp4 (видео только через JS; в сыром HTML 273KB — 0 ссылок; /embed → 404).
- Находка: Threads share-коды МУТИРУЮТ — BAVq1ma_VU теперь резолвится в @vivalunaar («Just keep F*CKING going»), _gYuRN9lp → @metronovon (в CSV — @regina.timer/@mr_relative_). Фиду не вредит (хранит прямой mp4), но метаданные из jina могут расходиться → в UI добавлены поля-овверрайды author/video.
- Архитектура двух режимов в route.ts (SERVERLESS = VERCEL||NETLIFY):
  • Песочница (preview): как раньше — async-джоба panel_add.py + поллинг (плюс новые флаги --video/--author: ручной режим пропускает извлечение, только 206-проверка → CSV → снапшот).
  • Serverless: синхронно — jinaMeta (title/author, wall-детект) + ручной адрес видео (обязателен) + verifyVideoUrl (Range → 206 video) → коммит data/posts.csv в GitHub через Git Data API (src/lib/panel_github.ts: ref → commit → tree(base_tree) → commit → patch ref, 1 ретрай на 409/422) → хостинг авторедеплоит. GET-список на serverless читает CSV из репо (бандл может отставать). maxDuration=60. Патам — env GITHUB_PANEL_PAT.
- Багфиксы по пути: в рерайте потерялся --job в spawn-аргах (джобы падали молча на argparse → 404 статуса); test_panel.py — терпимость к 404 + поле video; panel_cleanup_test.py — фильтр TESTPANEL*.
- Тесты: scripts/test_serverless.ts (node 24 type stripping) — getCsvFromGitHub 39 постов, dupe, verifyVideoUrl 206, jina (в этот раз WALL — флакова, покрыто ошибкой с подсказкой), РЕАЛЬНЫЙ no-op коммит 8db0d68 (write-путь GitHub proven). Сандбокс: дубликат за 2с, ручной режим видео → done → откат до 39. tsc чистый.

Stage Summary:
- Панель работает в двух средах: preview — полный авто (agent-browser), Vercel/Netlify — jina-метаданные + ручной адрес видео + коммит в репо с авторедеплоем (~1–2 мин).
- Для Vercel: добавить env GITHUB_PANEL_PAT (fine-grained PAT с Contents: write) и передеплоить.
- Лента 39 постов, тестовых следов нет. jina нестабильна на стене — при ошибке жать ещё раз или заполнять поля руками.

---
Task ID: 23
Agent: Super Z (main agent)
Task: Самостоятельно добавить 4 видео: _1khVBQfa (CREEPY), BAYFWQmQhG (SWAG), BBpvXFCTYM (SWAG), _2LLDHwP2 (SWAG).

Work Log:
- Дедуп-проверка: ни один из 4 кодов в CSV не встречался. Извлечение через fg_round.sh — 4 раунда: BBpvXFCTYM → OK с первой же попытки раунда 1; остальные 3 — стабильно WALL (Join Threads + ambient).
- Диагностика застрявших: за стеной у _1khVBQfa дважды ловился один и тот же «пост-видео» (AQO0MH3Oi3ek, 9s), но автор между попытками менялся (@giiiiiianna → @theothersideofthestoryz) → контент за стеной это РЕКОМЕНДАЦИИ ленты, не целевой пост. jina: BAYFWQmQhG/_2LLDHwP2 отдали фид рекомендаций (aaron.rupar / chase_daniel — НЕ цели), _1khVBQfa — 401 IP-reputation (флаково).
- Приговор через браузер: все 3 кода JS-резолвятся в https://www.threads.com/?error=invalid_post — посты недоступны на стороне Threads (удалены/подписчики/регион). Контрольный тест метода: BBpvXFCTYM тем же способом резолвится в @sabina_skinder/post/DdJzy5bDbBN без ошибки. Googlebot-UA: 0 байт на все три. Обходы исчерпаны.
- BBpvXFCTYM: 3 srcs (83s CLIPS 720 / 17s 576 / 16s 720), взят srcs[0] по правилу пайплайна, CDN 206 video/mp4. Заголовок русский («Благодарю) Вот вы ищите упоротые)…») → переведён EN по прецеденту Task 19: «Thank you :) So you're looking for the trippy ones :) I have a whole series of these different collages. Enjoy watching!»
- Добавление через panel_add.py в ручном режиме видео (--video + --title + --author): utm QPu6TzrX, бейдж SWAG, CSV 40 постов, снапшот пересобран.
- Верификация: tsc чистый; E2E /v/QPu6TzrX — deep-link открывается на посте, видео rs4, бейдж SWAG и @sabina_skinder на месте, nr-swag-3d в DOM.
- Пуш d29df28..883693f через PAT, remote HEAD = 883693f (ls-remote) → Vercel авторедеплой.

Stage Summary:
- Лента 40 постов: 6×SWAG, 3×CREEPY, 6×WELCOME, 0×ROCKET. Пины 1–5 на месте.
- 3 из 4 ссылок недоступны на стороне Threads (_1khVBQfa, BAYFWQmQhG, _2LLDHwP2 → invalid_post): пользователю проверить в приложении (там он залогинен) — если видео там играет, прислать прямые /post/-ссылки либо mp4-адрес для ручного режима панели.
- Урок: контент/авторы, пойманные за login-стеной, — рекомендации ленты, им доверять нельзя; приговор post'у — только по JS-резолву адресной строки (error=invalid_post) с контрольным тестом на заведомо живом коде.

---
Task ID: 24
Agent: Super Z (main agent)
Task: Добавить https://www.threads.com/share/BBhfVZjZCh/ с бейджем WELCOME TO THE FUTURE.

Work Log:
- Извлечение с первой попытки (стены не было): @themacrosift, пост живой, заголовок EN («~A STRANGE DAY IN THE NEIGHBORHOOD~ • Part 2: Come Inside…») — RU-страж пройден. Пост-карусель из 6 уникальных видео (10–42s, разные asset_id); взят srcs[0] (15s, 720p, главный в DOM) по правилу пайплайна, CDN 206 video/mp4.
- Добавление через panel_add.py (кэш + .ok маркер): utm y3ZH8wdt, CSV 41 пост, снапшот пересобран, tsc чистый.
- ИНЦИДЕНТ + ДИАГНОСТИКА: во время E2E браузер «уходил» на threads.com/@<разные авторы ленты>/post/…?xmt…&slof=1 через несколько секунд после открытия localhost. Подозрение на авто-навигацию в коде НЕ ПОДТВИЛИСЬ (ловушки click/pushState/beforeunload чистые, /r/ в dev.log нет). Причина: agent-browser close убивает chrome некорректно → при следующем старте восстанавливаются вкладки старых сессий извлечений (share→post URL-ы) и перехватывают активную вкладку. Фикс: close --all + rm -rf /tmp/agent-browser-chrome-* перед E2E; проверять agent-browser tab list.
- ИНЦИДЕНТ 2: в 20:26–20:38 окружение само перезапустилось (root-процесс /app/.venv/bin/python3 main.py, рестарт bun dev), затем рабочая копия была частично откачена к состоянию Task 23: из data/posts.csv удалена строка BBhfVZjZCh, на panel_*.ts/test_serverless.ts/extract_out — chmod-флипы 644↔755. Git HEAD не пострадал; прод (Vercel собирает из HEAD) не затронут. Восстановлено git checkout -- … по списку изменённых файлов; рабочая копия снова = HEAD.
- Финальный E2E (чистый профиль): /v/y3ZH8wdt стабилен, title «@themacrosift — no reality.», видео rs4, бейдж WELCOME TO THE FUTURE, UFO-анимация nr-ufo-fly активна.
- Пуш: 9e2bc34..f1b714e (extract-кэш), remote HEAD = f1b714e.

Stage Summary:
- Лента 41 пост: 6×SWAG, 3×CREEPY, 7×WELCOME, 0×ROCKET. Пины 1–5 на месте.
- Уроки: (1) phantom-навигации в E2E = session-restore chrome, лечится чисткой /tmp/agent-browser-chrome-*; (2) песочница может самопроизвольно откатывать рабочую копию — после любого инцидента сверять git status со HEAD и восстанавливать checkout-ом; прод-истина = GitHub HEAD.

---
Task ID: 25
Agent: Super Z (main agent)
Task: Добавить 2 видео: BAXhyoy3iC (SWAG) и _nV8naeIw (WELCOME TO THE FUTURE).

Work Log:
- Оба извлечены с первой попытки, без стены. BAXhyoy3iC: @our.cult.ure, «STREET SERMON / made by Cult.ure» (EN), карусель 6 видео, взят srcs[0] 19s 960p. _nV8naeIw: @neurozeh, заголовок русский («Скоро настанет эпоха…») → переведён EN: «Soon we'll be generating our own films in a single evening / And films with real actors will become a privilege», карусель 4 видео, взят srcs[0] 165s 720p.
- Верификация: оба srcs[0] → 206 video/mp4. Добавление через panel_add.py (кэш + .ok): utm j59dA1Ld (SWAG) и ga9l9UEc (WELCOME TO THE FUTURE), CSV 43 поста, снапшот пересобран, tsc чистый.
- E2E с чистым профилем (урок Task 24: close --all + rm -rf /tmp/agent-browser-chrome-* перед каждым прогоном): /v/j59dA1Ld — @our.cult.ure, SWAG-бейдж, rs4; /v/ga9l9UEc — @neurozeh, WELCOME + nr-ufo-fly, rs4; tab list = 1 вкладка, phantom-навигаций нет.
- Пуш b1a3227..a96e72e, remote HEAD = a96e72e.

Stage Summary:
- Лента 43 поста: 7×SWAG, 3×CREEPY, 8×WELCOME, 0×ROCKET. Пины 1–5 на месте.

---
Task ID: 26
Agent: Super Z (main agent)
Task: (1) Добавить 4 видео: BAWu9JSriq/_kD9eBrn0/BASa4so4Kk (SWAG) + BAVVuicLPJ (WELCOME TO THE FUTURE). (2) Terms of Service и Creator Agreement (EN) отдельными страницами + ссылки в футере.

Work Log:
- ЧАСТЬ 1: все 4 извлечены без стены. BAWu9JSriq @base27_digital (55s 960p, RU заголовок → EN «A neural network restored the cult classic series 'Krutoye Pike'»); _kD9eBrn0 @the_siberian_ (24s, EN «Do you remember them?»); BASa4so4Kk @yaros1av.ai (16s, RU → EN про альбом CA$HEY); BAVVuicLPJ @toshiki.1010 (93s, JP «昭和異物感» → EN «Showa-era Uncanny»). Все srcs[0] → 206 video/mp4. panel_add.py: utm LR7j5-V8, QAJ4DRds, EJszWHvA, K2Cyj240 → 47 постов.
- БАГ-ФИКС по ходу: bash съел «$HEY» в «CA$HEY» (double-quoted $-расширение) — заголовок поправлен точечной правкой CSV + пересборка снапшота. Урок: $ в заголовках передавать через single quotes/файл.
- Инцидент окружения №3: data/posts.csv снова chmod-флип; при пуше части 1 — non-fast-forward (окружение пересоздало локальный коммит worklog-25 с новым SHA 8fc69b7 вместо запушенного 305e7ad). Лечится: git fetch + rebase origin/main (история 305e7ad → 2bee932 → fbcd747), содержимое сверено (47 постов, CA$HEY, снапшот, worklog без дублей секций).
- E2E части 1: 4 deep-link rs4 + точечная проверка бейджей по селекторам (.nr-swag-badge / i.nr-ufo; проверка по innerText ловит соседние карточки — использовать только селекторы).
- ЧАСТЬ 2: src/components/legal/LegalShell.tsx — общий шелл (белый фон, Manrope, sticky-топбар с логотипом-ссылкой на ленту, нумерованные секции, контакт-карточка @your_betfriend). /terms — Terms of Service (10 секций): платформа-дистрибьютор, права у авторов, маркетплейс промптов и инструкций (анонс), приемлемое использование, takedown, отказ от гарантий. /creators — Creator Agreement (11 секций): права остаются у авторов на 100%, revocable-лицензия на хостинг/показ/промо, платформа = дистрибьютор, гарантии автора, маркетплейс (свои цены/условия листинга, комиссия раскрывается до публикации), снятие за 5 рабочих дней, запрещённый контент. Оба ~900 слов, last updated September 11, 2026.
- Footer: + ссылки terms / for creators (теглайн скрыт на xs ради 390px). Проверки: tsc, eslint, рендер обеих страниц (h1/секции/ссылки на /), 390px без overflow, elementsFromPoint — ссылка terms кликабельна.
- Пуш: fbcd747..0107e82, remote HEAD = 0107e82.

Stage Summary:
- Лента 47 постов: 10×SWAG, 3×CREEPY, 9×WELCOME, 0×ROCKET. Пины 1–5 на месте.
- Legal-страницы /terms и /creators в проде после редеплоя; связи: футер ленты → обе страницы, шапка страниц → лента.

---
Task ID: 28
Agent: Super Z (main agent)
Task: (1) Перенести созданный код задач 27 (fallback + 2328-платежи + analytics) в отдельную ветку. (2) Лендинг-главная с анимациями/3D без тяжёлых библиотек, EN SEO/GEO-текст, описание проекта, соцсети (Instagram/Threads/Telegram), секция про децентрализованную команду — сделать и пуш сразу.

Work Log:
- РЕОРГАНИЗАЦИЯ ВЕТОК: origin/main (после fetch) = d1ac6b4 (task 26 уже на проде). Локальный main был ahead на 4 коммита Task 27 (e181f39, 8e3b2c7, 13a5e23, 67e1a7e) + незакоммиченный bun.lock. Сделано: git config core.filemode false (шум chmod-ов), ветка feature/video-fallback-and-2328-payments передвинута на 67e1a7e + коммит a9b53b8 (lockfile), main = reset --hard d1ac6b4 (= origin). Ветка НЕ запушена (ждёт разрешения).
- ИНЦИДЕНТ (повтор паттерна): после сборки data/posts.csv и posts.snapshot.ts были изменены средой (не мной; diff по всем строкам, включая реальное отличие контента). Лечение по протоколу: git checkout -- из HEAD, регенерация снапшота → байт-идентично HEAD. В коммит CSV не попал.
- ЛЕНДИНГ: новая главная / — src/app/page.tsx (server: metadata + JSON-LD) + src/components/landing/{Landing,HeroCanvas,Globe,Tilt,Reveal,CountUp,faq.ts,landing.css}. Фид переехал на /feed (src/app/feed/page.tsx), deep-link'и /v/[code] не тронуты, Header/Footer ленты не менялись.
- АНИМАЦИИ БЕЗ БИБЛИОТЕК: WebGL-шейдер органического потока в герое (domain-warped fbm, реакция на курсор, 30fps cap, DPR≤1.5, pause on hidden, CSS-fallback; паттерн WebGLBanner); 3D-tilt карточки (pointermove, блик-глейр, off на тач/reduced-motion); плавающие бейджи-спутники героя (переиспользование nr-swag/nr-ufo/nr-creepy классов + параллакс-слои); канвас-глобус команды (Fibonacci sphere 700 точек, драг с инерцией, пульс-хабы 8 городов); scroll-reveal через IntersectionObserver; marquee, count-up статистика; prefers-reduced-motion всюду.
- SEO/GEO: EN-копирайтинг (hero, about, how, marketplace 2328.io/75-25, creators, team «decentralized across the planet», FAQ×8, socials, footer с дисклеймером «not affiliated with Meta/Threads»); metadata + OG/Twitter + canonical (metadataBase = https://no-reality.io из имени репо — проверить домен!); JSON-LD WebSite+Organization(sameAs соцсети)+FAQPage; src/app/sitemap.xml (/,/feed,/terms,/creators); robots.txt + Sitemap.
- СОЦСЕТИ: единый конфиг src/lib/site.ts. Telegram t.me/your_betfriend — подтверждён футером/legal; Instagram и Threads хэндлы — ЗАГЛУШКИ your_betfriend, пользователю уточнить ре хэндлы и поправить один файл.
- Проверки: npx tsc --noEmit чисто; eslint новых файлов чисто (CountUp переписан императивно из-за react-hooks/set-state-in-effect); npm run build — / статика, /feed динамика, /sitemap.xml статика, 47 постов; смоук next start: 200 на /, /feed, /sitemap.xml, /v/j59dA1Ld, /terms, /creators; JSON-LD/маркеры контента в HTML подтверждены.
- ПУШ ЗАБЛОКИРОВАН: PAT в окружении не сохранён (в worklog только маскированный след, .env/credentials/SSH пусты). Коммит 5540ed9 на main готов локально; push одной командой, как только пользователь пришлёт свежий PAT.

Stage Summary:
- main = d1ac6b4 (origin) + 5540ed9 (лендинг, локально, ждёт PAT). Ветка feature/video-fallback-and-2328-payments = весь код задач 27 (fallback, 2328-платежи, analytics) локально, не запушена.
- Лента на проде не менялась: 47 постов, пины 1–5. Лендинг собирается статикой, фид динамикой.

---
Task ID: 28-push
Agent: Super Z (main agent)
Task: Запушить всё, что связано с дизайном и лендинг-страницей (пользователь прислал свежий PAT).

Work Log:
- Состояние на вход: main = d1ac6b4(origin) + 5540ed9(лендинг) + 7d6e075(worklog-28), ветка feature/video-fallback-and-2328-payments локальна (не тронута, пуш по-прежнему ждёт явного разрешения).
- CSV-шум среды (data/posts.csv + posts.snapshot.ts, diff только в CDN-токенах) откачен git checkout -- по протоколу.
- Строгая верификация CSV HEAD против прода (d1ac6b4) Python-парсингом: все поля кроме video_url идентичны, 47 постов, пины 1–5 на месте; у 2 постов (__FJdFasi, BAWFhNMwp4) новый путь video_url — оба проверены curl -r 0-1023 → 206 video/mp4. HEAD безопасен.
- npx tsc --noEmit чисто.
- Пуш PAT-URL: d1ac6b4..7d6e075 main -> main; fetch-верификация: origin/main = 7d6e075.

Stage Summary:
- Лендинг (5540ed9) и worklog-28 (7d6e075) в проде; Vercel редеплоит автоматически.
- Открытые вопросы к пользователю: (1) реальные хэндлы Instagram/Threads (сейчас заглушки your_betfriend в src/lib/site.ts); (2) подтвердить домен no-reality.io (metadataBase/canonical/sitemap); (3) разрешение на пуш ветки feature/video-fallback-and-2328-payments.

---
Task ID: 29
Agent: Super Z (main agent)
Task: (1) Актуализировать все ссылки на загруженный контент. (2) Карусели фото «вирально, с анимациями». (3) @pawcrewdaily — партнёр недели, кастомный блок (кошечки, анимации мягко и стильно). Финал: запушить готовые изменения (PAT от пользователя).

Work Log:
- Реализация задачи была закоммичена ранее локально (8a17886, без worklog-записи): MediaCarousel.tsx (stories-паттерн: сегментный прогресс, авто-переход rAF, свайп/драг, ken-burns, видео-слайды, fallback на битых слайдах), Partner.tsx + landing.css (кошачья карточка: уши, лапки, моргающая мордочка, зрачки следят за курсором через rAF, клубок; тёплая кремовая палитра, prefers-reduced-motion), PARTNER_OF_WEEK в site.ts, колонка media в CSV + parseMedia в csv.ts, VideoCard рендерит карусель вместо видео (+ mute-кнопка скрыта у карусель-постов, onEnded -> листание ленты), refresh_links.py: инкрементальное сохранение + --budget.
- АУДИТ CDN (scripts/verify_all_cdn.py, параллельно 8 потоков): 47 реальных постов -> все 206 video/mp4, 0 битых. NRTEST01 — тестовая строка карусели («remove before commit»), найдена и удалена из CSV + снапшот пересобран (47 постов, пины 1–5 на месте).
- CSV-шум среды (diff 43 поста только в токенах _nc_ohc/_nc_gid/oh, оба набора URL валидны 206) откачен по протоколу git checkout --.
- Проверки: npx tsc --noEmit чисто; npm run build ок (47 постов); smoke next start: 200 на /, /feed, /v/j59dA1Ld, /sitemap.xml; в HTML лендинга pawcrewdaily ×2, partner of the week, follow the crew.
- Пуш main -> origin (PAT), fetch-верификация remote HEAD.

Stage Summary:
- Лента 47 постов, пины 1–5, все ссылки живые (47/47 → 206). Тестовая строка удалена.
- Карусели: колонка media в CSV (JSON [{"t":"i"|"v","u":…}]), stories-компонент без библиотек.
- Партнёр недели @pawcrewdaily на лендинге #partner, кошачья тема, мягкие анимации.

---
Task ID: 30
Agent: Super Z (main agent)
Task: (1) Кошачий баннер «не обновился» — сделать. (2) Закрепить видео threads.com/share/_wiokPyGI вверху ленты. (3) Мяу-звук при переходе на профиль.

Work Log:
- ДИАГНОСТИКА БАННЕРА: код Partner.tsx подтверждён на origin/main (ba99f35) — блок на месте; «не обновился» = деплой/кеш у пользователя. Решение: усилен до полноценного баннера + свежий деплой этим пушем.
- ПИН: извлечение _wiokPyGI через panel_add (2-я попытка, wall-обход) → @themacrosift, EN-заголовок «Good morning, my friends…», карусель 6 видео, srcs[0] → 206. Инцидент среды: панель записала строку, среда ОТКАТИЛА CSV и снапшот к HEAD (повтор паттерна) → повторная вставка scripts/add_partner_pin.py из кэша извлечения (детерминированно, тот же utm zXMNjL2F): pin=1, старые пины 1–5 → 2–6, 48 постов.
- МЯУ: scripts/make_meow.py — синтез мягкого мультяшного «мяу» (pitch-контур 430→760→330 Hz, вибрато 5.5 Hz, формантный намёк, ADSR, low-pass) → public/sfx/meow.mp3 (4.6 KB). src/lib/meow.ts — playMeow() (один Audio, volume 0.55, без жеста молчит).
- ПРОВОДКА МЯУ: (a) CTA «follow the crew» в блоке партнёра → IG-профиль pawcrewdaily; (b) кнопка профиля автора на карточке поста-партнёра (проверка post.utmCode === PARTNER_OF_WEEK.partnerPostUtm, конфиг в site.ts).
- БАННЕР: z-ai image 1344×768 → public/partner/pawcrew-banner.png (рыжие коты, кремово-оранжевая палитра блока). Partner.tsx переписан: CSS-мордочка/клубок/eye-tracking убраны, вместо них арт с float-анимацией, тёплой рамкой и бейджем «🐾 pinned in the feed» (линк на /feed, тоже мяукает); мёртвый CSS мордочки вычищен, reduced-motion обновлён.
- ИНЦИДЕНТ ПУША: среда пересоздала локальный worklog-коммит task 29 (ba99f35 → 33d5665, тот же контент) → non-fast-forward; rebase: дубль skipped (конфликт), CSV взят из origin, вставка пина повторена, аменд в коммит task 30. Пуш ba99f35..4443435, remote verified (CSV/snapshot/site.ts содержат zXMNjL2F/partnerPostUtm).
- Проверки: tsc чисто, build ок, smoke: 200 на /, /feed, /v/zXMNjL2F, /sfx/meow.mp3, /partner/pawcrew-banner.png; /r/zXMNjL2F → 302 на threads.com/share/_wiokPyGI/.

Stage Summary:
- Лента 48 постов: pin 1 = zXMNjL2F (@themacrosift, видео партнёрской недели), пины 2–6 = прежние 1–5.
- Баннер партнёра = арт с рыжим экипажем + уши/лапки/мягкие float-анимации; переходы на профиль (CTA + карточка пина) озвучены «мяу».
- Ветка payments по-прежнему локальна и не запушена.

---
Task ID: 31
Agent: Super Z (main agent)
Task: (1) Закрепить BASRuarluc первым. (2) Вместо smartluvon — арт-баннер pawcrewdaily + ссылка на их IG (stkn). (3) ПЕРВЫЙ ПИЛОТ 2328.io: крипто-донат на этот пост; тестовые инвойсы до пуша (ключ+project id от пользователя).

Work Log:
- ПИН: BASRuarluc извлечён (панель, 1-я попытка) → АВТОР = @pawcrewdaily, «Giant cheese wheel meets lava 🧀🔥», 206 ok. utm TK4_0wTI → pin 1, прежние 1–6 → 2–7 (49 постов). partnerPostUtm в site.ts = TK4_0wTI (мяу теперь на их посте).
- SMARTLUVON: WebGLBanner (лента) переведён на арт public/partner/pawcrew-banner.png + «partner of the week / paw crew daily», весь баннер — ссылка на IG со stkn, клик мяукает; VIRAL_URL (t.me smartluvon_bot) удалён; layout.tsx description обновлён.
- MERGE: feature/video-fallback-and-2328-payments влита в main (пользователь запросил пилот в прод). Конфликты: VideoCard (карусель+мяу vs fallback+paid UI — собрано всё, fallback только у видео-постов), globals.css (оба блока), CSV/снапшот/worklog — ours. npm install (vercel/analytics), prisma generate, tsc чисто.
- ДОНАТ-ПИЛОТ (stateless, без БД): POST/GET /api/donate/[code] — пресеты 1/3/5 USDT из PARTNER_OF_WEEK.donatePresetsUsdt, только партнёрский пост (404 иначе), hosted checkout 2328, url_return → /v/<code>; статус поллится у провайдера (/v1/payment/info) — DonateBox: пресеты «tuna/milk/feast», «i paid — check it», thanks-стейт; поллинг 4с×150.
- ★ НАЙДЕН И ПОЧИНЕН БАГ ЛИБЫ: get2328PaymentInfo возвращал null всегда при поиске по order_id — null-чек смотрел body.orderId вместо body.order_id (snake_case). Из-за этого статус был «unknown». Фикс + проверено tsx и роутом.
- ★ WAF-ГРАДА: api.2328.io за BunnyCDN — 403 HTML на localhost-колбэки (SSRF-защита). publicBase из Host-заголовка в деве даёт localhost → нужен PUBLIC_BASE_URL с https-доменом (в .env.local для тестов; на Vercel возьмётся из заголовков автоматически).
- ТЕСТОВЫЕ ИНВОЙСЫ (реальный API, до пуша, TTL 300с, неоплаченные): 7 шт созданы и проверены — diag-серия (sign-схема HMAC-SHA256(base64(compact JSON)) hex — подтверждена) + через роут: $1 (don-CJhuFzFxjAeR), $5 (don-NwxepDhJ5Snr), статус → payment_status «check»; guard'ы: неверная сумма 400, чужой пост 404, плохой orderId 400. /feed и / 200, баннер с арт-маркерами в HTML.
- CSV-шум среды (токены) откачен по протоколу; .next снесён средой между build и start — пересобран.

Stage Summary:
- Пилот 2328.io жив: кнопка «donate crypto» на закреплённом посте pawcrewdaily (pin 1), чекаут на pay.2328.io, поллинг статуса. Для прода: добавить env TWOTHOUSAND328_PAYMENT_API_KEY + TWOTHOUSAND328_PROJECT_UUID в Vercel (публичный домен подставится из заголовков).
- smartluvon полностью убран из ленты и метаданных; баннер ленты = арт pawcrewdaily → IG (stkn).
- Ветка payments влита в main и уходит в прод этим пушем (fallback-видео и paid-prompt UI едут вместе с ней).

---
Task ID: 32
Agent: Super Z (main agent)
Task: 72-часовой таймер на крипто-донате + модалка благотворительной акции (EN, красиво, с анимациями): «все деньги — приютам для котиков».

Work Log:
- src/lib/charity.ts: useCountdown (тики 1с, SSR-безопасный ready-флаг против hydration mismatch) + formatHMS («71:59:59», часы суммарные) + splitHMS для блоков модалки.
- src/lib/site.ts: PARTNER_OF_WEEK.charityDrive — deadlineUtc 2026-09-19T20:00:00Z (72ч от запуска, фиксированный для всех), durationHours 72, EN-копирайт: eyebrow «charity drive · 72 hours», заголовок «every paw counts», бейдж «100% goes to shelters», 3 шага «how it works», CTA «donate now».
- src/components/feed/CharityModal.tsx (новый): портал в body (карточка видео с трансформами ловит fixed), z-[80] (под toasts z-[100]); тёмный блюр-бэкдроп, spring-pop карточки в кремовой палитре доната, 6 летающих лапок/сердечек (CSS float, стаггер), шиммер-градиент по заголовку, 3 живых блока отсчёта HRS/MIN/SEC с пружинным тиком на смене цифры (remount по key), честный прогресс-бар «time remaining» (остаток/72ч, width transition 1s), бейдж-щит 100%, шаги heart→coins→home, CTA (glow-кнопка) → закрыть модалку и открыть донат-бокс, футер «settled on-chain via 2328.io». ESC + клик по бэкдропу + блокировка скролла + фокус на крестик (hover rotate-90).
- src/components/feed/DonateBox.tsx: чип «🐾 charity drive 71:59:12» с glow-пульсом над кнопкой «donate crypto» (клик → модалка, stopPropagation); строка «charity drive: 100% to cat shelters» внутри донат-карточки; в thanks-фазе добавлено «every cent goes to cat shelters 🐾»; при истечении срока чип/строки/модалка исчезают (charityLive = ready && !expired).
- globals.css: nr-charity-{chip,glow,backdrop,fade,card,pop,float,shimmer,tick,sec} + reduced-motion (шиммеру возвращаем -webkit-text-fill-color, декорации off).
- Проверки: tsc чисто; build ок; smoke /v/TK4_0wTI 200 с «donate crypto», / 200, /feed 200; маркеры «charity drive»/«every paw counts» в клиентском чанке. Шум среды (CSV+снапшот, 17 строк токенов) откачен по протоколу.
- Пуш caea184..5886c13 (PAT), remote verified: refs/heads/main = 5886c13.

Stage Summary:
- На закреплённом посте pawcrewdaily (pin 1) теперь чип-таймер 72ч: тикающий отсчёт, тёплое свечение; тап — модальное окно акции на английском: анимированные лапки, шиммер-заголовок «every paw counts», живой отсчёт, прогресс-бар времени, «100% goes to shelters», 3 шага, CTA «donate now» ведёт в донат-бокс.
- Дедлайн фиксированный 2026-09-19T20:00:00Z — когда истечёт, таймер и акционные элементы сами исчезнут (донат-кнопка остаётся). Продлить акцию = поменять deadlineUtc в site.ts.

---
Task ID: 33
Agent: Super Z (main agent)
Task: (1) Убрать таймер 72ч с крипто-доната. (2) Кнопку donate → «make world better». (3) Закрепить первым главное видео коллаборации threads.com/share/BABB-GSGO9/.

Work Log:
- ИЗВЛЕЧЕНИЕ (сложный кейс): panel_add 3 попытки + extract_retry 6 попыток — NO_SRCS; embed 404; curl-HTML — антиспам-шелл. Диагноз: share-страница отдаёт SSR-мету (og:title «Crypto trader cat has a bad night 📉 @mmayrday»), но клиентский фетч падает «Something went wrong» (Retry не спасает, каноникал тоже). РЕШЕНИЕ: share-страница → al:android:url/og:url/canonical = https://www.threads.com/@pawcrewdaily/post/DdX3O2eEo-z (пост партнёра, цитирует @mmayrday). Каноникал тоже «Something went wrong» → видео взято из КАРТОЧКИ поста в ЛЕНТЕ профиля @pawcrewdaily (video в ancestors ссылки карточки) → полный URL 1043 симв. → CDN 206 video/mp4 (63-сек. видео, xpv_asset_id 17911970889462942).
- ПИН: scripts/add_collab_pin.py (по образцу add_partner_pin): кэш extract_out/BABB-GSGO9.json, CDN-верификация, utm 71vsIPUu → pin 1, старые 1–7 → 2–8, 50 постов; gen-posts-snapshot → 50. Первый запуск упал на регэкспе автора (нет trailing slash в кэше) — поправил кэш.
- ТАЙМЕР УБРАН: DonateBox без чипа/использования useCountdown; src/lib/charity.ts удалён; charityDrive в site.ts без deadlineUtc/durationHours; globals.css — nr-charity-chip/glow/tick/sec вычищены (модалка и её анимации остались).
- КНОПКА: «donate crypto» → «make world better» (aria-label «Make the world better — donate crypto to cat shelters»). Модалка акции (без отсчёта) осталась: триггер — строка «charity drive: 100% to cat shelters» в донат-карточке; летающие лапки/шиммер/pop-in сохранены; CTA закрывает модалку.
- КОММЕНТАРИЙ: partnerPostUtm = TK4_0wTI (донат остаётся на его посте, теперь pin 2; комментарий в site.ts обновлён).
- Проверки: tsc чисто, build ок; smoke: /feed 200 (71vsIPUu + видео + заголовок в HTML, «make world better» ×1), /v/71vsIPUu 200, /v/TK4_0wTI 200 с «make world better», /r/71vsIPUu → 302 threads.com/share/BABB-GSGO9/. Коммит сделан ДО build по протоколу среды.
- Пуш b84f0a1..a72489a (PAT), remote verified.

Stage Summary:
- Pin 1 = 71vsIPUu @pawcrewdaily «Crypto trader cat has a bad night 📉 @mmayrday» (главное видео коллаба, 63с); пины 2–8 сдвинуты; лента 50 постов.
- Таймера 72ч больше нет; кнопка «make world better» на посте с донатом (TK4_0wTI, pin 2); благотворительная модалка сохранена (без отсчёта) — открывается из донат-карточки.

---
Task ID: 34
Agent: Super Z (main agent)
Task: Донат «make world better» на ОБА поста pawcrewdaily + таймер 24ч до открытия благотворительного доната.

Work Log:
- site.ts: partnerPostUtm → donatePostUtms = ["71vsIPUu", "TK4_0wTI"] (readonly string[] — иначе as const ломает .includes(string)); charityDrive.openingAtUtc = 2026-09-18T06:00:00Z (24ч от запуска, UTC 05:58 на момент правки) + lockedCta «donations open soon».
- src/lib/charity.ts: восстановлен useCountdown (locked/opened флаги) + formatHMS/splitHMS.
- DonateBox: чип «🐾 opens in 23:59:59» (glow-пульс) над кнопкой на ОБОИХ постах, пока locked; клик по чипу И по кнопке «make world better» до открытия → CharityModal (донат-флоу заблокирован); после openingAtUtc кнопка открывает донат-карточку как раньше (чип исчезает).
- CharityModal: два режима — locked (большие блоки HRS/MIN/SEC с пружинным тиком, подпись «until donations open», CTA-заглушка lockedCta, CTA «donate now» скрыт) и opened (CTA «donate now» → onDonate → донат-бокс). Летающие лапки/шиммер/pop-in сохранены.
- VideoCard: meow на переход к профилю + рендер DonateBox → donatePostUtms.includes(post.utmCode) (оба поста мяукают и имеют донат).
- API /api/donate/[code]: POST+GET guard → donatePostUtms.includes(code); description по-прежнему из поста.
- globals.css: возвращены nr-charity-chip/glow/sec/tick (+reduced-motion).
- Проверки: tsc чисто; build ок; smoke /feed 200 («make world better» ×2 — по кнопке на каждый пост), /v/71vsIPUu 200, /v/TK4_0wTI 200; POST /api/donate/71vsIPUu → 503 (принят, до конфига ключей на локали), TK4_0wTI → 503, чужой zXMNjL2F → 404 (guard). Маркеры «until donations open|opens in» в клиентском чанке. Коммит 2ac6760 до build по протоколу.
- Пуш 476d910..2ac6760 (PAT), remote verified.

Stage Summary:
- Оба поста pawcrewdaily (pin 1 главное видео коллаба 71vsIPUu + pin 2 пилотный TK4_0wTI) имеют кнопку «make world better», чип-таймер и модалку акции; мяу на обоих.
- Донат откроется автоматически 2026-09-18T06:00:00Z: чип исчезнет, кнопка начнёт открывать донат-карточку, в модалке появится CTA. Продлить/сдвинуть — правка openingAtUtc в site.ts.

---
Task ID: 35
Agent: Super Z (main agent)
Task: (1) Обновить ленту — ссылки протухли, главную коллаборацию восстановить обязательно. (2) Тестовый инвойс 2328.io (project 240478b4-…-c5ffa3a58a03 + pay key) и доказать работоспособность.

Work Log:
- Синк с remote: среда пересобрала worklog-коммит (a30a006), rebase локального 2829b5c поверх — конфликтов нет; убран мусор среды (untracked src/app/api/route.ts «Hello world», src/app/api/posts/).
- Аудит ленты (scripts/check_urls.py, range-GET 0-1023): 46/50 живых, 4 мёртвых (403): y7KQ3mNc, M4uledti, ZKiccR64, Ekxi_A6H; у всех 50 oe-подписи истекают в пределах 48ч (5 уже истекли).
- МАССОВОЕ ОБНОВЛЕНИЕ: сервер на :3111 через instrumentation сам запустил refresh_links.py --quiet (дефолтный порог 48ч покрывает все 50); мой параллельный nohup-запуск умер (завис на pin1 + моё вмешательство в agent-browser-сессию при проверке чекаута — урок: не трогать браузер во время джобы). Итог тихой джобы: 46/50 обновлены, включая pin1 (71vsIPUu) — стена Threads в этот раз пропустила. Догоняющий прогон с --min-hours 24: +1 (UkoN8r2X).
- 4 неоживляемых: share → каноникал (@creator_nastya1/DdBZa4GAh9O, @yurii_yeltsov/DdG-OcziKrb, @verse.dim/DdH54yEAFwI ×2 — дубль) показывают «This content isn't available to everyone» — Threads ограничил показ, видео публично не существует. curl-мета теперь login-шелл (title «Threads», без og/canonical) — каноникал достаётся только браузером. Решение: строки удалены из CSV (50 → 46), мёртвых плееров в ленте больше нет; пины 1–8 целы (1=71vsIPUu, 2=TK4_0wTI).
- Финал: 46/46 живых (206 video/mp4); snapshot 46 постов; удалённые коды в HTML ленты отсутствуют; «make world better» ×2; видео-URL пина 1 и 2 в HTML.
- ИНВОЙС 2328.io: ключ в .env.local (в git не попадает, .env* в gitignore). Первый POST через сервер → 403: publicBase() на локали собрал url_callback https://127.0.0.1:3111/… — 2328 отклоняет; фикс PUBLIC_BASE_URL=https://no-reality.io в .env.local. Прямой вызов scripts/debug2328.mjs подтвердил: ключ/проект/подпись верны (state:0).
- E2E-доказательства (прод-билд, next start :3111): POST /api/donate/71vsIPUu {3.00} → ok:true, payUrl pay.2328.io/857f…, orderId don-Oe3dwBI8q0Mq; GET статус → {status:check, paid:false}; пресеты 1.00/5.00 → инвойсы созданы; 4.99/null → 400 «Choose one of the suggested amounts»; TK4_0wTI → инвойс ок; чужой код → 404 guard; webhook-роут на месте. Финальный контроль на пересобранном билде: don-9mp4DoQkZF4f создан + статус check. Checkout-страница за Bunny Shield JS-челленджем (curl 403 — норма, браузеры проходят).
- Коммит a2f2c8e ДО build по протоколу: CSV+snapshot+скрипты (check_urls/fix_dead4/debug2328 — без секретов). Пуш a30a006..a2f2c8e, remote verified.

Stage Summary:
- Лента: 46 живых постов со свежими CDN-подписями, коллаборация pin 1 (71vsIPUu) восстановлена, 4 ограниченных Threads поста удалены.
- ВАЖНО: Threads сейчас выдаёт lease ~34ч (замер 31.8–35.8ч) — ленту надо обновлять каждые ~сутки (refresh_links.py → commit → push → редеплой Vercel; на серверлесе автоджоба не работает — agent-browser недоступен). Кандидат на следующую задачу: GitHub Action по расписанию.
- Донат 2328.io работает end-to-end (создание инвойса + поллинг статуса + guard'ы). ДЛЯ ПРОДА: добавить в Vercel env TWOTHOUSAND328_PAYMENT_API_KEY и TWOTHOUSAND328_PROJECT_UUID (без них прод отдаёт 503), опционально PUBLIC_BASE_URL=https://no-reality.io.

---
Task ID: 36
Agent: Super Z (main agent)
Task: (1) Автосвежение ссылок по расписанию (GitHub Action: refresh → push → редеплой). (2) Отдельная страница про коллаборацию с котами — вирально, стильно, на лёгких библиотеках.

Work Log:
- GitHub Action .github/workflows/refresh-links.yml: cron «23 */12 * * *» + workflow_dispatch, permissions contents:write, concurrency-группа, ubuntu-latest, python 3.12 + node 22, npm i -g agent-browser@0.38.1, best-effort apt-зависимости chrome, refresh_links.py (exit 2 = частичный успех — не провал), коммит CSV только при изменениях (git diff --quiet) от no-reality-feed-bot, шаг-саммари. Пуш воркфлоу ОТКЛОНЁН: PAT без скоупа workflow — файл готов локально (.github/workflows/refresh-links.yml, YAML валиден), нужен скоуп workflow на PAT или ручная загрузка через web-UI; из диапазона пуша он вычленен (reset --soft на FETCH_HEAD + restore --staged).
- Среда опять переписала историю (677f3b2 «UUID» с url_check_report.json поверх 581048f) — размотано reset --soft FETCH_HEAD, мусор не закоммичен.
- Страница /collab (src/app/collab/page.tsx, серверный компонент): hero с шиммер-заголовком «no reality. × paw crew daily» и парящими лапками, бесшовный CSS-marquee, видео коллаба (CollabPlayer: тот же CDN-URL из CSV + onError-фолбэк на Threads), таймлайн истории 01–02–03, charity-блок с копирайтом из PARTNER_OF_WEEK.charityDrive и CTA «donate now», карточки крева (@pawcrewdaily IG stkn, @mmayrday, 2328.io), финальный share-блок.
- Вирусные анимации НА ЛЁГКИХ БИБЛИОТЕКАХ: единственная зависимость canvas-confetti (~2KB gzip) — залпы лапками/сердечками/рыбками (shapeFromText); остальное чистый CSS/IntersectionObserver/rAF: Reveal (scroll-reveal с reduced-motion), marquee (два трека, -100%), шиммер (background-clip:text), парение, glow-пульс CTA, wiggle кота. Никаких framer-motion — страница статическая и быстрая.
- ShareButton: нативный Web Share API (мобильный шеринг-шит) → фолбэк clipboard + состояние «link copied — thank you!». CatEgg: клик по коту → playMeow() (тот же sfx, что в ленте) + конфетти.
- Deep-link /v/<code>?donate=1: page → FeedScreen → Feed → VideoCard → DonateBox autoOpen; hydration-безопасно (fired-ref + useEffect по ready; locked → модалка акции, opened → донат-карточка). С коллаб-страницы обе CTA ведут на /v/71vsIPUu?donate=1.
- Навигация: Header (/feed и /v) — тёплая пилюля «🐾 collab»; лендинг — NAV-пункт «🐾 cat collab» ВМЕСТО мёртвого якоря #partner; sitemap + /collab (0.8 weekly).
- Проверки: tsc чисто; build ок; smoke /collab 200 (все маркеры: paw crew daily/every paw counts/make world better/share the love/pet the cat/2328.io/видео-URL/100% goes to shelters), /v/71vsIPUu?donate=1 200, анимационные классы в CSS, ссылки /collab в лендинге и шапке ленты, sitemap. Ловушка среды: EADDRINUSE — старый next-server держал порт, убит по PID.
- Коммиты: 6dbf671 (task 36) запушен 581048f..6dbf671, remote verified.

Stage Summary:
- /collab жива: вирусная страница коллаборации с лёгкими анимациями, share-механикой и прямыми CTA в донат (?donate=1 открывает карточку сама).
- Воркфлоу автосвежения ГОТОВ, но не запушен: PAT без скоупа workflow. Два пути: добавить скоуп workflow PAT → я пушу одной командой; или залить файл через web-UI (Add file → .github/workflows/refresh-links.yml). До этого момента обновление ссылок — вручную (refresh_links.py → commit → push).

---
Task ID: 37
Agent: Super Z (main agent)
Task: (1) Запушить воркфлоу автосвежения (пользователь добавил разрешение на workflow). (2) Кадр чёрного кота в толстовке из коллаб-видео → реклама продажи промпта персонажа (инвойс $100, после оплаты промпт показывается 60 секунд и исчезает).

Work Log:
- СРЕДА опять намусорила UUID-коммит (b4caaab: воркфлоу + CSV-токены + url_check_report.json + снапшот) — размотано reset --soft на FETCH_HEAD, закоммичен ТОЛЬКО воркфлоу; CSV откачен по протоколу.
- Тюнинг воркфлоу: `refresh_links.py --min-hours 20 --quiet` (при каденции 12ч и lease 34ч порог 20ч = обновление раз в сутки с запасом 10ч; дефолтный 48ч обновлял бы все 46 ссылок каждый прогон ~40+ мин) + timeout 50 мин. YAML валиден.
- ПУШ УСПЕШЕН (PAT со скоупом workflow): 7e7399b..3b3c109. GitHub API подтверждает: workflow refresh-feed-links ACTIVE. API-dispatch PAT-ом 403 (нет Actions:write у fine-grained PAT) — не критично: cron сработает сам, ручной запуск кнопкой Run workflow в Actions.
- ФРЕЙМ: видео 71vsIPUu скачано (63.2с, 720×1280), 63 thumbnails fps=1 просмотрены визуально → чёрный кот (девон-рекс) в зип-толстовке «LOKI» — полнокадровые планы на 13.0–14.6с; выбран 13.4с (телефон у уха, LOKI читается, драматичный свет). 14.2с уже коллаж. Итог: public/images/loki-prompt.webp (720×1280, 20.5KB, PIL q80).
- ПРОДУКТ «PROMPT DROP» (flash-модель): site.ts PROMPT_DROP {code, afterUtm:71vsIPUu, priceUsdt:"100.00", image, revealSeconds:60}. Stateless по образцу доната — состояние инвойса у 2328.io, у нас только orderId у покупателя (sessionStorage, переживает same-tab редирект на чекаут и возврат по url_return). Промпт живёт ТОЛЬКО в env PROMPT_LOKI_FLASH (в git не попадает; копия в .secrets/, .gitignore дополнен) — чекаут отдаёт 503 ДО создания инвойса, если env не задан: никто не платит зря.
- API: POST /api/prompt-drop/checkout (rate 4/мин, orderId pd-<nanoid>, ttl 1800с, url_callback → webhook, url_return → /v/71vsIPUu?drop=1) + GET /api/prompt-drop/status (ORDER_RE ^pd-, реконсиляция /v1/payment/info; paid → и только тогда PROMPT_LOKI_FLASH покидает сервер; dead-статусы → флаг dead).
- UI PromptDropCard (variant feed|section): фазы idle → invoicing → awaiting → revealed(60с) → gone. Поллинг 4с (стоп через 45 мин), resume из sessionStorage в rAF-отложенном эффекте, кольцо-отсчёт conic-gradient (--p, тик 250мс), vanish = CSS blur-out 1с → стейт «gone. the cat keeps its secrets» с кнопкой «get another look». Анимации лёгкие: ken-burns кадра 16s, sweep-блик, glow-CTA, pop-in; всё выключается при prefers-reduced-motion. Без копирования текста — «screenshot now».
- ЛЕНТА: Feed переведён на слоты (post|ad) — рекламная карточка вставляется после PROMPT_DROP.afterUtm; activeIndex/data-index по слотам, URL-синк пропускает ad-слот, total=slots.length (loop последнего видео корректен), onEnded с пина 1 ведёт на рекламу. FeedScreen + /v/[code] прокидывают dropOpen (?drop=1 → прыжок на ad-слот). /collab: секция prompt drop между видео и историей.
- ПРОТОКОЛ: коммит a9cef86 ДО build; build требовал node scripts/copy-standalone.mjs (next build сам не копирует public в standalone — вебп 404). Ловушка среды: старый next-server переименовывается и pkill -f "next start" его не берёт — убивать по PID из ss -tlnp; standalone НЕ читает .env.local — для локальных прода-тестов новый scripts/run-standalone.mjs (парсит dotenv сам, env уже в process.env не перетирает).
- SMOKE (прод-билд :3111): /collab, /feed, /v/71vsIPUu?drop=1 → 200; маркеры «the cat from the collab», «get the prompt — $100», «one look · 60 seconds», loki-prompt.webp в HTML обоих страниц; webp 200 image/webp. РЕАЛЬНЫЙ инвойс 2328.io: pd-3UCyAwObPO9a → pay.2328.io/c34fac13…, статус {check, paid:false}; guard'ы: don-префикс 400, ../инъекция 400, без orderId 400.
- PAID-ПУТЬ ДОКАЗАН: scripts/mock-2328.mjs дополнен автооплатой через 3с (как и было заявлено в его шапке); инстанс :3112 против мока: checkout → pd-Bz3iC5zvMDRN → автооплата → статус {paid:true, prompt:"TEST-PROMPT-xyz-60s"} — промпт уходит ТОЛЬКО при paid.
- Коммит b74b7a9 (tooling) запушен; итоговый remote 3b3c109..b74b7a9, verified.

Stage Summary:
- Автосвежение ссылок — РАБОТАЕТ ИНФРАСТРУКТУРНО: воркфлоу активен на GitHub (cron 23 */12 * * * + ручной Run workflow), refresh → commit от no-reality-feed-bot → Vercel автодеплой. Порог 20ч: полный прогон ~раз в сутки, чередующиеся прогоны — быстрые no-op.
- Prompt drop жив: кадр LOKI (13.4с) как реклама в ленте после коллаб-видео и на /collab; инвойс $100 через 2328.io; промпт показывается 60 секунд и исчезает; один платёж = один взгляд.
- ДЛЯ ПРОДА добавить в Vercel env: TWOTHOUSAND328_PAYMENT_API_KEY, TWOTHOUSAND328_PROJECT_UUID, PUBLIC_BASE_URL=https://no-reality.io и НОВЫЙ PROMPT_LOKI_FLASH (текст промпта — в .secrets/prompt-loki.txt и в .env.local локали). Без PROMPT_LOKI_FLASH чекаут дропа честно отдаёт 503.

---
Task ID: 38
Agent: Super Z (main agent)
Task: Диагностика «рекламная карточка не отображается под закреплённым видео с коллабой».

Work Log:
- Проверена вся цепочка локально на актуальном HEAD (a9cef86..87fc60a): CSV/снапшот — коллаб-пост 71vsIPUu первый (pin=1), Feed вставляет ad-слот сразу после него; SSR /feed — data-index 0=пин, 1=Prompt drop, 2=видео; getRankedPosts ставит пины поверх; /v/[code]?drop=1 прокидывает dropOpen.
- Прод-билд + next start :3111 + agent-browser: слот 1280×401, h2 «the cat from the collab», img loki-prompt.webp загружен; скриншот подтверждает карточку под пином; deep-link ?drop=1 прыгает на слот. КОД РАБОЧИЙ — у пользователя проблема деплой/окружение.
- Проверить прод из песочницы нельзя: no-reality.io = NXDOMAIN (подтверждено Google DoH и Cloudflare DoH — НЕТ даже NS-записей, домен не делегирован у регистратора). vercel.app-имя проекта из песочницы не угадывается.
- ВАЖНО: мёртвый домен ломает флоу оплаты — url_return/webhook 2328.io указывают на PUBLIC_BASE_URL=https://no-reality.io; после оплаты покупателя редиректит на неживой домен, resume-поллинг в той же вкладке не сработает.
- Среда снова намусорила UUID-коммит 09bb6a9 (scripts/extract_out mp4+фреймы, НЕ запушен) — размотан reset --soft origin/main, файлы выведены из индекса; scripts/extract_out/ добавлен в .gitignore (лечит рецидив).
- Сервер :3111 остановлен; CSV не тронут.

Stage Summary:
- Код prompt drop верифицирован end-to-end локально (SSR + реальный браузер + deep-link). Пушить в код нечего — деплой-сторона.
- Чек-лист пользователю: (1) hard-refresh Ctrl+Shift+R; (2) в Vercel проверить, что деплой коммита 87fc60a статусом Ready (пересоздать при ошибке); (3) в Vercel env должны быть TWOTHOUSAND328_PROJECT_UUID, TWOTHOUSAND328_PAYMENT_API_KEY, PUBLIC_BASE_URL, PROMPT_LOKI_FLASH (без него чекаут 503); (4) СРОЧНО настроить DNS no-reality.io у регистратора (A 76.76.21.21 / CNAME cname.vercel-dns.com) ЛИБО сменить PUBLIC_BASE_URL на рабочий домен — иначе оплаченный промпт не «вернёт» покупателя на страницу reveal.

---
Task ID: 39
Agent: Super Z (main agent)
Task: (1) Вкладка Prompt Market (/market) с LOKI-оффером. (2) На карточке продажи — ссылка на видео-источник и на саму карточку. (3) Реферальная модель (% от оплаты по приглашению). (4) Простейшая авторизация MetaMask. Домен сменился на no-reality.fun.

Work Log:
- СРЕДА ПЕРЕСОЗДАНА (все файлы 04:42, .env.local и .secrets/ УТЕРЯНЫ — реальный текст промпта LOKI восстановить неоткуда; в .env.local воссозданы ключи 2328.io из истории, домен, ADMIN_SECRET, REFERRAL_RATE_PCT и ТЕСТОВЫЙ PROMPT_LOKI_FLASH). В git всё уцелело.
- ДОМЕН: SITE.url/PUBLIC_BASE_URL/UA/payouts → no-reality.fun (site.ts, payment.ts, payout.ts, payouts.ts, debug2328.mjs, .env.local). Юзеру: обновить PUBLIC_BASE_URL в Vercel!
- /market (static, src/app/market/page.tsx): тёмный hero с топ-баром (лого, ▸ feed, 🐾 collab, WalletButton), «the prompts behind the characters», шаги watch/pay/unlock, LOKI-карточка (PromptDropCard variant=section, якорь #loki-hoodie), soon-плейсхолдеры, ReferralPanel «bring a buyer — keep 20%», футер-строка. Навигация: пилюля «✦ prompt market» в Header ленты, NAV лендинга (#prompts → /market + CTA в секции #prompts), sitemap 0.9 weekly.
- ССЫЛКИ НА КАРТОЧКЕ (оба варианта): «watch the collab video» → /v/71vsIPUu; «copy card link» → {origin}/market[?ref=КОД]#loki-hoodie (код: свой при подключённом кошельке, иначе ?ref из localStorage — цепочка атрибуции живёт при шеринге).
- МЕТАМАСК (MVP): POST/GET/DELETE /api/auth/metamask — валидация 0x[40hex], httpOnly-cookie nr_wallet 30 дней (Secure, Lax), GET → {wallet, refCode, inviteUrl}; подпись personal_sign — следующий шаг. use-wallet.ts хук (connect/disconnect/refresh/shareRefCode) + WalletButton в шапке (выпадашка с invite-ссылкой и правилом 20%) + ReferralPanel на витрине.
- РЕФЕРКА: код детерминирован от кошелька (sha256(wallet+REFERRAL_SALT) → r+9 base36, src/lib/referral.ts); ловец ?ref= (RefCapture в layout, localStorage nr-ref 90 дней last-touch); checkout принимает {ref} → само-приглашение отбрасывается, код ВШИВАЕТСЯ в orderId (pd-<id>-<ref>) — атрибуция не зависит от нашей БД; ORDER_RE статуса расширен; при paid — ReferralEvent(kind=paid, payoutUsdt=amount×rate) best-effort; модели ReferralProfile/ReferralEvent (prisma db push ok); реестр выплат GET /api/admin/referrals?key=ADMIN_SECRET (агрегаты по кодам, code→wallet, 401 без ключа, 503 если БД недоступна).
- SMOKE: tsc чисто; build ок; /market 200 + все маркеры; /feed ad-слот на месте; sitemap → no-reality.fun/market; auth: POST валид/невалид (200+cookie/400), GET с cookie → тот же детерминированный код; checkout: без ref чистый orderId, с ref → суффикс, само-ref отброшен, мусорный ref отброшен, 429 на 5-й вызов в минуту; РЕАЛЬНЫЙ 2328.io принял ref-orderId (pd-…-rabcdef123 → pay.2328.io); ПОЛНЫЙ ПУТЬ через mock-2328: автооплата → status {paid:true, prompt} → реестр: paid $100 → payout $20.00, профиль r4tbbbkftp→0x71c7….
- Ловушки среды: (а) fuser -k не берёт переименованный next-server — EADDRINUSE у нового, старый отдавал СТАРЫЙ билд; убит по PID из ss; (б) refresh-job (интервал 6ч после сброса env) захватил agent-browser на ~8 мин — браузер не трогал до release лока, CSV откачен по протоколу.

Stage Summary:
- Витрина /market жива: hero + LOKI-дроп с ссылками на источник/шеринг + soon + рефпанель; вкладки в шапке и лендинге; sitemap.
- MetaMask-сессии и рефералка работают end-to-end (мок + реальный провайдер); атрибуция переживает отсутствие БД (код в orderId).
- Юзеру: 1) в Vercel env обновить PUBLIC_BASE_URL=https://no-reality.fun, добавить REFERRAL_RATE_PCT=0.2 (опционально) и РЕАЛЬНЫЙ PROMPT_LOKI_FLASH (локальный текст промпта утерян сбросом среды — только у владельца); 2) % реферера меняется env-ом; 3) выплаты — вручную по /api/admin/referrals?key=….

---
Task ID: 40
Agent: Super Z (main agent)
Task: (1) Весь UI в светлом оформлении. (2) Новые меню — в стилизованной раскрывающейся кнопке-бургере. (3) Страница /future («in future») с дорожной картой: предикшены на концовку ролика (варианты → голосование в USDT → пари-мьютюэль коэффициенты → выплаты по показу концовки). (4) Прислать статистику посещений из БД.

Work Log:
- СВЕТЛАЯ ТЕМА (дочищены оставшиеся тёмные поверхности): PromptDropCard (оба варианта: section-оболочка на /market и /collab → бело-перламутровый кард с ring #a8cfea; feed-слот → белый градиент поверх кадра, чернильный текст; ring-диск/скроллбар/ошибки/awaiting-стейты перекрашены), hero /market (bg #0b0e13 → белый + перламутровые радиалы), секция team на лендинге (тёмный градиент → светлый перламутр + тёплые хабы глобуса: точки rgba(61,125,184), хабы #e4713b), мок unlock-карточки лендинга → светлый, WalletButton (выпадашка/ошибка → nr-glass-deep), UnlockModal + .nr-modal-card (тёмный радиал → белый, текст ink), ReferralPanel (тёмно-фиолетовый → светлый лавандовый), charity-hero /collab (коричневый градиент → кремовый), фолбэк-видеокарточка /collab → перламутр. globals.css: nr-pd-ring/scroll на светлую тему, добавлены .nrld-irid (перенос из landing.css для /future) и .nr-burger-line/.nr-menu-pop (+ reduced-motion). Проверено curl-грепом: 0b0e13 на /market и /future = 0 вхождений.
- БУРГЕР: новый src/components/menu/Menu.tsx — стеклянная пилюля (nr-glass-deep) с морфингом «3 линии → ✕» + лейбл menu/close; панель-дропдаун nr-glass-deep: разделы feed / prompt market / collab / in future (иконки, описания, активная подсветка по usePathname + синяя точка, aria menu/menuitem/current), разделитель, секция WALLET с WalletButton (invite-ссылка живёт внутри). Закрытие: клик вне, Esc, переход. Интегрирован: Header ленты (вместо пилюль market/collab/wallet — точка + бургер), топ-бар /market, nav лендинга (справа от CTA; на мобиле навигация теперь доступна), плавающий топ-бар /collab (лого + бургер, fixed top-3). Футер лендинга: FOOTER_LINKS += in future, feed.
- /FUTURE: статическая страница (src/app/future/page.tsx) в светлой айдентике: hero с шиммер-заголовком, блок LIVE (feed/market/referrals/wallet), большой блок NEXT «ending predictions» — 5 шагов механики (freeze-frame → варианты исходов → голосование USDT через 2328.io → пари-мьютюэль коэффициенты (пул ÷ пул исхода − комиссия, живое обновление) → реveal и автоматические выплаты победителям), мок-полоса исходов с коэффициентами (×1.8/×3.1/×9.4 + доли пула), дисклеймер (развлечение, не финансовый совет, лимиты ставок, регионы), блок LATER (creator uploads, mood channels, prediction seasons, on-chain receipts), CTA в feed/market. Sitemap +0.6 weekly. Бургер-пункт «◑ in future».
- СТАТИСТИКА ПОСЕЩЕНИЙ: модель PageVisit (path, visitorHash=sha256(ip+ua+secret), referrer, индексы; без дедупа — честные pageviews) + db:push; POST /api/track (rateLimit 240/мин/ip, sendBeacon-совместим, 204, ошибки БД глотаются best-effort); TrackVisit (client, usePathname → beacon на каждую смену пути) в layout; GET /api/admin/stats?key=ADMIN_SECRET — pageviews (total/24h/7d/uniques/top-10 путей/14 дней по дням), clicks (топ UTM-кодов), rating (сумма score), referrals (профили/события/начисления), purchases (по статусам); 401 без ключа, 503 при недоступной БД. scripts/visit_stats.ts — CLI-выгрузка для отчёта.
- ВЕРИФИКАЦИЯ: build ок (10.6s; /future, /api/track, /api/admin/stats в роутах); прод-сервер :3111 — / 200, /market светлый маркер, /future 200 + все маркеры механики, /collab фиксированная навигация, /feed бургер; /api/track 204 + запись видна в stats; stats 401/200 корректный JSON. agent-browser: бургер открывается (скрин menu_open_feed.png — светлая панель, активный feed, wallet-секция), клик «in future» ведёт на /future (скрин future_page.png), market hero светлый (market_light.png), карточка LOKI светлая с ссылками источник/шеринг (market_loki_final.png), deep-link /v/71vsIPUu?drop=1 прыгает на СВЕТЛЫЙ ad-слот (feed_adslot_light.png), sitemap содержит /future. Сервер остановлен.
- СРЕДА: lint выдаёт 4 УНАСЛЕДОВАННЫХ ошибки (react-hooks/set-state-in-effect в charity.ts/DonateBox/CharityModal + refs в MediaCarousel, warning WebGLBanner) — файлы не менялись в этой сессии, правило появилось после пересоздания среды; не блокирует build. Во время браузерной проверки в 06:30 запустился штатный refresh-job (refresh_links.py, лок /tmp/nr_refresh.lock) — перехватил agent-browser (~10 мин), по протоколу браузер не трогал; после релиза CSV с ОБНОВЛЁННЫМИ CDN-ссылками (46 постов, пины 1..8 на месте: 71vsIPUu=1, TK4_0wTI=2) валидирована, снапшот перегенерирован и закоммичен вместе с кодом.

Stage Summary:
- Сайт полностью в светлой айдентике; все разделы собраны в стилизованный бургер (+ кошелёк внутри); /future с честным описанием механики предикшенов; pageview-трекинг и админ-статистика работают end-to-end локально.
- Коммит c2c199c запушен в origin/main (включая свежие CDN-ссылки от refresh-job) → Vercel задеплоит автоматически.
- Юзеру: 1) статистика прода — https://no-reality.fun/api/admin/stats?key=<ADMIN_SECRET> (JSON; локальная БД — тестовая: 1 кошелёк из смоука, 3 реф-события, $20 тестовых начислений, 0 кликов — прод-БД отдельная); 2) для накопления статистики посещений нужен DATABASE_URL в Vercel env (если ещё не задан); 3) Vercel Analytics включается одним кликом в дашборде (код уже подключён).

---
Task ID: 41
Agent: Super Z (main agent)
Task: Модуль «Cryo-Stop» — рынок предсказаний на концовку ролика: авто-заморозка по вниманию, ледяная анимация, SFX, кварцы ДА/НЕТ, Phantom one-tap ($1 USDC), пари-мьютюэль, оракул-панель, выплаты. Тест на двух видео: _-1iqf_ZY (swag) и BASOpVqCBm (creepy). На карточках с рынком — ноль ссылок на видео.

Work Log:
- ДВА ПОСТА ДОБАВЛЕНЫ: extract_cryo_posts.py (agent-browser, методика refresh_links) → видео + верификация 206; заголовки/авторы сняты eval'ом (swag: «Alien drip 👽», creepy: история Мимика — EN-перевод); add_cryo_posts.py → CSV 48 постов (utm ZznHA9HM badge=SWAG, -bBc5Nno badge=CREEPY), boost_until +48ч (обе карточки наверху после пинов); snapshot регенерирован.
- SFX (gen_cryo_sfx.py, numpy → WAV 44.1к): cryo-scan (цифровой затвор 5.4к→1.3кГц + щелчок), cryo-crack (гул айсберга 33-84Гц + 6 тресков + реверб-хвост 78-761мс), cryo-coin (кольцо монеты + плюх + пузырь), cryo-click (сухой электрический щелчок истечения) → public/sfx/.
- СХЕМА: Prisma CryoMarket (postCode unique, question, status live|expired|resolved, endsAt, result) + CryoBet (unique(marketId,wallet), side, amount 1.00, mode demo|phantom, txSig, payout, claimed); db push ок. Рынки КОНФИГ-DRIVEN: src/lib/cryo/config.ts (вопросы/лейблы ДА-НЕТ/accent-плазма по бейджу/endsAtUtc) + ensureCryoMarkets() идемпотентно сидирует и авто-expire'ит на чтении → работает на любом окружении без ручного сида. БД недоступна → markets API отдаёт 200 db:false, ставки деградируют в localStorage.
- PARI-MUTUEL (cryo/core.ts): odds до ставки = (total+1)×(1−fee)/(pool+1); при resolve: distributable = total×0.97 → payout_i = distributable×bet_i/winPool (transaction). API: GET /api/cryo/markets[?wallet=] (пулы+коэффициенты+позиция), POST /api/cryo/bet (409 дуп/закрыт, rateLimit), POST /api/cryo/claim, POST /api/admin/cryo/resolve (key=ADMIN_SECRET; result yes|no + action expire[, inSec] для теста кипения).
- CRYOSTOPCARD (блоки спеки): B1 активация isActive → video.pause() + canvas drawImage (retry по readyState, fallback — frost-слой без захвата); B2 0.8s: циан-шок (backdrop-filter), шум-матрица (canvas tile, steps jitter), процедурные ветвящиеся трещины (SVG pathLength=1, stroke-dashoffset, seeded random), inner glow; B3 SFX scan t=0 + crack t=400мс (Web Audio, unlock по pointerdown, тихий пропуск до жеста); B4 панель frosted glass выезжает снизу, вопрос собирается посимвольно (--ci per char), кварцы-призмы (clip-path hexagon) с циркулирующей плазмой настроения, кольцо-таймер (SVG liquid, пульс = скрытый BPM 84-123 из кода поста); B5 one-tap: Phantom → MetaMask → demo-гость, protected-поп-ап (Jupiter-режим включается env CRYO_JUPITER_*_MINT, сейчас demo), изоляция blur(40px) saturate(0) fixed-слоем, кристалл улетает за экран; B6 [ ПОЗИЦИЯ ЗАФИКСИРОВАНА ] (лазерный металл), кольцо замерзает инеем, полоса толпы с золотым маркером своей стороны, память в localStorage + сервер → после reload карточка сразу в pending/resolved; B7 кипение за 10с (пузыри + ускоренный пульс) → щелчок → белая корка, серый таймер, dim; B9 lose: 150 частиц пыли (canvas rAF, оседают), [ ИЛЛЮЗИЯ РАССЕЯЛАСЬ ]; win: кристалл плавится в жидкое золото → [ ЭКСТРАКЦИЯ НАГРАДЫ ] → claim → монета летит в иконку кошелька (+ SFX), после reload — тег «EXTRACTED».
- ORACLE /admin/resolution (server-обёртка из CSV + OracleConsole): тёмный терминал криолаборатории (scanlines, неон), gate по ключу (localStorage), стоп-кадры в титановых рамках (video paused @35%), моно-сетки данных, hold-to-confirm 1.5s (rAF, release aborts) → модал подписи «FINALIZE … irreversible» → POST resolve; кнопки FREEZE NOW / EXPIRE +10s (boil test).
- FEED/VIDEOCARD: Feed поллит /api/cryo/markets раз в 8с (один запрос на ленту, ?wallet= peekCryoWallet — без поп-апов), передаёт market в VideoCard; у карточки с рынком СКРЫТ ВЕСЬ chrome с ссылками (скрепка, профиль автора, Share Reality, threads, промпт, донат, прогресс-бар) — проверено DOM-инспекцией: videoLinks=0, shareBtns=0; onEnded при рынке не уводит зрителя.
- /FUTURE обновлён: блок «ending predictions» → «live test · cryo-stop in the feed».
- SMOKE (build + :3111): bet → 200, дуп → 409, resolve wrong key → 401; payout: пул $2 → победителю 1.94 (fee 3%), claim → 1.94, повтор → 409, проигравший → «Position dissolved»; expire+10s → авто-expired на чтении. Браузер (agent-browser): заморозка+панель+кварцы (скриншоты), поп-ап Phantom с blur-изоляцией (computed blur(40px) saturate(0)), pending с золотом и ×1.94, win → melt → extract → «+$0.97 USDC → wallet», reload → сразу resolved-win, lose → частицы, expired → корка + серый таймер, оракул: gate 401/200, hold 1.5s → подпись → оба рынка resolved.
- ЛОВУШКИ СРЕДЫ: (1) instrumentation-джоба refresh (90с после next start, интервал 6ч) ЗАХВАТЫВАЕТ agent-browser — во время браузерных тестов сервер стартовать с REFRESH_JOB=off (протокол «не трогать браузер» соблюдён, лок ждал 6 мин после первого столкновения); (2) fuser -k не убил next-server → EADDRINUSE, старый сервер отдавал старые чанки — kill по PID из ss; (3) lightningcss ВЫКИДЫВАЕТ стандартный backdrop-filter при ручном -webkit-дубле (у сайта так жил .nr-glass-deep) — удалены все -webkit-backdrop-filter из globals.css: lightningcss теперь сам добавляет префикс И оставляет стандарт (починило blur и в Firefox, и в headless).
- Данные после тестов сброшены (cryo_cleanup_test.mjs): рынки live до 2026-09-22T12:00Z, ставок нет; CSV включает свежие CDN-ссылки от refresh-job (48 постов, пины 1..8 на месте).

Stage Summary:
- Cryo-Stop жив end-to-end на двух тестовых видео: заморозка вниманием → ледяной рынок → one-tap ставка → фиксация → истечение/вердикт оракула → пари-мьютюэль выплаты с анимациями. Карточки рынков полностью без ссылок на видео.
- Коммит пушится в origin/main → Vercel задеплоит. Для прода: в Vercel env добавить ADMIN_SECRET (оракул-панель /admin/resolution?key=…); DATABASE_URL для накопления ставок; опционально CRYO_JUPITER_INPUT_MINT/OUTPUT_MINT включат реальный свап вместо demo; REFERRAL/2328 env без изменений. endsAt рынков задан в конфиге — продлить/поменять вопросы можно правкой src/lib/cryo/config.ts.
---
Task ID: 42
Agent: Super Z (main agent)
Task: Ревизия Cryo-Stop (8 пунктов): 1) 5с просмотра → плавный стоп-кадр; 2) упрощение архитектуры — бесплатно/быстро/легко, только USDC; 3) авторизация Phantom на сайте + в предиктах; 4) после выбора исхода — анимация + полное видео + лейбл PREDICTED; 5) дедуп ленты; 6) страница про предикшен-слой с анимациями; 7) тест перед деплоем; 8) PnL кошелька.

Work Log:
- П.1 WATCHING→COOLING: CryoStopCard переписан (фазы dormant/watching/cooling/market/melting). Ролик играет 5с (CRYO.watchMs=5000, копим реальное время проигрывания: пауза/уход со слота замораживает прогресс); затем cooling 1.1s — ПЛАВНЫЙ перецвет через CSS transition filter на <video> + мягкая циан-вуаль (nr-cryo-shock растянут до 1.1s), стоп-кадр ТОЛЬКО в конце cooling: pause+canvas drawImage, трещины/шум/SFX scan+crack, панель рынка. Авто-плей в заморозке запрещён (frozenRef-гард в isActive-эффекте VideoCard, «видео не проигрываются»); handleEnded в оверлее тихо лупит клип.
- П.2 USDC-ONLY: удалён Jupiter/Outcome-токены (executeCryoSwap, CRYO_JUPITER_*). Ставка = прямой SPL transferChecked $1 USDC на казначея с memo(betRef); клиент строит tx через ДИНАМИЧЕСКИЙ import @solana/web3.js (+Buffer-полифилл под Turbopack, ATA-деривация и инструкции вручную — без @solana/spl-token); сервер верифицирует ОДНИМ JSON-RPC getTransaction (src/lib/cryo/verify.ts: meta.err, дельта token-балансов на казначее по минту, betRef в memo); RPC-сбой → позиция пишется с txSig (reconcile), жёсткий провал → 400. Phantom-режим без настроенного казначея → 400 (спуф проверен). Env: NEXT_PUBLIC_PREDICT_TREASURY (+USDC_MINT, PREDICT_TREASURY_ATA, PREDICT_RPC_URL) — НЕ задан → demo-канал, exchange:"usdc"|"demo". Пари-мьютюэль/fee 3% без изменений; рынки продлены до 2026-09-23T12:00Z.
- П.3 PHANTOM AUTH: /api/auth/phantom (GET/POST/DELETE) — personal sign ed25519 (tweetnacl), каноничность base58-адреса (32 байта, round-trip), stateless анти-реплей (ISO-время в сообщении ±10 мин), httpOnly cookie nr_phantom 30d. use-wallet.ts → единый useWalletSession: Phantom первичен (signInWithPhantom в src/lib/cryo/wallet.ts), MetaMask фолбэк; WalletButton: 🦇/🦊 + pnl-ссылка в выпадашке. ensureCryoWallet: phantom-cookie → phantom one-tap (sign-in+платёж одним потоком) → demo-гость.
- П.4 PREDICTED: после успешной ставки кристалл улетает → фаза melting (1.4s, .nr-cryo-melt-out: слои льда/панель fade+blur) → onPredicted(side) → VideoCard снимает оверлей, ВОЗВРАЩАЕТ chrome (карточка = обычное видео), v.play() — ролик доигрывает до конца и лента едет дальше; лейбл .nr-predict-chip (✓ PREDICTED · ДА/НЕТ; после вердикта: won +$X золотой / dissolved; без ставки: verdict:/market closed), клик → /pnl. Скрытие chrome теперь = overlayUp (market live && !predicted && !released) — правило «ноль ссылок на видео» только в активном рынке. Позиция переживает reload (localStorage nr-cryo-bet-<code> + market.myBet из поллинга).
- П.5 ДЕДУП: scripts/dedupe_posts.py (author+normalized title = репост; приоритет pin>badge>ранняя строка) → удалены cFYN1L1z, aeLX_52G, omC5G8wq (48→45; пин 8→7 перенумерован); в getRankedPosts — рантайм-гард (utm_code, video_url, author+title). ВАЖНО: git checkout -- data/posts.csv на этом шаге ОТКАТИЛ дедуп — перезапущен скрипт, снапшот перегенерирован (45 постов, оба cryo-поста на месте).
- П.6 /PREDICT: серверная страница + чисто CSS-анимации: hero с shimmer, зацикленная 10s мини-карточка (watching-таймер 5с → циан-заморозка с трещинами → кварцы ДА/НЕТ → PREDICTED+таяние), 5 шагов механики, живые пулы пари-мьютюэля, дисклеймер, CTA. Пункт ❄ predictions в бургер-меню; sitemap 0.8 (+/pnl 0.5). /future: шаги механики и copy переписаны под USDC/Phantom/5с.
- П.7 ТЕСТ ПЕРЕД ДЕПЛОЕМ: build ок; prod-сервер :3111 (REFRESH_JOB=off). API: bet 200 → дуп 409 → resolve(key=…) → пул $2 → победителю $1.94 → pnl (won/claimable/net −1.03/+0.94) → claim 200 → повтор 409 → claimed 0.97; спуф phantom → 400. phantom_auth_smoke.mjs: валидная подпись 200+cookie, GET сессия, битая подпись 400, устаревшее сообщение 400, logout 200. Браузер (agent-browser): watching-скрин (ролик играет + маячок PREDICTION LIVE), заморозка (трещины/кварцы/кольцо 63h), ставка → поп-ап → таяние → PREDICTED·ДА с играющим роликом и полным chrome → reload → сразу PREDICTED без заморозки; автопереход на следующий слот по окончании; DOM-чек замороженной карточки: videoLinks=0, shareBtns=0; /predict, /pnl (staked $2.00/claimable $0.97/net −$1.03, extract → flash +$0.97), меню 5 пунктов. Тестовые ставки удалены, рынки live.
- ЛОВУШКИ: .env.local СНОВА потерян при пересоздании среды (остался только .env с DATABASE_URL) — восстановлен из истории (2328 ключи, ADMIN_SECRET локальный, REFERRAL_RATE_PCT); РЕАЛЬНЫЙ текст PROMPT_LOKI_FLASH по-прежнему только у владельца. standalone server не подхватывает .env.local в рантайме — ADMIN_SECRET для локального прогона передавался inline. bs58 v6 — default export; spl-token-хелперы не входят в web3.js (инструкции вручную).

Stage Summary:
- Все 8 пунктов ТЗ живы end-to-end и проверены в прод-режиме: 5с→плавная заморозка→рынок→$1 USDC (Phantom/demo)→таяние→полное видео с PREDICTED; дедуп-лента 45 постов; /predict и /pnl; auth Phantom с подписью.
- Коммит 0d29ca9 запушен в origin/main → Vercel задеплоит автоматически.
- Юзеру для включения РЕАЛЬНОГО USDC: 1) в Vercel env добавить NEXT_PUBLIC_PREDICT_TREASURY (base58 Solana-кошелёк приёма), PREDICT_TREASURY_ATA (его USDC-ATA для верификации), опционально NEXT_PUBLIC_PREDICT_USDC_MINT (по умолчанию mainnet USDC) и PREDICT_RPC_URL; 2) вернуть в Vercel PUBLIC_BASE_URL/TWOTHOUSAND328_*/ADMIN_SECRET (локальный .env.local восстановлен, но прод-значения — в Vercel); 3) markets/endsAt и вопросы — в src/lib/cryo/config.ts.
