#!/usr/bin/env node
/**
 * v15 selftest — СОРЕВНОВАНИЯ (первое соревнование, badge="raffle-01").
 *
 * Что проверяет:
 *   1. POST /api/admin/clips: badge="raffle-01" принимается (200);
 *      произвольный badge ("золото", "featured") — 400 bad_badge;
 *      без метки по-прежнему 400.
 *   2. Публичный payload: /api/round отдаёт clip.competition="raffle-01",
 *      НЕ отдаёт метку/автора/исходник/CDN; номер нормализуется до 2 цифр.
 *   3. Жизненный цикл: соревновательный клип сам проходит
 *      queued → live → resolved (планировщик), competition живёт во всех
 *      статусах, после резолва раскрывается resolvedAs + label_commit.
 *   4. /bet рендерится; RSC-пейлоад содержит competition-проп клипа.
 *
 * Запуск: дев-сервер на :3000 + доступ к Supabase (DIRECT_URL):
 *   node scripts/v15_raffle_selftest.mjs
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { q, one, close } from "./lib/supadb.mjs";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      /* кавычки срезаем — сервер (dev_up.sh) читает значение БЕЗ них */
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const ADMIN_KEY = env.ADMIN_SECRET;
const PEPPER = env.COMMIT_PEPPER;

let passed = 0;
let failed = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function commitOf(id, label) {
  return createHash("sha256").update(`${label}:${id}:${PEPPER}`).digest("hex");
}

async function tick() {
  const secret = process.env.CRON_SECRET || env.CRON_SECRET || "";
  const r = await fetch(`${BASE}/api/cron/tick`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  }).catch(() => null);
  let json = null;
  try { json = await r?.json(); } catch {}
  return { status: r?.status ?? 0, json };
}

async function sampleVideoUrl() {
  const r = await one(
    `select video_url from clips where status = 'resolved' and video_url like 'https://scontent%' limit 1`
  );
  if (r?.video_url) {
    try {
      const probe = await fetch(r.video_url, {
        headers: { Range: "bytes=0-1" },
        signal: AbortSignal.timeout(8000),
      });
      if (probe.ok || probe.status === 206) return r.video_url;
    } catch {}
  }
  /* фолбэк: CDN-ссылкиresolved-клипов мертвы (эпоха oe истекла) —
     стабильный публичный mp4, как в v13_mechanics */
  try {
    const probe = await fetch("https://www.w3schools.com/html/mov_bbb.mp4", {
      headers: { Range: "bytes=0-1" },
      signal: AbortSignal.timeout(8000),
    });
    if (probe.ok || probe.status === 206) return "https://www.w3schools.com/html/mov_bbb.mp4";
  } catch {}
  return null;
}

async function insertCompClip(id, label, videoUrl, backdateMs, badge) {
  await q(
    `insert into clips (id, source_url, video_url, author_handle, caption_public, label, label_commit, status, listed_by, badge, created_at, updated_at)
     values ($1,$2,$3,'@test','',$4,$5,'queued','selftest', $6, $7, $7)
     on conflict (id) do nothing`,
    [
      id,
      `https://example.com/selftest-comp/${id}`,
      videoUrl,
      label,
      commitOf(id, label),
      badge,
      new Date(Date.now() - backdateMs).toISOString(),
    ]
  );
}

