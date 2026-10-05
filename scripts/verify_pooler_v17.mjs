import pg from "pg";

/**
 * v17 hotfix probe: verify the EXACT strings that must go to Vercel.
 *  - DATABASE_URL: txn pooler :6543 + pgbouncer=true (Prisma runtime)
 *  - DIRECT_URL:   session pooler :5432 (migrations)
 * Password passed as argv (never stored in code); expect raw form, we encode.
 */
const raw = process.argv[2];
if (!raw) {
  console.error("usage: node scripts/verify_pooler_v17.mjs <password>");
  process.exit(1);
}
const enc = encodeURIComponent(raw);
const REF = "arwdhvfffzdljctryjfw";

const targets = [
  {
    name: "TXN :6543 (Vercel DATABASE_URL)",
    url: `postgresql://postgres.${REF}:${enc}@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`,
  },
  {
    name: "SESSION :5432 (DIRECT_URL)",
    url: `postgresql://postgres.${REF}:${enc}@aws-1-eu-west-3.pooler.supabase.com:5432/postgres`,
  },
];

for (const t of targets) {
  const c = new pg.Client({
    connectionString: t.url,
    /* sandbox egress MITM-ит TLS: sslmode=require → verify-full падает на
       цепочке прокси. Здесь цель — проверить ПАРОЛЬ/хост, не цепочку. */
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  try {
    await c.connect();
    const q = await c.query(
      `select (select count(*)::int from "Account") as accounts,` +
        ` (select count(*)::int from clips where badge like 'raffle-%' and status='queued') as raffles_queued,` +
        ` (select count(*)::int from "Season" where status='active') as seasons`
    );
    console.log(`OK  ${t.name} → accounts=${q.rows[0].accounts} rafflesQueued=${q.rows[0].raffles_queued} activeSeasons=${q.rows[0].seasons}`);
  } catch (e) {
    console.log(`ERR ${t.name} → ${String(e.message).slice(0, 120)}`);
  } finally {
    try { await c.end(); } catch {}
  }
}
