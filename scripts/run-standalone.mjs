#!/usr/bin/env node
/**
 * Локальный прод-лаунчер standalone-сервера с загрузкой .env.local
 * (standalone-конфиг Next не читает .env.* из корня проекта сам,
 * а процесс переименовывается в next-server — env нужны ДО старта).
 *
 * Использование: PORT=3111 node scripts/run-standalone.mjs .next/standalone/server.js
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
  console.log("[run-standalone] .env.local loaded");
} else {
  console.log("[run-standalone] no .env.local — env only from OS");
}

await import(path.resolve(process.cwd(), process.argv[2] || ".next/standalone/server.js"));
