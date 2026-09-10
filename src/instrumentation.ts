/**
 * Next.js instrumentation: автоматическая джоба обновления CDN-ссылок.
 * Запускается через 90с после старта сервера, затем каждые 6 часов.
 * Скрипт сам обновляет только ссылки, истекающие в ближайшие 48 часов,
 * поэтому типичный цикл: каждая ссылка обновляется за пару дней до протухания.
 *
 * Отключить: REFRESH_JOB=off в окружении.
 * На serverless (Netlify/Vercel) не запускается: нет python/headless-браузера,
 * лямбда живет минуты — ссылки там обновляются коммитом в data/posts.csv.
 */

import { isServerless } from "@/lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.REFRESH_JOB === "off") return;
  if (isServerless()) return;

  const g = globalThis as typeof globalThis & {
    __nrRefreshScheduled?: boolean;
  };
  if (g.__nrRefreshScheduled) return; // защита от повторной регистрации при HMR
  g.__nrRefreshScheduled = true;

  const { runRefreshJob } = await import("./lib/refresh");

  const INTERVAL_MS = 6 * 60 * 60 * 1000;

  const run = async (trigger: string) => {
    try {
      const r = await runRefreshJob();
      console.log(
        `[refresh:${trigger}] ${r.ok ? "ok" : "fail"} — ${r.output.split("\n").slice(-1)[0] || "нет вывода"}`
      );
    } catch (e) {
      console.error(`[refresh:${trigger}] упала:`, e);
    }
  };

  console.log("[refresh] автоджоба обновления ссылок включена (интервал 6ч)");

  // первый запуск через 90с — даём серверу спокойно подняться
  setTimeout(() => void run("startup"), 90_000);

  const timer = setInterval(() => void run("interval"), INTERVAL_MS);
  // не держим процесс живым только из-за таймера
  if (typeof timer.unref === "function") timer.unref();
}
