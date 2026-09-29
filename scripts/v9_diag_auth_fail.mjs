/**
 * v9-diag: почему регистрация на проде падает (500 auth_failed)?
 * Смотрим слой данных Supabase:
 *  1. существует ли таблица "EmailAuth";
 *  2. есть ли строки EmailAuth вообще;
 *  3. есть ли «осиротевшие» Account без email, созданные недавно
 *     (след $transaction-падений: аккаунт создан, email — нет);
 *  4. есть ли signup_bonus ledger-записи без пары email (тот же след);
 *  5. TrackEvent password_signup / password_signin — дошло ли до конца;
 *  6. версии/таблички: перечисляем все таблицы схемы public.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DIRECT_URL="));
  if (!line) throw new Error("DIRECT_URL не найден");
  return line.slice("DIRECT_URL=".length).trim().replace(/^"|"$/g, "");
}
const url = directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const log = (...a) => console.log(...a);

  // 1. таблицы схемы public
  const tables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  log("== TABLES ==", tables.rows.map((r) => r.tablename).join(", "));

  // 2. EmailAuth существует? сколько строк
  const emailAuthExists = tables.rows.some((r) => r.tablename === "EmailAuth");
  log("EmailAuth exists:", emailAuthExists);
  if (emailAuthExists) {
    const c = await client.query(`SELECT COUNT(*)::int AS n FROM "EmailAuth"`);
    log("EmailAuth rows:", c.rows[0].n);
    const rows = await client.query(
      `SELECT "accountId", email, "createdAt" FROM "EmailAuth" ORDER BY "createdAt" DESC LIMIT 10`);
    for (const r of rows.rows) log("  emailAuth:", r.email, r.accountId, r.createdAt?.toISOString?.());
  }

  // 3. Account без email, созданные за последние 3 суток (след падений)
  const orphans = await client.query(`
    SELECT id, "createdAt", "balanceCents", "passTier" FROM "Account"
    WHERE email IS NULL AND "createdAt" > now() - interval '3 days'
    ORDER BY "createdAt" DESC LIMIT 15`);
  log("== Recent guest accounts (3d) ==", orphans.rows.length);
  for (const r of orphans.rows)
    log("  guest:", r.id, r.createdAt?.toISOString?.(), "bal:", r.balanceCents, "tier:", r.passTier);

  // 4. signup_bonus за 3 дня
  const bonus = await client.query(`
    SELECT "accountId", "createdAt" FROM "LedgerTxn"
    WHERE kind='signup_bonus' AND "createdAt" > now() - interval '3 days'
    ORDER BY "createdAt" DESC LIMIT 15`);
  log("== Recent signup_bonus (3d) ==", bonus.rows.length);
  for (const r of bonus.rows)
    log("  bonus:", r.accountId, r.createdAt?.toISOString?.());

  // 5. TrackEvent password_*
  const ev = await client.query(`
    SELECT name, COUNT(*)::int AS n, MAX("createdAt") AS last FROM "TrackEvent"
    WHERE name LIKE 'password%' OR name LIKE 'welcome%' GROUP BY name`);
  log("== TrackEvent auth ==");
  for (const r of ev.rows) log(" ", r.name, "n:", r.n, "last:", r.last?.toISOString?.());

  // 6. AdminEvent / сколько аккаунтов с email
  const acc = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(email)::int AS with_email
    FROM "Account"`);
  log("== Accounts ==", acc.rows[0]);

  await client.end();
}

main().catch((e) => {
  console.error("DIAG FAILED:", e.message);
  process.exit(1);
});
