#!/usr/bin/env node
/**
 * Поиск региона Supavisor pooler для проекта arwdhvfffzdljctryjfw.
 * Подключаемся user=postgres.<ref> на aws-0-<region>.pooler.supabase.com:6543
 * (transaction mode, SSL). Правильный регион авторизует; остальные отдают
 * "Tenant or user not found". Пароль из .env (SUPABASE_DB_PASSWORD) или argv.
 */
import { Client } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

const REF = "arwdhvfffzdljctryjfw";
const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2",
  "ap-northeast-1", "ap-northeast-2", "sa-east-1",
];

const pw = process.argv[2] || readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
  .split("\n").find((l) => l.startsWith("SUPABASE_DB_PASSWORD="))?.slice("SUPABASE_DB_PASSWORD=".length).trim() || "";

if (!pw) {
  console.error("нет пароля: node scripts/supa_region_probe.mjs <password>");
  process.exit(1);
}

let found = null;
const PREFIXES = ["aws-0", "aws-1", "aws-2", "aws-3"];
outer: for (const prefix of PREFIXES) {
  for (const region of REGIONS) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    // сразу два режима: 6543 transaction, 5432 session
    for (const port of [6543, 5432]) {
      const c = new Client({
        host,
        port,
        user: `postgres.${REF}`,
        password: pw,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 7000,
      });
      try {
        await c.connect();
        const v = await c.query("select current_user, inet_server_addr()::text as ip");
        console.log(`FOUND prefix=${prefix} region=${region} port=${port} host=${host}`);
        console.log(`  current_user=${v.rows[0].current_user} ip=${v.rows[0].ip}`);
        found = { region, host, port, prefix };
        await c.end();
        break outer;
      } catch (e) {
        const msg = (e?.message || String(e)).slice(0, 80);
        console.log(`  ${prefix}-${region}:${port} → ${msg}`);
        try { await c.end(); } catch {}
      }
    }
  }
}
if (!found) {
  console.error("регион не найден");
  process.exit(1);
}
console.log(JSON.stringify(found));
