/**
 * v9 — генерация 3000 промокодов закрытого запуска.
 *
 * Алфавит 31 символ (без 0/O/1/I/L — не путаются при вводе), 12 знаков:
 * 31^12 ≈ 7.87e17. При 3000 активных кодах шанс угадать ≈ 3.8e-15 —
 * даже 1000 попыток в день оставляют перебор за пределами heat death.
 * Плюс DB-бюджет промахов (8/час, 20/сутки на ipHash) на API.
 *
 * Код в БД хранится ПЛОСКИМ (NRXXXXXXXXXXXX) — нормализатор API режет
 * дефисы/пробелы, регистр поднимает: ввод NR-abcd-efgh-jkmn работает.
 * В выдаче для человека — красивый формат NR-XXXX-XXXX-XXXX.
 *
 * Вставка чанками по 500 с ON CONFLICT DO NOTHING (перезапуск безопасен),
 * затем сверка итогового количества в партии. Результат дампится в JSON
 * для xlsx-генератора.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

const TOTAL = Number(process.argv[2] || 3000);
const BATCH = "launch-2026-09";
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DIRECT_URL="));
  if (!line) throw new Error("DIRECT_URL не найден");
  return line.slice("DIRECT_URL=".length).trim().replace(/^"|"$/g, "");
}
const url = directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

function genCode() {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `NR${out}`;
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // стартовое множество — генерируем с запасом на коллизии
  const codes = new Set();
  while (codes.size < TOTAL) codes.add(genCode());
  const list = [...codes];
  console.log(`generated ${list.length} unique codes`);

  // что уже есть в этой партии (перезапуск скрипта не должен дублировать)
  const existing = await client.query(`SELECT code FROM "PromoCode" WHERE batch = $1`, [BATCH]);
  const have = new Set(existing.rows.map((r) => r.code));
  const fresh = list.filter((c) => !have.has(c));
  console.log(`batch "${BATCH}" already has ${have.size}, inserting ${fresh.length} more`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    chunk.forEach((c, j) => {
      values.push(`($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`);
      params.push(randomUUID(), c, BATCH);
    });
    const r = await client.query(
      `INSERT INTO "PromoCode" (id, code, batch) VALUES ${values.join(",")} ON CONFLICT (code) DO NOTHING`,
      params
    );
    inserted += r.rowCount || 0;
  }
  console.log(`inserted ${inserted}`);

  // сверка
  const final = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT("usedBy")::int AS used
       FROM "PromoCode" WHERE batch = $1`,
    [BATCH]
  );
  const row = final.rows[0];
  console.log(`batch total: ${row.total}, used: ${row.used}`);
  if (row.total < TOTAL) throw new Error(`expected >= ${TOTAL}, got ${row.total}`);

  // дамп для xlsx-генератора (только коды партии; used-статус на момент выгрузки)
  const all = await client.query(
    `SELECT code, "createdAt" FROM "PromoCode" WHERE batch = $1 ORDER BY "createdAt", code`,
    [BATCH]
  );
  const dump = {
    batch: BATCH,
    generatedAt: new Date().toISOString(),
    count: all.rows.length,
    codes: all.rows.map((r, i) => ({
      n: i + 1,
      flat: r.code,
      pretty: formatPretty(r.code),
      status: "unused",
      createdAt: r.createdAt,
    })),
  };
  writeFileSync("scripts/v9_promos_dump.json", JSON.stringify(dump, null, 1));
  console.log(`dumped ${dump.count} codes -> scripts/v9_promos_dump.json`);

  await client.end();
}

function formatPretty(flat) {
  const body = flat.slice(2);
  return `NR-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

main().catch((e) => {
  console.error("GEN FAILED:", e.message);
  process.exit(1);
});
