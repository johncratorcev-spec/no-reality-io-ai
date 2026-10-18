#!/usr/bin/env node
/**
 * v26 — АВТООБНОВЛЕНИЕ ссылок клипов (прод-совместимо, playwright).
 *
 * Зачем: CDN-ссылки Threads (scontent…, oe=подпись) живут дни. Если ссылка
 * умирает до конца раффла, авторезолв помечает раунд void (битая ссылка).
 * Этот скрипт — крон: проверяет живость, переоткрывает пост Threads и
 * обновляет video_url (и фото карусели) свежими подписями.
 *
 * Работает и в песочнице, и в GitHub Actions (ubuntu + playwright).
 *
 * Запуск:
 *   node scripts/v26_refresh_dead.mjs [--limit N] [--include-void]
 *        [--ids id1,id2,…] [--void-dead] [--dry]
 *
 *   --limit N         максимум клипов за прогон (по умолчанию без лимита)
 *   --include-void    проверять и void-клипы (для разовой реанимации)
 *   --ids …           только перечисленные клипы
 *   --void-dead       у активных клипов, чей пост не открылся, ставить void
 *                     (по ТЗ «битая ссылка — void»); по умолчанию только лог
 *
 * Env: DIRECT_URL (или DATABASE_URL с :5432 session pooler).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

/* ---------------- env (sandbox: .env; GH Actions: workflow env) ---------------- */
for (const line of (() => {
  try { return readFileSync(new URL("../.env", import.meta.url), "utf-8").split("\n"); } catch { return []; }
})()) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

/* ---------------- db ---------------- */
function directUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:")) {
    return process.env.DATABASE_URL;
  }
  /* дружелюбный режим для крона до добавления секрета: не краснить джобу */
  console.log("DIRECT_URL не задан — прогон пропущен.");
  console.log("Добавь repo secret DIRECT_URL (session pooler :5432) в");
  console.log("GitHub → Settings → Secrets and variables → Actions, и крон заработает.");
  process.exit(0);
}
const client = new pg.Client({
  connectionString: directUrl().replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]$/, ""),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();

/* ---------------- args ---------------- */
const argOf = (n, d = "") => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const hasFlag = (n) => process.argv.includes(`--${n}`);
const LIMIT = Number(argOf("limit", "0")) || 0;
const INCLUDE_VOID = hasFlag("include-void");
const IDS = argOf("ids").split(",").map((s) => s.trim()).filter(Boolean);
const VOID_DEAD = hasFlag("void-dead");
const DRY = hasFlag("dry");

/* ---------------- playwright ---------------- */
let chromium = null;
async function browser() {
  if (!chromium) {
    const pw = await import("playwright");
    chromium = await pw.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
    });
  }
  return chromium;
}

async function alive(url) {
  if (!url) return false;
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1" }, signal: AbortSignal.timeout(9000) });
    if (r.ok || r.status === 206) return true;
  } catch {}
  /* фолбэк без Range (ловушка c89a631: Threads CDN 403ит bytes=0-1, но
     стримит целиком) */
  try {
    const r2 = await fetch(url, { signal: AbortSignal.timeout(9000) });
    return r2.ok || r2.status === 206;
  } catch {}
  return false;
}

/** переоткрыть пост Threads → свежие медиа (video или фото-карусель) */
async function resolvePost(page, postUrl) {
  await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3500);
  try { await page.keyboard.press("Escape"); } catch {}
  await page.waitForTimeout(1200);

  /* поллинг до 20с: главное видео поста (article-scope) или фото */
  for (let i = 0; i < 5; i++) {
    const data = await page.evaluate(() => {
      const main = document.querySelector("article") || document;
      const vids = Array.from(main.querySelectorAll("video"))
        .map((v) => v.src || (v.querySelector("source") && v.querySelector("source").src) || "")
        .filter(Boolean);
      const imgs = Array.from(main.querySelectorAll("img"))
        .map((im) => im.src)
        .filter((s) => s.includes("cdninstagram") || s.includes("fbcdn"))
        .filter((s, i, a) => a.indexOf(s) === i);
      return { vids: vids.slice(0, 3), imgs: imgs.slice(0, 12) };
    }).catch(() => ({ vids: [], imgs: [] }));
    if (data.vids.length || data.imgs.length) return data;
    await page.waitForTimeout(4000);
  }
  return { vids: [], imgs: [] };
}

