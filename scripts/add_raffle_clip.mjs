#!/usr/bin/env node
/**
 * v15 — добавление КЛИПА-СОРЕВНОВАНИЯ (первое соревнование, badge="raffle-01").
 *
 * Роль «bd»: вставляет клип в очередь с золотым бейджем соревнования.
 * Тот же путь, что ТЗ §Авторезолв: вставлен → queued → планировщик сам
 * откроет раунд → резолв → раскрытие. Плюс featured_until (золото в ленте
 * поднимает клип наверх, пока не истечёт) — само истекает, пин не трогаем.
 *
 * Вставка (как migrate_clips):
 *   1) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (PostgREST) — приоритет;
 *   2) фолбэк DIRECT_URL (pg, серверный путь).
 * label_commit считается тем же алгоритмом, что в рантайме
 * (sha256(label:id:COMMIT_PEPPER), pepper — из env/.env).
 *
 * Запуск:
 *   node scripts/add_raffle_clip.mjs \
 *     --source "https://www.threads.com/@user/post/XXXX" \
 *     --video  "https://scontent….cdninstagram.com/….mp4?…" \
 *     --label real|synth \
 *     [--badge raffle-01] [--caption "…"] [--author @user] \
 *     [--listed-by bd] [--featured-days 7] [--dry]
 *
 * Повторный запуск безопасен: это UPSERT по source_url — обновит
 * video_url/label/badge/featured у существующего клипа (удобно после
 * смерти CDN-ссылки; id при этом сохраняется).
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/* ---------- args ---------- */
function argOf(name, def = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const SOURCE = argOf("source");
const VIDEO = argOf("video");
const LABEL = argOf("label").trim().toLowerCase();
const BADGE = argOf("badge", "raffle-01").trim().toLowerCase();
const CAPTION = argOf("caption");
const AUTHOR = argOf("author");
const LISTED_BY = argOf("listed-by", "bd");
const FEATURED_DAYS = Number(argOf("featured-days", "7")) || 0;
const DRY = hasFlag("dry");

if (!SOURCE || !/^https?:\/\//i.test(SOURCE)) {
  console.error("нужен --source https://… (исходная ссылка поста)");
  process.exit(1);
}
if (!VIDEO || !/^https?:\/\//i.test(VIDEO)) {
  console.error("нужен --video https://… (прямой mp4 с CDN Threads)");
  process.exit(1);
}
if (LABEL !== "real" && LABEL !== "synth") {
  console.error("нужен --label real|synth (без метки — 400 по ТЗ)");
  process.exit(1);
}
if (!/^raffle-\d{1,2}$/.test(BADGE)) {
  console.error("--badge должен быть вида raffle-<номер> (например raffle-01)");
  process.exit(1);
}

/* ---------- helpers (те же правила, что в рантайме) ---------- */
function envOf(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
      .split("\n")
      .find((l) => l.startsWith(name + "="));
    return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
  } catch {
    return "";
  }
}

