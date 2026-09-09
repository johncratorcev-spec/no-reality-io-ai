#!/usr/bin/env node
/**
 * Копирует статику в standalone-бандл для локального прод-пуска
 * (npm start → bun .next/standalone/server.js).
 * На Netlify standalone не собирается (там свой runtime @netlify/plugin-nextjs) —
 * скрипт ничего не делает.
 */
import fs from "node:fs";

if (!fs.existsSync(".next/standalone")) {
  process.exit(0); // не standalone-сборка (например, Netlify) — no-op
}

fs.cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (fs.existsSync("public")) {
  fs.cpSync("public", ".next/standalone/public", { recursive: true });
}
console.log("[postbuild] static/ и public/ скопированы в .next/standalone");
