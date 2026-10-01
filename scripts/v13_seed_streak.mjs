/* v13 — создаёт реальную серию из 3 побед для E2E-скриншота лидерборда.
   Аккаунт через открытую регистрацию; ставки по truth из CSV (локально).
   3 клипа параллельно → ленивый резолв → 3 победы подряд → streak_bonus. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import Papa from "papaparse";

const BASE = "http://127.0.0.1:3000";

function envFromDotenv(name) {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), ".env"), "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : "";
}
const ADMIN_SECRET = envFromDotenv("ADMIN_SECRET");
const TEST_IP = "203.0.115.77";

const csv = fs.readFileSync("data/posts.csv", "utf-8");
const parsed = Papa.parse(csv, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim().toLowerCase(),
});
const truthOf = {};
for (const r of parsed.data) {
  if ((r.truth === "real" || r.truth === "synth") && r.utm_code && r.video_url) {
    truthOf[r.utm_code] = r.truth;
  }
}
const picks = Object.entries(truthOf).slice(0, 3);
console.log("picks:", picks);

const jar = new Map();
async function call(method, url, body) {
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      "x-forwarded-for": TEST_IP,
      "user-agent": "v13-e2e-seeder/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  for (const c of res.headers.getSetCookie?.() || []) {
    const pair = c.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const j = await res.json().catch(() => null);
  return { status: res.status, j };
}

const stamp = Date.now();
const email = `v13-e2e-${stamp}@test.dev`;
const reg = await call("POST", "/api/auth/password", { email, password: "v13-e2e-seed-12" });
console.log("register:", reg.status, reg.j?.status, "bal:", reg.j?.account?.balanceCents);
if (reg.status !== 200) process.exit(1);

/* открываем 3 раунда и ставим на правильную сторону параллельно */
const bets = await Promise.all(
  picks.map(async ([clip, truth]) => {
    const r = await call("GET", `/api/round?clip=${encodeURIComponent(clip)}`);
    const roundId = r.j?.round?.id;
    if (!roundId) return { clip, err: r.j?.error || "no round" };
    const b = await call("POST", "/api/bet", {
      round_id: roundId,
      side: truth,
      amount_cents: 25,
      mode: "balance",
    });
    return { clip, truth, status: b.status, betId: b.j?.bet?.id, err: b.j?.error };
  })
);
console.log("bets:", JSON.stringify(bets, null, 1));

/* ждём окно (BET_WINDOW_SEC=25 в dev) + запас на латентность Supabase */
await new Promise((r) => setTimeout(r, 32_000));
for (const [clip] of picks) {
  const r = await call("GET", `/api/round?clip=${encodeURIComponent(clip)}`);
  await new Promise((r2) => setTimeout(r2, 1500));
  const r2 = await call("GET", `/api/round?clip=${encodeURIComponent(clip)}`);
  console.log(`resolve-check ${clip}:`, r2.j?.round?.status, r2.j?.round?.myResult ?? "", r2.j?.round?.myPayoutCents ?? "");
}

const me = await call("GET", "/api/me");
console.log("balance:", me.j?.account?.balanceCents, "authed:", me.j?.authed);

/* фиксируем секрет для чистки */
const accId = reg.j?.account?.accountId;
const ipHash = createHash("sha256").update(`${TEST_IP}|${ADMIN_SECRET}`).digest("hex").slice(0, 32);
fs.writeFileSync(
  "scripts/v13_seed_state.json",
  JSON.stringify({ email, accountId: accId, picks, ipHash }, null, 2)
);
console.log("state → scripts/v13_seed_state.json");
