#!/usr/bin/env node
/**
 * v26 — вставка ТИЗЕРОВ: видео в ленту, но БЕЗ раффла.
 * status = "soon": планировщик не продвигает (promoteQueuedClips берёт
 * только queued), лента показывает с заглушкой «скоро будут доступны
 * предсказания» (ClipCard рендерит заглушку вместо BetPanel).
 *
 * Данные: /tmp/v26_extract/<id>.json (медиа из main.vids[0], article-scope).
 * Повторный запуск безопасен — upsert по source_url.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { q, close } from "./lib/supadb.mjs";

const COMMIT_PEPPER = "nrs-commit-pepper-v14-7t4qz9x2m6b8k3w5";
const commitOf = (id, label) =>
  createHash("sha256").update(`${label}:${id}:${COMMIT_PEPPER}`).digest("hex");

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const clipId = () =>
  Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

/* id поста → (автор, метка, примечание) — классификация v16 по кадрам+og */
const CLASSIFY = {
  BAFlXcFGIM:  { author: "@anesputro",       label: "synth", note: "Pippit AI ad (#PippitAI, watermark)" },
  BACRfexmcs:  { author: "@victor03256666",  label: "synth", note: "GTA6-tank AI mashup, topic AI Threads" },
  BAOae9mS6I:  { author: "@horra.i",         label: "synth", note: "AI deep-sea creature fantasy" },
  BAcXZq7jFB:  { author: "@ermakovael",      label: "synth", note: "Threads 'AI content' label on video" },
  BApb_G708_:  { author: "@glennhasabeard",  label: "synth", note: "'Minimax H3, open weights, generated locally'" },
  BAZTVfLNoA:  { author: "@svskliar",        label: "synth", note: "AI cinematic Halloween horror" },
  "_6gx0GNBq": { author: "@tapewarp.ai",     label: "synth", note: "Seedance 2.5 + Higgsfield watermark" },
  "BCMC1ZQX-H": { author: "@bkaicreator",     label: "synth", note: "'Made with @higgsfield.ai'" },
};

const FEATURED_DAYS = 7;

let inserted = 0;
let updated = 0;
let skipped = 0;

for (const [pid, meta] of Object.entries(CLASSIFY)) {
  const f = `/tmp/v26_extract/${pid}.json`;
  let d;
  try { d = JSON.parse(readFileSync(f, "utf8")); } catch { console.log(`${pid}: нет JSON — пропуск`); skipped++; continue; }
  const v = d.main?.vids?.[0] || d.vidsAll?.[0];
  if (!v?.src) { console.log(`${pid}: нет видео — пропуск`); skipped++; continue; }

  const sourceUrl = `https://www.threads.com/share/${pid}/`;
  const existing = await q(`select id, status from clips where source_url = $1`, [sourceUrl]);
  const id = existing[0]?.id || clipId();
  const featuredUntil = new Date(Date.now() + FEATURED_DAYS * 864e5).toISOString();
  const now = new Date().toISOString();

  const row = {
    id,
    source_url: sourceUrl,
    video_url: v.src,
    author_handle: meta.author,
    caption_public: "",
    label: meta.label,
    label_commit: commitOf(id, meta.label),
    status: "soon",
    listed_by: "bd",
    badge: "",
    pin: 0,
    featured_until: featuredUntil,
    media_type: "video",
    media_json: "{}",
    updated_at: now,
  };

  const cols = Object.keys(row);
  const vals = cols.map((k) => row[k]);
  const ph = cols.map((_, i) => `$${i + 1}`).join(",");
  const upd = cols.filter((k) => !["id", "source_url", "created_at"].includes(k))
    .map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ");

  await q(
    `insert into "clips" (${cols.map((c) => `"${c}"`).join(",")})
     values (${ph})
     on conflict (source_url) do update set ${upd}`,
    vals
  );
  if (existing[0]) { updated++; console.log(`${pid}: обновлён (id=${id}, status=soon, label=${meta.label})`); }
  else { inserted++; console.log(`${pid}: вставлен (id=${id}, status=soon, label=${meta.label}, ${meta.note})`); }
}

console.log(`\nитог: вставлено ${inserted}, обновлено ${updated}, пропущено ${skipped}`);
const st = await q(`select status, count(*)::int n from clips group by status order by status`);
console.log("статусы clips:", JSON.stringify(st));
await close();
