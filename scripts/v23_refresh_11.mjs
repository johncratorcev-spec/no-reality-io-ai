#!/usr/bin/env node
/**
 * v23 — точечный рефреш CDN-ссылок для 11 клипов, чьи подписанные URL
 * истекли (scontent *.cdninstagram.com). Отличия от refresh_clip_links.mjs:
 *   - работает только с явным списком id;
 *   - ждёт появление <video> поллингом (до 20с), а не networkidle;
 *   - выбирает видео, чей путь совпадает с префиксом старого URL
 *     (лента Threads содержит видео соседних постов);
 *   - верифицирует свежий URL curl-подобным fetch (Range → 206/200);
 *   - успешные → video_url обновлён, статус queued (прод сам откроет раффл).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const IDS = [
  "b43qf72xft", "anc3cqw3j2", "wj4cc7kui6", "xbijdardty", "uinu6kmriw",
  "xewit89nej", "weykmrtd7c", "i8szu9ez5x", "dyu8cir923", "k9qjmi4ggk",
  "x3gpq8c6hz",
];

function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n").find((l) => l.startsWith("DIRECT_URL="));
  return line.slice("DIRECT_URL=".length).trim();
}
const client = new pg.Client({
  connectionString: directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, ""),
  ssl: { rejectUnauthorized: false },
});
await client.connect();

function ab(...args) {
  return execFileSync("agent-browser", args, { timeout: 90000, encoding: "utf-8" }).trim();
}

async function alive(url) {
  for (const headers of [{ Range: "bytes=0-1" }, {}]) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      if (res.ok || res.status === 206) return true;
    } catch { /* retry */ }
  }
  return false;
}

const mediaPath = (u) => {
  const m = String(u || "").match(/\/o1\/v\/t2\/[^?]+/);
  return m ? m[0].slice(-40) : "";
};

let fixed = 0, failed = 0;

for (const id of IDS) {
  const { rows } = await client.query(
    "select id, source_url, video_url, status from clips where id = $1", [id]
  );
  const clip = rows[0];
  if (!clip) { console.log(`${id}: нет в БД`); failed++; continue; }

  console.log(`\n=== ${id} (${clip.status}) ${clip.source_url}`);
  let src = "";
  try {
    ab("open", clip.source_url);
    /* ждём videos поллингом — networkidle unreliable на Threads */
    for (let i = 0; i < 10 && !src; i++) {
      try { ab("wait", "2000"); } catch { /* ignore */ }
      const raw = ab("eval", `(()=>{
        const vids=[...document.querySelectorAll('video')]
          .map(v=>v.currentSrc||v.src||(v.querySelector('source')&&v.querySelector('source').src))
          .filter(s=>s&&s.startsWith('http'));
        return JSON.stringify(vids);
      })()`);
      /* CLI печатает результат как JSON-строку В КАВЫЧКАХ: "[{\"src\":…}"
         — снимаем обёртку и анэскейпим */
      const line = raw.split("\n").find((l) => l.includes("["));
      let decoded = line ? line.trim() : "";
      if (decoded.startsWith('"') && decoded.endsWith('"')) {
        try { decoded = JSON.parse(decoded); } catch { /* уже чистый */ }
      }
      const start = decoded.indexOf("[");
      const list = start >= 0 ? JSON.parse(decoded.slice(start, decoded.lastIndexOf("]") + 1)) : [];
      if (!list.length) continue;
      /* приоритет: совпадение медиа-пути со старой ссылкой */
      const oldPath = mediaPath(clip.video_url);
      src = list.find((u) => oldPath && mediaPath(u) === oldPath) || list[0] || "";
    }
  } catch (e) {
    console.log(`  extract error: ${String(e.message).slice(0, 90)}`);
  }

  if (!src) { console.log("  → видео не найдено"); failed++; continue; }
  if (!(await alive(src))) { console.log(`  → свежий URL не отвечает: ${src.slice(0, 70)}…`); failed++; continue; }

  await client.query(
    "update clips set video_url = $1, status = 'queued', resolved_at = null, updated_at = now() where id = $2",
    [src, id]
  );
  console.log(`  → OK queued: ${src.slice(0, 80)}…`);
  fixed++;
  /* анти-троттлинг Threads */
  await new Promise((r) => setTimeout(r, 2000));
}

console.log(`\nитог: fixed=${fixed}, failed=${failed}`);
await client.end();
process.exit(failed ? 1 : 0);
