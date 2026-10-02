#!/usr/bin/env node
/* quick db probe: node scripts/dbq.mjs "select 1" */
import { q, close } from "./lib/supadb.mjs";
const sql = process.argv[2];
if (!sql) {
  console.log("usage: node scripts/dbq.mjs <sql>");
  process.exit(1);
}
try {
  const rows = await q(sql);
  console.log(JSON.stringify(rows, null, 1).slice(0, 4000));
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  close();
  setTimeout(() => process.exit(0), 500);
}
