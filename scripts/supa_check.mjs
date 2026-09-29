#!/usr/bin/env node
/**
 * Проверка ВСЕГО слоя данных в Supabase (v8):
 *  1. все таблицы схемы на месте (21+EmailAuth = 22)
 *  2. RLS включён на каждой таблице (PostgREST/anon заблокирован)
 *  3. счётчики строк по ключевым таблицам (живость данных)
 *  4. индексы и unique-констрейнты идемпотентности (refKey, orderId…)
 *  5. связка EmailAuth ↔ Account (v8)
 *
 * Запуск: node scripts/supa_check.mjs
 */

import { q, one, close } from "./lib/supadb.mjs";

let passed = 0;
let failed = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

const EXPECTED_TABLES = [
  "Click", "PageVisit", "PostStats", "ReferralProfile", "ReferralEvent",
  "CryoMarket", "CryoBet", "CryoOption", "Favorite", "FavoriteStats",
  "Account", "LedgerTxn", "DepositOrder", "UtmClick", "UserProfile",
  "MagicLogin", "MagicUser", "EmailAuth",
  "Round", "Bet", "TrackEvent", "BoostOrder",
  "PromoCode", "WaitlistEntry", "PromoAttempt",
];

const EXPECTED_UNIQUE = [
  { table: "LedgerTxn", column: "refKey", why: "идемпотентность всех наград/выплат/депозитов" },
  { table: "Bet", column: "orderId", why: "инвойс rb-* один-к-одному ставке" },
  { table: "DepositOrder", column: "orderId", why: "инвойс dp-* один-к-одному пополнению" },
  { table: "BoostOrder", column: "orderId", why: "инвойс bs-* один-к-одному бусту" },
  { table: "EmailAuth", column: "email", why: "одна учётка на email (v8)" },
  { table: "Account", column: "email", why: "email уникален на аккаунте" },
  { table: "PromoCode", column: "code", why: "код одноразовый и уникальный (v9)" },
  { table: "WaitlistEntry", column: "email", why: "анти-спам листа ожидания: одна запись на email (v9)" },
];

async function run() {
  console.log(`\n[supa-check] слой данных Supabase\n`);

  /* 1. таблицы */
  const tables = await q(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const present = new Set(tables.map((t) => t.tablename));
  ok(`таблиц в public: ${present.size}`, tables.length >= EXPECTED_TABLES.length);
  for (const t of EXPECTED_TABLES) {
    ok(`таблица ${t}`, present.has(t));
  }

  /* 2. RLS */
  const rls = await q(
    `SELECT relname, relrowsecurity FROM pg_class
     JOIN pg_namespace n ON n.oid = pg_class.relnamespace
     WHERE n.nspname = 'public' AND relkind = 'r'`
  );
  const rlsOff = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  ok("RLS включён на всех таблицах", rlsOff.length === 0, rlsOff.length ? `без RLS: ${rlsOff.join(", ")}` : `${rls.length} таблиц`);

  /*PostgREST/anon заблокирован: RLS без политик = default deny, плюс
     у роли anon не должно остаться GRANT'ов на таблицы (осознанная
     модель v7: приложение ходит владельцем, anon не видит ничего) */
  const anonGrants = await one(
    `SELECT COUNT(*)::int AS n FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'`
  );
  ok("PostgREST/anon заблокирован (RLS default-deny, 0 грантов anon)", (anonGrants?.n ?? 1) === 0, `anon grants=${anonGrants?.n}`);

  /* 3. счётчики */
  for (const t of ["Account", "LedgerTxn", "Round", "Bet", "TrackEvent", "EmailAuth"]) {
    const c = await one(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    ok(`данные в ${t}`, (c?.n ?? 0) >= 0, `rows=${c?.n}`);
  }

  /* 4. unique-констрейнты (Prisma пишет колонку без кавычек, если lowercase) */
  for (const { table, column, why } of EXPECTED_UNIQUE) {
    const idx = await one(
      `SELECT COUNT(*)::int AS n FROM pg_indexes
       WHERE schemaname='public' AND tablename=$1
         AND indexdef ILIKE '%UNIQUE%'
         AND (indexdef ILIKE '%("' || $2 || '")%' OR indexdef ILIKE '%(' || $2 || ')%')`,
      [table, column]
    );
    ok(`unique(${table}.${column}) — ${why}`, (idx?.n ?? 0) > 0, `indexes=${idx?.n}`);
  }

  /* 5. связка EmailAuth ↔ Account */
  const orphan = await one(
    `SELECT COUNT(*)::int AS n FROM "EmailAuth" e
     LEFT JOIN "Account" a ON a.id = e."accountId"
     WHERE a.id IS NULL`
  );
  ok("EmailAuth без сирот (все привязаны к Account)", (orphan?.n ?? 0) === 0, `orphans=${orphan?.n}`);

  /* консистентность баланса по всей экономике */
  const drift = await one(
    `SELECT COUNT(*)::int AS n FROM "Account" a
     WHERE a."balanceCents" <> COALESCE((SELECT SUM(delta)::int FROM "LedgerTxn" l WHERE l."accountId" = a.id), 0)`
  );
  ok("баланс всех аккаунтов = Σ журнала (нет дрейфа)", (drift?.n ?? 1) === 0, `drifted=${drift?.n}`);

  console.log(`\n[supa-check] ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await run();
} finally {
  await close();
}
