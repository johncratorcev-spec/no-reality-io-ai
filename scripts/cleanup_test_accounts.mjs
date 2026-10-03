#!/usr/bin/env node
/** Финальная чистка тестовых аккаунтов (set-based, быстро через пулер). */
import { q, one, close } from "./lib/supadb.mjs";

const sel = `select id from "Account" where email like '%@test.dev' or email like '%@test.local'`;

await q(`delete from "LedgerTxn" where "accountId" in (${sel})`);
await q(`delete from "EmailAuth" where "accountId" in (${sel})`);
await q(`delete from "Account" where email like '%@test.dev' or email like '%@test.local'`);

const left = await one(`select count(*)::int n from "Account" where email like '%@test.dev' or email like '%@test.local'`);
const total = await one(`select count(*)::int n from "Account"`);
const orph = await one(`select count(*)::int n from "LedgerTxn" where "accountId" not in (select id from "Account")`);
console.log(`test accs left: ${left.n} | total accs: ${total.n} | orphan ledger: ${orph.n}`);
await close();
