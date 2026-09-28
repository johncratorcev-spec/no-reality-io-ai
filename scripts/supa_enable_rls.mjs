#!/usr/bin/env node
/**
 * Безопасность Supabase: включает RLS (Row Level Security) на ВСЕ публичные
 * таблицы БЕЗ политик → PostgREST API (anon/service-ключи) не видит данные,
 * пока явно не добавят политики. Прямое подключение приложения (роль postgres,
 * владелец таблиц) RLS не подчиняется — работа приложения не меняется.
 * Плюс revoke на public-схеме для анонимных ролей.
 */
import { q, close } from "./lib/supadb.mjs";

const tables = (
  await q(
    "select tablename from pg_tables where schemaname = 'public' order by tablename"
  )
).map((r) => r.tablename);

let n = 0;
for (const t of tables) {
  await q(`alter table "public"."${t}" enable row level security`);
  n++;
  console.log(`RLS enabled: ${t}`);
}

/* анонимные/публичные роли не должны читать схему через PostgREST:
   anon и authenticated (Supabase-роли) остаются без политик → пусто;
   на всякий случай забираем прямые GRANT'ы у public */
for (const t of tables) {
  await q(`revoke all on "public"."${t}" from anon, authenticated, public`).catch(
    () => {}
  );
}

console.log(`\nRLS: ${n} таблиц защищено`);
await close();
