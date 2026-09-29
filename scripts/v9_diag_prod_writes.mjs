/**
 * v9-diag #2: пишет ли прод в ЭТУ базу? Свежие записи今日/вчера.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DIRECT_URL="));
  return line.slice("DIRECT_URL=".length).trim().replace(/^"|"$/g, "");
}
const url = directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  const q = async (label, sql) => {
    try {
      const r = await client.query(sql);
      console.log(label, JSON.stringify(r.rows));
    } catch (e) {
      console.log(label, "ERR:", e.message);
    }
  };

  await q("PageVisit latest:", `SELECT MAX("createdAt") AS last, COUNT(*)::int AS n FROM "PageVisit"`);
  await q("TrackEvent latest:", `SELECT MAX("createdAt") AS last, COUNT(*)::int AS n FROM "TrackEvent"`);
  await q("Click latest:",     `SELECT MAX("createdAt") AS last FROM "Click"`);
  await q("Account today:",    `SELECT COUNT(*)::int AS n FROM "Account" WHERE "createdAt" > now() - interval '20 hours'`);
  await q("Account w/email:",  `SELECT id, email, "passTier", "createdAt" FROM "Account" WHERE email IS NOT NULL ORDER BY "updatedAt" DESC LIMIT 5`);
  await q("LedgerTxn today:",  `SELECT kind, COUNT(*)::int AS n FROM "LedgerTxn" WHERE "createdAt" > now() - interval '20 hours' GROUP BY kind`);
  await q("BoostOrder:",       `SELECT COUNT(*)::int AS n FROM "BoostOrder"`);
  await q("password_signup meta:", `SELECT meta, "createdAt" FROM "TrackEvent" WHERE name='password_signup'`);
  await client.end();
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
