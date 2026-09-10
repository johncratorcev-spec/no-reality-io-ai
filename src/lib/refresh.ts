/**
 * Джоба обновления CDN-ссылок: оборачивает scripts/refresh_links.py.
 * Одновременно может выполняться только одна джоба (Promise-мьютекс
 * + lockfile внутри самого скрипта).
 */

import { execFile } from "child_process";

export interface RefreshResult {
  ok: boolean;
  output: string;
}

let running: Promise<RefreshResult> | null = null;

export function runRefreshJob(): Promise<RefreshResult> {
  if (running) {
    console.log("[refresh] джоба уже выполняется — жду её результат");
    return running;
  }

  running = new Promise((resolve) => {
    execFile(
      "python3",
      ["scripts/refresh_links.py", "--quiet"],
      {
        cwd: process.cwd(),
        timeout: 15 * 60_000, // 18 постов × ~8с + запас
        maxBuffer: 4 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        running = null;
        const output = `${stdout || ""}${stderr || ""}`.trim().slice(-2000);
        if (err && err.killed) {
          resolve({ ok: false, output: `timeout: ${output}` });
          return;
        }
        // exit code 2 = «есть неудачные строки», но джоба отработала
        resolve({ ok: !err || (err as { code?: number }).code === 2, output });
      }
    );
  });

  return running;
}
