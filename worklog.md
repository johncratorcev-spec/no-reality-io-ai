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
