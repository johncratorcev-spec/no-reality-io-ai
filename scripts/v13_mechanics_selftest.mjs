#!/usr/bin/env node
/**
 * Selftest v13: гейм-механики ТЗ (против dev-сервера :3000, Supabase).
 *
 * F. Leaderboard: 200, форма top[], me=null для анонима
 * G. Arena API: 401 без ключа; round отдаёт открытый раунд без truth;
 *    predict пишет; повторный апдейт; scoreboard 200; чужой ключ 401
 * H. OG-картинка раунда: 200 + image/png
 *
 * Запуск: node scripts/v13_mechanics_selftest.mjs (сервер уже поднят).
 */

import fs from "node:fs";
import path from "node:path";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

function envFromDotenv(name) {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}
const ARENA_KEY = envFromDotenv("ARENA_API_KEY");

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

async function j(url, opts = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "user-agent": "v13-selftest/1.0", ...(opts.headers || {}) },
    ...(opts.body ? { method: opts.method || "POST", body: JSON.stringify(opts.body) } : {}),
  });
  const ct = res.headers.get("content-type") || "";
  const json = ct.includes("json") ? await res.json().catch(() => null) : null;
  return { status: res.status, json, ct, buf: json ? null : await res.arrayBuffer() };
}

async function run() {
  console.log(`\n[v13-selftest] ${BASE} — гейм-механики ТЗ\n`);

  /* ---------- F. Leaderboard ---------- */
  console.log("[F] leaderboard");
  const lb = await j("/api/leaderboard?limit=20");
  ok("F1. GET /api/leaderboard → 200", lb.status === 200 && lb.json?.ok === true);
  ok(
    "F2. форма: top[] + season + me",
    Array.isArray(lb.json?.top) && lb.json?.season?.code === "s1" && lb.json?.me === null,
    `top=${lb.json?.top?.length ?? "?"}`
  );
  const lbRows = lb.json?.top ?? [];
  ok(
    "F3. строки: rank/winrate/badges/streak",
    lbRows.every(
      (r) => typeof r.rank === "number" && typeof r.winrate === "number" && Array.isArray(r.badges) && typeof r.streak === "number"
    )
  );

  /* ---------- G. Arena ---------- */
  console.log("\n[G] arena api");
  const noKey = await j("/api/arena/round");
  ok("G1. без ключа → 401", noKey.status === 401);

  const badKey = await j("/api/arena/round", { headers: { "x-agent-key": "wrong-key-000" } });
  ok("G2. чужой ключ → 401", badKey.status === 401);

  /* Preparing an open round: first bettable clip from /api/posts (bettable=true, truth is not disclosed) + lazy opening */
  const posts = await j("/api/posts");
  const bettable = (posts.json?.posts ?? []).filter((p) => p.bettable && p.utmCode);
  if (bettable.length > 0) {
    await j(`/api/round?clip=${encodeURIComponent(bettable[0].utmCode)}`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  const round = await j("/api/arena/round", { headers: { "x-agent-key": ARENA_KEY } });
  ok(
    "G3. с ключом → 200 + раунд без truth",
    round.status === 200 && round.json?.round?.clipCode && round.json?.round?.videoUrl,
    `clip=${round.json?.round?.clipCode ?? "-"}`
  );
  const rJson = round.json || {};
  ok(
    "G4. truth не утекает",
    rJson.round?.resolvedAs === undefined && rJson.round?.truth === undefined && !JSON.stringify(rJson).includes('"truth"')
  );

  if (round.status === 200 && rJson.round?.clipCode) {
    const clip = rJson.round.clipCode;
    const p1 = await j("/api/arena/predict", {
      headers: { "x-agent-key": ARENA_KEY },
      body: { clipCode: clip, call: "real", reasoning: "v13 selftest", agentName: "v13-test-agent" },
    });
    ok("G5. predict → 200 recorded", p1.status === 200 && p1.json?.ok === true, JSON.stringify(p1.json?.error));

    const p2 = await j("/api/arena/predict", {
      headers: { "x-agent-key": ARENA_KEY },
      body: { clipCode: clip, call: "synth", reasoning: "updated", agentName: "v13-test-agent" },
    });
    ok("G6. повторный predict апдейтит (один на агент/раунд)", p2.status === 200 && p2.json?.call === "synth");

    const pBad = await j("/api/arena/predict", {
      headers: { "x-agent-key": ARENA_KEY },
      body: { clipCode: clip, call: "maybe", agentName: "v13-test-agent" },
    });
    ok("G7. плохой call → 400", pBad.status === 400);

    const sb = await j("/api/arena/scoreboard");
    ok(
      "G8. scoreboard → 200, форма",
      sb.status === 200 && Array.isArray(sb.json?.agents),
      `agents=${sb.json?.agents?.length ?? "?"}`
    );
  } else {
    ok("G5-G8. нет открытого раунда — predict-блок пропущен", true, "no open round");
  }

  /* ---------- H. OG-картинка ---------- */
  console.log("\n[H] og image");
  const og = await j(`/api/og/round/${rJson.round?.clipCode || "demo-code"}`);
  ok("H1. OG → 200 image/png", og.status === 200 && og.ct.includes("image/png"), `${og.ct} ${(og.buf?.length ?? 0) / 1024 | 0}KB`);

  /* ---------- страницы ---------- */
  console.log("\n[I] страницы");
  for (const [name, path, need] of [
    ["I1. /leaderboard", "/leaderboard", "god eye"],
    ["I2. /roadmap arena", "/roadmap", "agents"],
    ["I3. /admin/bd gate", "/admin/bd", "enter the secret"],
    ["I4. /admin/bd-guide gate", "/admin/bd-guide", "bd console"],
  ]) {
    const p = await j(path);
    const html = p.json ? "" : Buffer.from(p.buf || "").toString();
    ok(
      `${name} → 200, «${need}»`,
      p.status === 200 && html.toLowerCase().includes(need.toLowerCase())
    );
  }

  console.log(`\n=== ИТОГ: ${passed} PASS / ${failed} FAIL ===`);

  /* cleanup: тестовые предикты агента */
  try {
    const { q, close } = await import("./lib/supadb.mjs");
    await q("DELETE FROM \"ArenaPrediction\" WHERE \"agentName\" = 'v13-test-agent'");
    console.log("  cleanup: arena-предикты v13-test-agent удалены");
    await close();
  } catch (e) {
    console.log("  cleanup skipped:", e.message);
  }

  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
