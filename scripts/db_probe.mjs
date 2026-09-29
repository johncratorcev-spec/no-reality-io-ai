import pg from "pg";

/**
 * Зонд региона Supavisor (v10): находит рабочий pooler-регион проекта.
 * ПАРОЛЬ НЕ ХРАНИМ В КОДЕ: читаем из DATABASE_URL/DIRECT_URL (.env, gitignored)
 * или из первого аргумента. Пример запуска:
 *   node scripts/db_probe.mjs
 */
import fs from "node:fs";
import path from "node:path";

function passwordFromEnvFile(): string | null {
  try {
    const line = fs
      .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
      .split("\n")
      .find((l) => l.startsWith("DIRECT_URL="));
    const m = /:([^:@]+)@/.exec(line || "");
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const pass = process.argv[2] || passwordFromEnvFile();
if (!pass) {
  console.error("нет пароля: передай аргументом или заполни DIRECT_URL в .env");
  process.exit(1);
}

const REF = process.env.SUPABASE_REF || "arwdhvfffzdljctryjfw";

const regions = [
  "aws-0-eu-central-1", "aws-0-eu-west-1", "aws-0-eu-west-2", "aws-0-eu-west-3",
  "aws-0-us-east-1", "aws-0-us-east-2", "aws-0-us-west-1", "aws-0-us-west-2",
  "aws-0-ap-southeast-1", "aws-0-ap-southeast-2", "aws-0-ap-northeast-1", "aws-0-ap-northeast-2",
  "aws-0-ap-south-1", "aws-0-ap-east-1", "aws-0-ca-central-1", "aws-0-eu-north-1",
  "aws-0-sa-east-1",
  "aws-1-eu-central-1", "aws-1-eu-west-1", "aws-1-eu-west-2", "aws-1-eu-west-3", "aws-1-eu-north-1",
  "aws-1-us-east-1", "aws-1-us-east-2", "aws-1-us-west-1", "aws-1-us-west-2",
  "aws-1-ca-central-1", "aws-1-sa-east-1", "aws-1-ap-northeast-1", "aws-1-ap-northeast-2",
  "aws-1-ap-south-1", "aws-1-ap-southeast-1", "aws-1-ap-southeast-2", "aws-1-ap-east-1",
  "aws-2-eu-central-1", "aws-2-us-east-1", "aws-2-us-east-2", "aws-2-ap-southeast-1", "aws-2-ap-northeast-1",
];

for (const r of regions) {
  const client = new pg.Client({
    connectionString: `postgresql://postgres.${REF}:${pass}@${r}.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 9000,
  });
  try {
    await client.connect();
    const q = await client.query("select count(*)::int as n from \"Account\"");
    console.log(`OK  ${r} → accounts=${q.rows[0].n}`);
    await client.end();
    process.exit(0);
  } catch (e) {
    const msg = String(e.message).slice(0, 80).replace(/\n/g, " ");
    console.log(`ERR ${r} → ${msg}`);
    try { await client.end(); } catch {}
  }
}
console.log("NO REGION WORKED");
process.exit(1);
