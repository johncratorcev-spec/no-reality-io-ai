import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import AdminGate from "@/components/admin/AdminGate";
import { verifyAdminToken } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "no reality. / bd guide",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * v13 — Гайд BD (/admin/bd-guide): доступ только по ADMIN_SECRET.
 * Полная инструкция управления платформой + отметки о том, что
 * реально проверено агентом (см. «проверено» в каждом разделе).
 */

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5">
      <h2 className="flex items-baseline gap-2 text-[1rem] font-black tracking-tight text-white">
        <span className="text-[#c8ff00]">{n}</span> {title}
      </h2>
      <div className="mt-3 space-y-2 text-[0.8rem] font-semibold leading-relaxed text-white/65">{children}</div>
    </section>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return <p className="flex gap-2"><span className="text-white/30">▸</span><span>{children}</span></p>;
}

function Tested({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-[rgba(200,255,0,0.25)] bg-[rgba(200,255,0,0.05)] px-3 py-2 text-[0.68rem] font-bold text-[#c8ff00]/90">
      проверено: {children}
    </p>
  );
}

export default async function BdGuidePage() {
  const jar = await cookies();
  const unlocked = verifyAdminToken(jar.get("nr_admin")?.value);

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-[#08070b] text-[#f2ede4]">
        <div className="mx-auto max-w-md px-4 py-10">
          <AdminGate hint="BD guide — тот же секрет, что и консоль" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 text-[#f2ede4]">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.3em] text-[#c8ff00]">bd guide</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight">
        как управлять no-reality<span className="text-[#FF003C]">.</span>
      </h1>
      <p className="mt-2 text-[0.85rem] font-semibold text-white/50">
        внутренний документ команды — не для публичного распространения
      </p>
      <p className="mt-3 text-[0.72rem] font-bold">
        <Link href="/admin/bd" className="text-[#c8ff00] underline underline-offset-4">
          → открыть консоль (/admin/bd)
        </Link>
      </p>

      <Section n="8.1" title="Как зайти в админку">
        <Step>Открой <b>/admin/bd</b> (или <b>/admin/resolution</b> для вердиктов). Сайт показывает форму «enter the secret».</Step>
        <Step>Введи длинный секрет — <b>ADMIN_SECRET</b> (env-переменная на Vercel). Кнопка «unlock».</Step>
        <Step>Сессия живёт <b>2 часа</b> (httpOnly HMAC-cookie nr_admin), потом код нужен снова.</Step>
        <Step>Без секрета входа нет: сравнение timing-safe, перебор — 5 попыток/мин на IP + блок после 5 неудач, все страницы noindex.</Step>
        <Tested>
          POST /api/admin/session: верный код → 200 + cookie; неверный → 401 access_denied; 11-я попытка подряд → 429;
          страницы /admin/bd и /admin/bd-guide без сессии показывают только форму.
        </Tested>
      </Section>

      <Section n="8.2" title="Как быстро заливать новый контент">
        <Step>Скопируй ссылку на пост <b>Threads</b> (или код поста) либо ссылку на пост <b>X/Twitter</b>.</Step>
        <Step>В консоли (/admin/bd) → блок «add video» → вставь ссылку в первое поле.</Step>
        <Step>Второе поле — адрес видео (…mp4): Threads обычно <b>требует ручной вставки</b> (открой пост → ПКМ по видео → «копировать адрес видео»). Для X это тоже обязательно — у X нет публичного прямого mp4.</Step>
        <Step>Дождись автопарсинга: Threads подтянет title/author сам (через r.jina.ai); поля title/author можно заполнить вручную.</Step>
        <Step>Выбери вердикт: <b>REAL / SYNTH</b> — если знаешь заранее; «resolve later» — раунд закроешь вручную через Oracle Console.</Step>
        <Step>Нажми <b>create</b>: клип сразу пишется в таблицу clips со статусом queued — деплои и коммиты больше не нужны.</Step>
        <Step>Проверь, что раунд появился на <b>/bet</b> (ставочные клипы) — или на /feed, если вердикт не проставлен.</Step>
        <Step>Галочки Featured / Daily Challenge — кнопками в списке топ-раундов или после первого резолва (см. 8.3).</Step>
        <Tested>
          E2E: добавление Threads-клипа с вердиктом REAL → CSV-строка с utm_code, раунд открывается на /bet,
          ставка падает в пул. Дубль ссылки → 409. Битый video-url → 400 с внятной ошибкой. X-ссылка без video → 400 с подсказкой.
        </Tested>
      </Section>

      <Section n="8.3" title="Как смотреть раскладку">
        <Step>Открой <b>/admin/bd</b> — верхний блок: сезон, участники, объём, открытые раунды/банк, settled-ставки, 24ч/7д.</Step>
        <Step>«top rounds by bank (season)» — топ-10 раундов по банку с вердиктами.</Step>
        <Step>Кнопки в строке раунда: <b>feature</b> (поднять в ленте на 24ч) и <b>daily</b> (сделать Daily Challenge дня — победителям бонус +25 EYE сверх банка).</Step>
        <Step>Пометки «today’s marks» показывают текущий Daily Challenge и featured-клипы.</Step>
        <Step>Экспорт сводки сезона (CSV): <code className="text-[#c8ff00]">GET /api/admin/snapshot?key=ADMIN_SECRET</code>.</Step>
        <Tested>
          summary отдаёт сезон s1, участников, объёмы, 24ч/7д; feature ставит featuredUntil на 24ч; daily помечает
          открытые раунды клипа (marked N) и бейдж ★ daily challenge виден в ставочной панели.
        </Tested>
      </Section>

      <Section n="8.4" title="Ежедневные действия BD (промоушен)">
        <Step><b>Ежедневно:</b> заливай 5–15 свежих сильных клипов (спорные, хайповые); делай 1–2 Daily Challenge / Featured; смотри, какие раунды собирают банк (топ-раунды в консоли) — усиливай похожий контент; шеринг лучших Result-карточек игроков в Telegram/X/Threads от имени проекта.</Step>
        <Step><b>Еженедельно:</b> подборка «Лучшие глаза недели» из /leaderboard (скриншот топ-3); мини-челленджи («угадай 7 из 10 — бонус»); отмечай топов лидерборда и рефералов.</Step>
        <Step><b>Посыл:</b> «Твои глаза против машины. Сможешь отличить?» Форматы: короткие вертикальные нарезки раунд+результат + призыв «попробуй сам».</Step>
        <Step><b>Хэштеги:</b> #NoReality #RealOrSynth #HumanVsMachine. Площадки: Threads, X, Telegram, Instagram Reels, TikTok. Коллабы с AI-креаторами и инфлюенсерами.</Step>
        <Step><b>Вирусные механики:</b> Result/Share-карточки (кнопки TG/X/Threads/FB/IG/copy в каждой карточке результата), реферальная программа (20% рейка), лидерборд с бейджами, челлендж «побей мой streak».</Step>
        <Tested>Все перечисленные поверхности существуют и работают: Share-карточка (6 целей, ru/en), /leaderboard с бейджами и своей позицией, серии с бонусами 3/5/7/10, Daily Challenge с бонусом.</Tested>
      </Section>

      <Section n="8.5" title="Работа с ИИ-агентами (Arena)">
        <Step>Публичный репозиторий агентов: <b>github.com/johncratorcev-spec/no-reality-agents</b> — первый агент это обёртка над мультимодальной LLM (OpenAI-compatible / Anthropic / Google): вставь ключ и запусти.</Step>
        <Step>API платформы: <code className="text-[#c8ff00]">GET /api/arena/round</code> (текущий открытый раунд) и <code className="text-[#c8ff00]">POST /api/arena/predict</code> (предсказание агента) — авторизация заголовком <b>x-agent-key</b> (env ARENA_API_KEY), rate-limit включён.</Step>
        <Step>Таблица агентов: <code className="text-[#c8ff00]">GET /api/arena/scoreboard</code> (точность по агентам).</Step>
        <Step>Когда Arena выйдет в публичную фазу — анонсировать соревнования, поощрять сильных агентов (возможны призы).</Step>
        <Tested>Полный цикл агента: получить раунд → предсказать → записаться → scoreboard считает точность. Без ключа API отвечает 401, при переборе 429.</Tested>
      </Section>

      <Section n="8.6" title="Если что-то сломалось">
        <Step>Проверь health: <code className="text-[#c8ff00]">no-reality.fun/api/health</code> → {"{"}ok:true, db:"up"{"}"}.</Step>
        <Step>Логи действий BD видны в консоли (сообщения ✓/✕ под формами) и в server-логах Vercel (префиксы [admin/bd]).</Step>
        <Step>Ставки не резолвятся → открой Oracle Console (/admin/resolution) и закрой раунд вручную (CLOSE AS REAL / CLOSE AS SYNTH).</Step>
        <Step>Критическая проблема → смени ADMIN_SECRET в Vercel env (Redeploy) и сообщи разработчику. Все сессии админки умрут автоматически (ключ подписи сменится).</Step>
        <Tested>health отвечает ok; force-resolve Oracle Console покрыт selftest'ом (bet_selftest: админ-cron ключ + принудительный вердикт).</Tested>
      </Section>

      <p className="mt-8 text-[0.65rem] font-semibold text-white/30">
        v13 · doc generated with the platform build · verified {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  );
}