/* ---------------- main ---------------- */
let where = `status <> 'void'`;
const params = [];
if (INCLUDE_VOID) where = `status in ('queued','soon','live','resolved','void')`;
if (IDS.length) {
  where = `id = any($1::text[])`;
  params.push(IDS);
}

const { rows } = await client.query(
  `select id, source_url, video_url, media_type, media_json, status
   from clips where ${where} order by updated_at asc`,
  params
);
console.log(`клипов к проверке: ${rows.length}${LIMIT ? ` (лимит ${LIMIT})` : ""}`);

const b = await browser();
const ctx = await b.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
});
const page = await ctx.newPage();

let still = 0, refreshed = 0, failed = 0, voided = 0, done = 0;

for (const row of rows) {
  if (LIMIT && done >= LIMIT) break;
  done++;

  /* карусель: первое фото; видео: video_url */
  let mediaAlive = await alive(row.video_url);
  if (!mediaAlive && row.media_type === "carousel") {
    try {
      const photos = JSON.parse(row.media_json || "{}").photos || [];
      mediaAlive = await alive(photos[0]);
    } catch {}
  }

  if (mediaAlive) {
    still++;
    if (row.status === "void") {
      /* разовая реанимация void-клипов с живой ссылкой — вручную не решаем
         статус (рантайм сам никогда не оживляет void), только лог */
      console.log(`[${done}] ${row.id} — ссылка жива (клип void, статус не меняем)`);
    }
    continue;
  }

  if (!/threads\.com\/(share|@)/.test(row.source_url)) {
    console.log(`[${done}] ${row.id} — ссылка мертва, источник не Threads → пропуск`);
    failed++;
    continue;
  }

  process.stdout.write(`[${done}] ${row.id} (${row.status}) — ссылка умерла, переоткрываю пост…\n`);
  let ok = false;
  try {
    const { vids, imgs } = await resolvePost(page, row.source_url);
    /* видео-пост: первый живой src */
    for (const v of vids) {
      if (await alive(v)) {
        if (!DRY) await client.query(`update clips set video_url = $1, updated_at = now() where id = $2`, [v, row.id]);
        console.log(`    → video обновлён: ${v.slice(0, 80)}…`);
        ok = true; break;
      }
    }
    /* фото-карусель: свежие фото */
    if (!ok && row.media_type === "carousel" && imgs.length) {
      const photos = [];
      for (const im of imgs) { if (await alive(im)) photos.push(im); if (photos.length >= 10) break; }
      if (photos.length) {
        if (!DRY) await client.query(
          `update clips set video_url = $1, media_json = $2, updated_at = now() where id = $3`,
          [photos[0], JSON.stringify({ photos }), row.id]
        );
        console.log(`    → карусель обновлена: ${photos.length} фото`);
        ok = true;
      }
    }
  } catch (e) {
    console.log(`    → extract failed: ${String(e.message).slice(0, 90)}`);
  }

  if (ok) {
    refreshed++;
  } else {
    failed++;
    console.log(`    → свежую ссылку вытащить не удалось`);
    if (VOID_DEAD && row.status !== "void" && !DRY) {
      await client.query(`update clips set status = 'void', resolved_at = now() where id = $1 and status in ('queued','soon','live')`, [row.id]);
      voided++;
      console.log(`    → помечен void`);
    }
  }

  /* анти-троттлинг Threads */
  await new Promise((r) => setTimeout(r, 2200));
}

console.log(`\nитог: проверено ${done}, живых ${still}, обновлено ${refreshed}, неудач ${failed}, void-пометок ${voided}`);
await page.close().catch(() => {});
await ctx.close().catch(() => {});
await b.close().catch(() => {});
await client.end();
