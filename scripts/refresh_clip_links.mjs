#!/usr/bin/env node
/**
 * v14 — рефреш CDN-ссылок клипов (аналог старой refresh_links.py, но
 * пишет в ТАБЛИЦУ clips, а не в CSV).
 *
 * Ссылки Threads (scontent…cdninstagram.com, oe=) живут ~1–2 недели.
 * Скрипт:
 *   1. Берёт клипы из БД (clips).
 *   2. Для каждого с умершей ссылкой (Range-проба ≠ 206/200) переоткрывает
 *      пост Threads через agent-browser и достаёт свежий MP4.
 *   3. Верифицирует новый URL Range-запросом и пишет UPDATE в clips.
 *   4. Опционально --void-dead: клипы, где свежую ссылку вытащить не
 *      удалось, помечаются void (ТЗ: битая ссылка — void).
 *
 * Запуск: node scripts/refresh_clip_links.mjs [--limit N] [--void-dead]
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/* ---------- db (DIRECT_URL) ---------- */
function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DIRECT_URL="));
  return line.slice("DIRECT_URL=".length).trim();
}
const client = new pg.Client({
  connectionString: directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, ""),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const AGENT = "/home/z/.bun/install/global/node_modules/agent-browser/bin/agent-browser-linux-x64";

function ab(...args) {
  return execFileSync(AGENT, args, { timeout: 60000, encoding: "utf-8" }).trim();
}

async function alive(url) {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-1" },
      signal: AbortSignal.timeout(9000),
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

function extractFromPost(postUrl) {
  ab("open", postUrl);
  try { ab("wait", "--load", "networkidle"); } catch {}
  try { ab("wait", "4000"); } catch {}
  const raw = ab(
    "eval",
    `(() => {
      const srcs = Array.from(document.querySelectorAll("video"))
        .map(v => v.src || (v.querySelector("source") && v.querySelector("source").src))
        .filter(Boolean);
      return JSON.stringify({ srcs });
    })()`
  );
  let parsed = { srcs: [] };
  try {
    parsed = JSON.parse(raw.split("\n").filter((l) => l.startsWith("{")).join("\n") || raw);
  } catch {}
  return parsed.srcs || [];
}

const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : 0;
const VOID_DEAD = args.includes("--void-dead");

const INCLUDE_VOID = args.includes("--include-void");
const { rows } = await client.query(
  INCLUDE_VOID
    ? `select id, source_url, video_url, status from clips order by created_at asc`
    : `select id, source_url, video_url, status from clips where status in ('queued','draft') order by created_at asc`
);
/* при --include-void освежённые void-клипы возвращаются в очередь (разовая
   реанимация миграции; рантайм сам никогда не оживляет void) */
const REQUEUE = INCLUDE_VOID;

let fresh = 0;
let still = 0;
let dead = 0;
let done = 0;

for (const row of rows) {
  if (LIMIT && done >= LIMIT) break;
  done++;
  if (await alive(row.video_url)) {
    still++;
    if (REQUEUE && row.status === "void") {
      await client.query(`update clips set status = 'queued', resolved_at = null, updated_at = now() where id = $1`, [row.id]);
      console.log(`[${done}/${rows.length}] ${row.id} — ссылка жива, void → queued`);
    }
    continue;
  }
  console.log(`[${done}/${rows.length}] ${row.id} — ссылка умерла, переоткрываю ${row.source_url}`);
  let ok2 = false;
  try {
    const srcs = extractFromPost(row.source_url);
    for (const s of srcs) {
      if (await alive(s)) {
        if (REQUEUE && row.status === "void") {
          await client.query(`update clips set video_url = $1, status = 'queued', resolved_at = null, updated_at = now() where id = $2`, [s, row.id]);
        } else {
          await client.query(`update clips set video_url = $1, updated_at = now() where id = $2`, [s, row.id]);
        }
        console.log(`  → обновлено${row.status === "void" && REQUEUE ? "+re-queued" : ""}: ${s.slice(0, 90)}…`);
        ok2 = true;
        fresh++;
        break;
      }
    }
  } catch (e) {
    console.log(`  → extract failed: ${String(e.message).slice(0, 80)}`);
  }
  if (!ok2) {
    dead++;
    console.log(`  → свежую ссылку вытащить не удалось`);
    if (VOID_DEAD) {
      await client.query(`update clips set status = 'void', resolved_at = now() where id = $1`, [row.id]);
      console.log(`  → помечен void`);
    }
  }
  /* анти-троттлинг Threads */
  await new Promise((r) => setTimeout(r, 2500));
}

console.log(`\nитог: проверено ${done}, живых ссылок ${still}, обновлено ${fresh}, мёртвых ${dead}`);
await client.end();