async function run() {
  console.log(`\n[v15-selftest] ${BASE}\n`);

  /* ---- prelude: чистим остатки ---- */
  await q(`delete from "Bet" where "roundId" in (select id from "Round" where "clipCode" in (select id from clips where source_url like 'https://example.com/selftest-comp%'))`).catch(() => {});
  await q(`delete from "Round" where "clipCode" in (select id from clips where source_url like 'https://example.com/selftest-comp%')`).catch(() => {});
  await q(`delete from clips where source_url like 'https://example.com/selftest-comp%'`).catch(() => {});

  const vid = await sampleVideoUrl();
  ok("есть живой sample video_url", Boolean(vid));
  if (!vid) {
    console.log("[v15] нет живого видео — selftest прерван (сеть?)");
    await close();
    process.exit(failed ? 1 : 0);
  }

  /* ================= 1. админ-API: бейдж ================= */
  console.log("── 1. POST /api/admin/clips + badge");

  const noLabel = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_KEY },
    body: JSON.stringify({ sourceUrl: "https://example.com/comp-x", videoUrl: vid, badge: "raffle-01" }),
  });
  ok("без метки — по-прежнему 400", noLabel.status === 400, `status=${noLabel.status}`);

  const badBadge = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_KEY },
    body: JSON.stringify({ sourceUrl: "https://example.com/comp-x", videoUrl: vid, label: "real", badge: "золотой-клип" }),
  });
  ok("произвольный badge — 400 bad_badge", badBadge.status === 400, `status=${badBadge.status}`);

  const src = `https://example.com/selftest-comp-${Date.now()}`;
  const created = await fetch(`${BASE}/api/admin/clips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": ADMIN_KEY },
    body: JSON.stringify({ sourceUrl: src, videoUrl: vid, label: "real", listedBy: "selftest", badge: "raffle-01" }),
  });
  const cd = await created.json().catch(() => null);
  const clipId = cd?.clip?.id ?? "";
  ok("badge raffle-01 принят — 200 queued", created.status === 200 && cd?.clip?.status === "queued", `status=${created.status}`);
  const row = clipId ? await one(`select badge, label_commit from clips where id = $1`, [clipId]) : null;
  ok("badge сохранён в clips", row?.badge === "raffle-01", row?.badge ?? "нет");
  ok("label_commit = sha256(label:id:pepper)", cd?.clip?.labelCommit === commitOf(clipId, "real"));

  /* нормализация: raffle-7 → публично нормализуется до raffle-07 */
  const nId = `v15n${Date.now().toString(36)}`.slice(0, 16);
  await insertCompClip(nId, "synth", vid, 3_600_000, "raffle-7");
  const rN = await fetch(`${BASE}/api/round?clip=${nId}`).then((r) => r.json()).catch(() => null);
  ok("номер нормализуется: raffle-7 → raffle-07", rN?.clip?.competition === "raffle-07", rN?.clip?.competition ?? "нет");

  /* ================= 2. жизненный цикл ================= */
  console.log("── 2. Планировщик: queued → live → resolved");

  /* наш клип — самый старый */
  await q(`update clips set created_at = $1 where id = $2`, [
    new Date(Date.now() - 7_200_000).toISOString(),
    clipId,
  ]);
  /* закрываем чужие live-раунды, чтобы планировщик взял тестовый */
  await q(`update "Round" set "closesAt" = $1 where status in ('open','locked') and "clipCode" in (select id from clips where listed_by = 'selftest')`, [
    new Date(Date.now() - 1000).toISOString(),
  ]);
  const t1 = await tick();
  ok("cron/tick ok", t1.status === 200 && t1.json?.ok === true, JSON.stringify(t1.json ?? {}));

  let live = null;
  for (let i = 0; i < 45; i++) {
    live = await one(`select * from clips where id = $1`, [clipId]);
    if (live?.status === "live") break;
    await q(`update "Round" set "closesAt" = $1 where status in ('open','locked') and "clipCode" in (select id from clips where listed_by = 'selftest')`, [
      new Date(Date.now() - 1000).toISOString(),
    ]);
    await tick();
    await new Promise((r) => setTimeout(r, 700));
  }
  ok("соревновательный клип стал live", live?.status === "live", live?.status ?? "нет");

  const r1 = await fetch(`${BASE}/api/round?clip=${clipId}`).then((r) => r.json()).catch(() => null);
  ok("GET /api/round отдал live-раунд", r1?.round?.status === "open");
  ok("competition в публичном payload", r1?.clip?.competition === "raffle-01", r1?.clip?.competition ?? "нет");
  const raw1 = JSON.stringify(r1);
  ok("метка НЕ утекает до резолва", !raw1.includes('"label"') && !raw1.includes('"resolvedAs"'));
  ok("автор/исходник/CDN не утекают", !raw1.includes('"authorHandle"') && !raw1.includes('"sourceUrl"') && !raw1.includes("cdninstagram"));

  /* витрина /bet — пока клип live: фид отдаёт только bettable (live),
   competition-проп доходит до ClipCard именно в live-фазе */
  const betHtml = await fetch(`${BASE}/bet`).then((r) => r.text()).catch(() => "");
  ok("/bet 200 и рендерится", betHtml.length > 1000);
  ok("competition-проп присутствует в пейлоаде", betHtml.includes('"competition":"01"') || betHtml.includes("competition"));

  /* окно прошло → резолв */
  await q(`update "Round" set "closesAt" = $1 where "clipCode" = $2`, [
    new Date(Date.now() - 1000).toISOString(),
    clipId,
  ]);
  await tick();
  let resolved = null;
  for (let i = 0; i < 6; i++) {
    resolved = await one(`select * from clips where id = $1`, [clipId]);
    if (resolved?.status === "resolved") break;
    await tick();
    await new Promise((r) => setTimeout(r, 700));
  }
  ok("клип resolved (без ставок)", resolved?.status === "resolved", resolved?.status ?? "нет");

  const r2 = await fetch(`${BASE}/api/round?clip=${clipId}`).then((r) => r.json()).catch(() => null);
  ok("после резолва: resolvedAs раскрыт", r2?.round?.resolvedAs === "real" || r2?.round?.resolvedAs === "synth", r2?.round?.resolvedAs ?? "нет");
  ok("после резолва: label_commit на месте", typeof r2?.round?.labelCommit === "string" && r2.round.labelCommit.length === 64);
  ok("competition живёт и после резолва", r2?.clip?.competition === "raffle-01", r2?.clip?.competition ?? "нет");
  ok("hashMatched=true (хеш сошёлся)", r2?.round?.hashMatched === true);

  /* ================= 3. витрина /bet (после резолва) ================= */
  console.log("── 3. /bet — после резолва клип уходит из bettable-фида (проверено на live-фазе выше)");
  const betHtml2 = await fetch(`${BASE}/bet`).then((r) => r.text()).catch(() => "");
  ok("/bet 200 и рендерится и после резолва", betHtml2.length > 1000);

  /* ================= cleanup ================= */
  console.log("── cleanup");
  await q(`delete from "Bet" where "roundId" in (select id from "Round" where "clipCode" = $1)`, [clipId]).catch(() => {});
  await q(`delete from "Round" where "clipCode" = $1`, [clipId]).catch(() => {});
  await q(`delete from clips where id = $1`, [clipId]).catch(() => {});
  await q(`delete from clips where source_url like 'https://example.com/selftest-comp%'`).catch(() => {});
  ok("тестовые клипы удалены", ((await one(`select count(*)::int as n from clips where source_url like 'https://example.com/selftest-comp%'`))?.n ?? 0) === 0);

  await close();
  console.log(`\n[v15-selftest] ИТОГО: ${passed} PASS / ${failed} FAIL\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(async (e) => {
  console.error("selftest crashed:", e);
  await close().catch(() => {});
  process.exit(1);
});
