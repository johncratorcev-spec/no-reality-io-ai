/**
 * Общий Postgres-доступ для selftest'ов (Supabase через DIRECT_URL,
 * session mode :5432). Заменяет node:sqlite DatabaseSync.
 *
 * Использование:
 *   import { q, one, close } from "./lib/supadb.mjs";
 *   const row = await one('SELECT email, "passTier" FROM "Account" WHERE email = $1', [email]);
 *
 * NOTE: колонки в Postgres называются как в Prisma-модели ("balanceCents",
 * "passTier", "refKey" — camelCase в кавычках), т.к. Prisma не мапит имена.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DIRECT_URL="));
  if (!line) throw new Error("DIRECT_URL не найден (.env)");
  return line.slice("DIRECT_URL=".length).trim().replace(/^"|"$/g, "");
}

/* pg v8: sslmode=require из connection-string превращается в verify-full и
   падает на цепочке Supavisor. Вырезаем sslmode и задаём TLS явно:
   шифрование включено, verify выключен (трафик шифрован; тестовый доступ). */
function sanitizedUrl() {
  return directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");
}

let client = null;

async function getClient() {
  if (client) return client;
  client = new pg.Client({
    connectionString: sanitizedUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

/** q(sql, params) → rows[] */
export async function q(sql, params = []) {
  const c = await getClient();
  const res = await c.query(sql, params);
  return res.rows;
}

/** one(sql, params) → первая строка | undefined */
export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0];
}

export async function close() {
  if (client) {
    try {
      await client.end();
    } catch {}
    client = null;
  }
}
