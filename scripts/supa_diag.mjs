#!/usr/bin/env node
/** Диагностика подключения Prisma к Supabase: грузит .env и ловит полную ошибку. */
import { readFileSync } from "node:fs";
import path from "node:path";

for (const line of readFileSync(path.resolve(process.cwd(), ".env"), "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

console.log("DATABASE_URL =", process.env.DATABASE_URL?.replace(/:[^:@/]*@/, ":***@"));
console.log("DIRECT_URL   =", process.env.DIRECT_URL?.replace(/:[^:@/]*@/, ":***@"));

const { PrismaClient } = await import("@prisma/client").catch((e) => {
  console.error("import err:", e.message);
  process.exit(1);
});
const p = new PrismaClient({ log: ["error", "warn"] });
try {
  const n = await p.account.count();
  console.log("PRISMA OK: accounts =", n);
} catch (e) {
  console.error("FULL ERR:", e.message?.slice(0, 600));
  console.error("code:", e.code);
} finally {
  await p.$disconnect().catch(() => {});
}
