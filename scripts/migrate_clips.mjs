#!/usr/bin/env node
/**
 * v14 — миграция data/posts.csv → таблица clips (ТЗ §Клипы/Миграция).
 *
 * Порядок по ТЗ: «CSV прочитать локально, вставить сервисным ключом,
 * сверить число строк и наличие метки, удалить CSV, сиды и скрипты сборки
 * из дерева. Историю git не переписывать».
 *
 * Вставка — СЕРВИСНЫМ КЛЮЧОМ (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
 * PostgREST). Если ключ не задан в окружении — фолбэк на прямое
 * подключение DIRECT_URL (тот же серверный путь, без сервисного ключа);
 * фолбэк помечается в выводе.
 *
 * Повторный запуск безопасен: конфликт по id игнорируется
 * (Prefer: resolution=ignore-duplicates / ON CONFLICT DO NOTHING).
 *
 * label_commit = sha256(label + ':' + id + ':' + COMMIT_PEPPER) — считается
 * тем же кодом, что и в рантайме (env COMMIT_PEPPER).
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import Papa from "papaparse";
import { q, close } from "./lib/supadb.mjs";

const CSV = path.resolve(process.cwd(), "data/posts.csv");

function envOf(name) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(name + "="));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}

function commitOf(id, label) {
  return createHash("sha256").update(`${label}:${id}:${envOf("COMMIT_PEPPER")}`).digest("hex");
}

/* ---- фильтр публичных подписей (тот же список, что в src/lib/clips.ts) ---- */
const BANNED_SUBSTR = ["seedance", "higgsfield", "kling", "runway", "prompt", "нейро", "нейро-"];
const BANNED_WORDS_RE = /(^|[^a-zа-яё])(ai|veo|gen-?ai)([^a-zа-яё]|$)/i;
function scrubCaption(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (BANNED_SUBSTR.some((w) => low.includes(w)) || BANNED_WORDS_RE.test(low)) return "";
  return s.slice(0, 280);
}

function parseCsv() {
  const text = readFileSync(CSV, "utf-8");
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (res.errors.length) console.warn("CSV warnings:", res.errors.length);
  return res.data;
}

function rowToClip(r) {
  const id = (r.utm_code || "").trim();
  const sourceUrl = (r.url || "").trim();
  const videoUrl = (r.video_url || "").trim();
  const label = (r.truth || "").trim().toLowerCase();
  if (!id || !sourceUrl || !videoUrl || (label !== "real" && label !== "synth")) return null;
  const featuredUntil = (r.boost_until || "").trim();
  const pin = Number.parseInt((r.pin || "0").trim(), 10) || 0;
  return {
    id,
    source_url: sourceUrl,
    video_url: videoUrl,
    author_handle: (r.author || "").trim(),
    caption_public: scrubCaption(r.title || ""),
    label,
    label_commit: commitOf(id, label),
    status: "queued",
    listed_by: "migration",
    featured_until: featuredUntil || null,
    badge: (r.badge || "").trim(),
    pin,
  };
}

async function insertViaServiceKey(clips) {
  const url = envOf("SUPABASE_URL").replace(/\/$/, "");
  const key = envOf("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  const res = await fetch(`${url}/rest/v1/clips?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(clips),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`service-key insert failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return true;
}

async function insertViaDirect(clips) {
  const cols = [
    "id", "source_url", "video_url", "author_handle", "caption_public",
    "label", "label_commit", "status", "listed_by", "featured_until", "badge", "pin",
    "created_at", "updated_at",
  ].join(",");
  let n = 0;
  for (const c of clips) {
    const vals = [
      c.id, c.source_url, c.video_url, c.author_handle, c.caption_public,
      c.label, c.label_commit, c.status, c.listed_by, c.featured_until, c.badge, c.pin,
      new Date().toISOString(), new Date().toISOString(),
    ];
    const ph = vals.map((_, i) => `$${i + 1}`).join(",");
    await q(
      `insert into "clips" (${cols}) values (${ph}) on conflict (id) do nothing`,
      vals
    );
    n++;
  }
  return n;
}

async function main() {
  if (!existsSync(CSV)) {
    console.error("CSV не найден:", CSV);
    process.exit(1);
  }
  const rows = parseCsv();
  const clips = rows.map(rowToClip).filter(Boolean);
  const dropped = rows.length - clips.length;
  console.log(`CSV строк: ${rows.length}; валидных клипов: ${clips.length}; отброшено: ${dropped}`);

  const labels = new Set(clips.map((c) => c.label));
  if (!labels.has("real") || !labels.has("synth")) {
    console.error("ОШИБКА: в данных нет обеих меток real|synth");
    process.exit(1);
  }

  let via = "service-key";
  try {
    const ok = await insertViaServiceKey(clips);
    if (!ok) throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  } catch (e) {
    console.warn("Сервисный ключ недоступен:", e.message);
    console.warn("→ фолбэк: прямая вставка DIRECT_URL (серверный путь)");
    via = "direct-fallback";
    await insertViaDirect(clips);
  }

  /* ---- сверка по ТЗ: число строк + наличие метки ---- */
  const cntRows = await q("select count(*)::int as n from clips");
  const cnt = cntRows[0].n;
  const labeled = (await q("select count(*)::int as n from clips where label in ('real','synth')"))[0].n;
  const committed = (await q("select count(*)::int as n from clips where length(label_commit) = 64"))[0].n;
  const scrubbed = (await q("select count(*)::int as n from clips where caption_public = ''"))[0].n;

  console.log("---- VERIFY ----");
  console.log("via:", via);
  console.log("clips in DB:", cnt, "ожидалось ≥", clips.length);
  console.log("с меткой real|synth:", labeled);
  console.log("с label_commit(64 hex):", committed);
  console.log("подпись срезана фильтром (пустая):", scrubbed);
  if (cnt < clips.length || labeled !== cnt || committed !== cnt) {
    console.error("СВЕРКА НЕ ПРОЙДЕНА");
    process.exit(1);
  }
  console.log("СВЕРКА ПРОЙДЕНА ✓");
  process.exit(0);
}

main().finally(close);
