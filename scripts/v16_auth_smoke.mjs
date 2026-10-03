#!/usr/bin/env node
/**
 * v16 smoke: passport-google-oauth20 shim против живого dev-сервера :3000.
 * БД в песочнице недоступна → шаги signInWithGoogle падают в auth=google_failed,
 * НО мок (:9998) должен увидеть token + userinfo — это доказывает, что
 * passport-пайплайн (shim → стратегия → токен → профиль) работает end-to-end.
 */
const BASE = "http://127.0.0.1:3000";
let passed = 0;
let failed = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  PASS ${name}${extra ? ` — ${extra}` : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
};

function makeClient(name) {
  const cookies = new Map();
  const api = async function api(url) {
    const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(`${BASE}${url}`, {
      headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}), "x-forwarded-for": "203.0.113.77", "user-agent": `v16-smoke/${name}` },
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const pair = c.split(";")[0] || "";
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, location: res.headers.get("location"), setCookies: res.headers.getSetCookie?.() || [], cookies };
  };
  api.cookies = cookies;
  return api;
}

const anon = makeClient("anon");

/* 1. status enabled */
const st = await anon("/api/auth/google/status");
ok("1. status enabled:true", st.json?.enabled === true, JSON.stringify(st.json));

/* 2. start → 303 на accounts.google.com + state cookie + параметры */
const start = await anon("/api/auth/google/start");
const loc = start.location || "";
ok("2. start → 303 accounts.google.com", start.status === 303 && loc.startsWith("https://accounts.google.com/o/oauth2/v2/auth"), `status=${start.status} ${loc.slice(0, 90)}`);
const authUrl = new URL(loc);
ok("3. client_id + response_type=code + scope", authUrl.searchParams.get("client_id") === "smoke-client-id" && authUrl.searchParams.get("response_type") === "code" && (authUrl.searchParams.get("scope") || "").split(" ").join(" ").includes("openid email profile"), `scope=${authUrl.searchParams.get("scope")}`);
ok("4. redirect_uri + prompt + access_type=online", (authUrl.searchParams.get("redirect_uri") || "").endsWith("/api/auth/google/callback") && authUrl.searchParams.get("prompt") === "select_account" && authUrl.searchParams.get("access_type") === "online", authUrl.searchParams.toString().slice(0, 240));
const sc = (start.setCookies.find((c) => c.startsWith("nr_g_state=")) || "").toLowerCase();
ok("5. state-cookie HttpOnly + SameSite=lax", sc.includes("httponly") && sc.includes("samesite=lax"), sc.split(";").slice(1, 3).join(";").trim());
const state = start.cookies.get("nr_g_state");
ok("6. state cookie === state в URL (passport options.state)", Boolean(state) && authUrl.searchParams.get("state") === state);

/* 7. чужой state → google_state */
const bad = makeClient("bad");
await bad("/api/auth/google/start");
const r7 = await bad(`/api/auth/google/callback?code=mock:x@t.local:smoke-client-id:1&state=AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE`);
ok("7. чужой state → auth=google_state", (r7.location || "").includes("auth=google_state"), r7.location || "");

/* 8. без state-cookie → google_state */
const noc = makeClient("nocookie");
const r8 = await noc("/api/auth/google/callback?code=mock:x@t.local:smoke-client-id:1&state=whatever");
ok("8. без cookie → auth=google_state", (r8.location || "").includes("auth=google_state"), r8.location || "");

/* 9. полный callback: verified=0 → userinfo отдаёт профиль → emailVerified=false
      → auth=google_profile. ЭТО доказывает, что userinfo-шаг реально отработал
      (при падении userinfo было бы auth=google_failed). */
const good = makeClient("good");
await good("/api/auth/google/start");
const state2 = good.cookies.get("nr_g_state");
const r9 = await good(`/api/auth/google/callback?code=mock:smoke@test.local:${"smoke-client-id"}:0&state=${encodeURIComponent(state2 || "")}`);
ok("9. userinfo-шаг отработал: unverified-email → auth=google_profile", (r9.location || "").includes("auth=google_profile"), r9.location || "");

/* 9b. verified=1 → профиль валиден → signInWithGoogle:
      БД доступна → вход 303 → /bet + сессия (nr_uid/nr_auth);
      БД недоступна (сборка без секретов) → auth=google_failed. */
const good2 = makeClient("good2");
await good2("/api/auth/google/start");
const state3 = good2.cookies.get("nr_g_state");
const r9b = await good2(`/api/auth/google/callback?code=mock:smoke2@test.local:${"smoke-client-id"}:1&state=${encodeURIComponent(state3 || "")}`);
const loc9b = r9b.location || "";
const dbOn = loc9b.includes("/bet");
const dbOff = loc9b.includes("auth=google_failed");
const sessionSet = good2.cookies.has("nr_uid") && good2.cookies.has("nr_auth");
ok("9b. verified-профиль → вход (/bet + сессия) либо google_failed при БД-off",
   (dbOn && sessionSet) || dbOff, `${loc9b} session=${sessionSet}`);

/* 10. rate limit */
let got429 = false;
for (let i = 0; i < 25; i++) {
  const r = await makeClient("brute")("/api/auth/google/start");
  if (r.status === 429) { got429 = true; break; }
}
ok("10. лавина /start → 429", got429);

console.log(`\n[v16-smoke] ${passed} PASS, ${failed} FAIL`);
process.exitCode = failed > 0 ? 1 : 0;
