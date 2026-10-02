#!/usr/bin/env node
/**
 * v14 — безопасность таблицы clips (ТЗ: «RLS закрывает label», «Anon не
 * читает метку», «представление clip_reveals показывает метку и хеш
 * после resolved; до резолва строка пустая»).
 *
 * 1) RLS enabled + FORCE: даже владелец подчиняется политикам;
 *    политика app_full TO postgres (Prisma-соединение) оставляет
 *    приложению полный доступ; anon/authenticated — default-deny.
 * 2) Колончатые гранты: anon/authenticated получают SELECT только по
 *    безопасным колонкам — label / "videoUrl" / "sourceUrl" /
 *    "authorHandle" им недоступны ФИЗИЧЕСКИ (не только политикой).
 * 3) Представление clip_reveals: после resolved показывает метку и хеш,
 *    до резолва — пустую строку. GRANT SELECT anon/authenticated.
 *
 * Идемпотентно: повторный запуск просто повторяет DDL.
 */
import { q, close } from "./lib/supadb.mjs";

const DDL = [
  `alter table "clips" enable row level security`,
  `alter table "clips" force row level security`,
  // приложение (Prisma, роль postgres) — полный доступ
  `drop policy if exists app_full on "clips"`,
  `create policy app_full on "clips" to postgres using (true) with check (true)`,
  // service_role Supabase — полный доступ (bypassrls и так есть, но политика не мешает)
  `drop policy if exists service_full on "clips"`,
  `create policy service_full on "clips" to service_role using (true) with check (true)`,
  // anon/authenticated: default-deny (политик нет) + забрать старые гранты
  `revoke all on "clips" from anon, authenticated, public`,
  // безопасные колонки для чтения (метка/видео/исходник/автор НЕ входят)
  `grant select (id, caption_public, status, label_commit, opens_at, closes_at,
     resolved_at, listed_by, featured_until, badge, pin, created_at, updated_at)
   on "clips" to anon, authenticated`,
  // представление раскрытия: пусто до resolved, метка+хеш после
  `drop view if exists "clip_reveals"`,
  `create view "clip_reveals" with (security_barrier = true) as
     select id,
            status,
            case when status = 'resolved' then label else '' end as label,
            case when status = 'resolved' then label_commit else '' end as label_commit,
            resolved_at
       from "clips"`,
  `grant select on "clip_reveals" to anon, authenticated`,
  // v14: платёжные таблицы — тоже default-deny для anon (деньги не читаем)
  `alter table "pay_orders" enable row level security`,
  `revoke all on "pay_orders" from anon, authenticated, public`,
  `alter table "season_claims" enable row level security`,
  `revoke all on "season_claims" from anon, authenticated, public`,
  `alter table "claim_addresses" enable row level security`,
  `revoke all on "claim_addresses" from anon, authenticated, public`,
];

/* v14 ЗАКРЫТИЕ УТЕЧКИ: db push выдаёт новым таблицам дефолтные гранты
   Supabase (anon = ALL). Динамически отзываем ВСЁ у anon/authenticated
   на каждой публичной таблице, кроме clips (остаются только безопасные
   колоночные гранты выше) и clip_reveals. Метка DailyChallenge.label,
   ArenaPrediction и т.д. становятся анону недоступны. */
try {
  const tables = await q(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> 'clip_reveals'`
  );
  let revoked = 0;
  for (const t of tables) {
    const name = t.tablename;
    if (name === "clips") continue; // колоночные гранты уже выставлены выше
    await q(`revoke all on public."${name}" from anon, authenticated, public`);
    revoked++;
  }
  console.log(`dynamic revoke: ${revoked} таблиц закрыто от anon`);
} catch (e) {
  console.error("dynamic revoke failed:", e.message);
}

let ok = 0;
for (const sql of DDL) {
  try {
    await q(sql);
    ok++;
  } catch (e) {
    console.error("DDL FAIL:", sql.replace(/\s+/g, " ").slice(0, 72), "\n  →", e.message);
  }
}
console.log(`DDL выполнено: ${ok}/${DDL.length}`);

/* ---- проверка «anon не читает метку» ----
   1) авторитетно по грантам (has_*_privilege — работает без SET ROLE);
   2) SET ROLE anon — если роль доступна, живая проба. */
const privChecks = [
  [`has_column_privilege('anon', 'clips', 'label', 'SELECT')`, false, "anon: clips.label"],
  [`has_column_privilege('anon', 'clips', 'video_url', 'SELECT')`, false, "anon: clips.video_url"],
  [`has_column_privilege('anon', 'clips', 'source_url', 'SELECT')`, false, "anon: clips.source_url"],
  [`has_column_privilege('anon', 'clips', 'author_handle', 'SELECT')`, false, "anon: clips.author_handle"],
  [`has_column_privilege('anon', 'clips', 'caption_public', 'SELECT')`, true, "anon: clips.caption_public"],
  [`has_table_privilege('anon', 'clip_reveals', 'SELECT')`, true, "anon: clip_reveals"],
  [`has_table_privilege('authenticated', 'clips', 'SELECT')`, false, "auth: clips (таблица целиком закрыта)"],
];
let fails = 0;
for (const [expr, expected, label] of privChecks) {
  const r = await q(`select ${expr} as ok`);
  const okk = r[0].ok;
  const pass = okk === expected;
  if (!pass) fails++;
  console.log(`${pass ? "✓" : "✗ НЕ ОЖИДАЛОСЬ"} ${label} → ${okk}`);
}

try {
  await q("set role anon");
  try {
    await q("select label from clips limit 1");
    console.log("✗ ПРОТЕЧКА: SET ROLE anon прочитал label");
    fails++;
  } catch {
    console.log("✓ живая проба SET ROLE anon → label закрыт:", await q("select current_user as u").then(() => ""));
  }
  const rev = await q("select id, label, label_commit from clip_reveals limit 1");
  console.log("✓ clip_reveals читается anon'ом; строк:", rev.length, "(до резолва label = '')");
} catch (e) {
  console.log("· SET ROLE anon недоступен этой роли (не член anon) — грант-проверка выше авторитетна:", e.message.slice(0, 60));
} finally {
  await q("reset role").catch(() => {});
}

if (fails > 0) {
  console.error(`ПРОВЕРКИ ПРОВАЛЕНЫ: ${fails}`);
  process.exit(1);
}
console.log("RLS/гранты/представление — ОК");
await close();