const COMMIT_PEPPER = envOf("COMMIT_PEPPER");
function commitOf(id, label) {
  if (!COMMIT_PEPPER) {
    console.error("ВНИМАНИЕ: COMMIT_PEPPER не задан — label_commit не сойдётся с рантаймом!");
  }
  return createHash("sha256").update(`${label}:${id}:${COMMIT_PEPPER}`).digest("hex");
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function clipId() {
  const buf = randomBytes(10);
  let s = "";
  for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  return s;
}

const BANNED_SUBSTR = ["seedance", "higgsfield", "kling", "runway", "prompt", "нейро", "нейро-"];
const BANNED_WORDS_RE = /(^|[^a-zа-яё])(ai|veo|gen-?ai)([^a-zа-яё]|$)/i;
function scrubCaption(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (BANNED_SUBSTR.some((w) => low.includes(w)) || BANNED_WORDS_RE.test(low)) return "";
  return s.slice(0, 280);
}

async function videoAlive(url) {
  try {
    const r = await fetch(url, {
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(15000),
    });
    const ct = r.headers.get("content-type") || "";
    return (r.status === 206 || r.status === 200) && (ct.includes("video") || ct === "" || ct.includes("octet-stream"));
  } catch {
    return false;
  }
}

/* ---------- проверка видео ДО вставки (битая ссылка недопустима) ---------- */
console.log("Range-проба видео…");
if (!(await videoAlive(VIDEO))) {
  console.error("видео не отвечает как video (Range) — битая ссылка не вставляется");
  process.exit(1);
}
console.log("видео живо ✓");

const id = clipId();
const now = new Date();
const featuredUntil = FEATURED_DAYS > 0 ? new Date(now.getTime() + FEATURED_DAYS * 864e5) : null;
const row = {
  id,
  source_url: SOURCE,
  video_url: VIDEO,
  author_handle: AUTHOR,
  caption_public: scrubCaption(CAPTION),
  label: LABEL,
  label_commit: commitOf(id, LABEL),
  status: "queued",
  listed_by: LISTED_BY,
  badge: BADGE,
  featured_until: featuredUntil ? featuredUntil.toISOString() : null,
  // Prisma @updatedAt — app-level: в БД у колонки НЕТ дефолта (NOT NULL),
  // сырой pg-INSERT обязан передать её сам (PostgREST-путь тоже).
  updated_at: now.toISOString(),
};

if (DRY) {
  console.log("DRY-RUN — строки не пишем. Ряд для вставки:");
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}

/* ---------- вставка ---------- */
let via = "service-key";
let inserted = false;

const SB = envOf("SUPABASE_URL").replace(/\/$/, "");
const KEY = envOf("SUPABASE_SERVICE_ROLE_KEY");
if (SB && KEY) {
  const res = await fetch(`${SB}/rest/v1/clips?on_conflict=source_url`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([row]),
  });
  if (res.ok) {
    const arr = await res.json().catch(() => []);
    inserted = true;
    if (arr && arr[0] && arr[0].id) row.id = arr[0].id;
    console.log(`вставлено сервисным ключом (merge по source_url), id=${row.id}`);
  } else {
    console.warn(`service-key insert failed: ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
} else {
  console.warn("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY не заданы — фолбэк DIRECT_URL");
}

if (!inserted) {
  via = "direct-fallback";
  const { q, close } = await import("./lib/supadb.mjs");
  const cols = Object.keys(row);
  const vals = cols.map((k) => row[k]);
  const phAll = cols.map((_, i) => `$${i + 1}`).join(",");
  const upd = cols
    .filter((k) => !["id", "source_url", "created_at", "updated_at"].includes(k))
    .map((k) => `"${k}" = EXCLUDED."${k}"`)
    .join(", ");
  await q(
    `insert into "clips" (${cols.map((c) => `"${c}"`).join(",")})
     values (${phAll})
     on conflict (source_url) do update set ${upd}, "updated_at" = now()`,
    vals
  );
  const r = await q(`select id, status, badge from "clips" where source_url = $1`, [SOURCE]);
  if (r[0]) {
    row.id = r[0].id;
    inserted = true;
    console.log(`вставлено через DIRECT_URL (${via}), id=${row.id}, status=${r[0].status}, badge=${r[0].badge}`);
  }
  await close();
}

if (!inserted) {
  console.error("не удалось вставить клип (нет доступов?)");
  process.exit(2);
}

console.log("---- ГОТОВО ----");
console.log(`clip id:      ${row.id}`);
console.log(`badge:        ${row.badge} (соревнование №${row.badge.replace("raffle-", "")})`);
console.log(`label:        ${row.label} (до резолва сервер не отдаст)`);
console.log(`status:       queued — планировщик откроет раунд сам (ленивый тик /api/round или /api/cron/tick)`);
console.log(`featured:     ${row.featured_until ?? "нет"}`);
console.log(`check:        https://no-reality.fun/bet  → золотой бейдж «competition ${row.badge.replace("raffle-", "").padStart(2, "0")}»`);
