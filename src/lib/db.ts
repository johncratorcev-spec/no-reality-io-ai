import fs from "fs";
import os from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { isServerless } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * DATABASE_URL в рантайме:
 * 1. Задана явно (локальный .env, VPS) — используем как есть.
 * 2. Serverless (Netlify): .env не деплоится, ФС read-only кроме /tmp →
 *    копируем БД, забандленную при сборке (prisma db push в netlify.toml,
 *    файл идёт в бандл через outputFileTracingIncludes), в /tmp и указываем туда.
 *    Клика хватает до холодного старта: копия живёт, пока тёплая инстанс-лямбда.
 * 3. Фолбэк: file:<проект>/db/custom.db.
 */
function ensureDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;

  const bundled = path.join(process.cwd(), "db", "custom.db");

  if (isServerless() && fs.existsSync(bundled)) {
    try {
      const tmpDb = path.join(os.tmpdir(), "no-reality.custom.db");
      if (!fs.existsSync(tmpDb) || fs.statSync(tmpDb).size === 0) {
        fs.copyFileSync(bundled, tmpDb);
      }
      process.env.DATABASE_URL = `file:${tmpDb}`;
      console.log(`[db] serverless: sqlite скопирована в ${tmpDb}`);
      return;
    } catch (e) {
      console.warn(
        "[db] не удалось скопировать БД в /tmp — использую бандл напрямую",
        e instanceof Error ? e.message : e
      );
    }
  }

  process.env.DATABASE_URL = `file:${bundled}`;
}

ensureDatabaseUrl();

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
