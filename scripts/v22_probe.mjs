#!/usr/bin/env node
/** проб: refqual → баланс A; freebet → summary.freebet */
import { q, one, close } from "./lib/supadb.mjs";
import { createSelfSession, dropSelfSession, sessionCookieFor } from "./lib/selfsession.mjs";
import { randomUUID } from "node:crypto";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function api(method, url, { cookies, body, ip = "10.7.7.2", bettorId } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: [cookies, bettorId ? `nr_bet=${bettorId}` : ""].filter(Boolean).join("; "),
      "x-forwarded-for": ip,
      "user-agent": "v22-selftest/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  const A = await createSelfSession({ email: `probe-a-${randomUUID().slice(0, 6)}@test.local` });
  const B = await createSelfSession({ email: `probe-b-${randomUUID().slice(0, 6)}@test.local`, bonusCents: 300 });
  await q(`UPDATE "Account" SET "refCode" = 'rprobeaaa' WHERE id = $1`, [A.accountId]);
  await q(`UPDATE "Account" SET "referredById" = $2 WHERE id = $1`, [B.accountId, A.accountId]);

  // ставим B
  const r = await api("POST", "/api/bet", {
    cookies: sessionCookieFor(B.accountId),
    bettorId: randomUUID(),
    body: { round_id: "no-real-round", side: "synth", amount_cents: 10, mode: "balance" },
  });
  console.log("bet(no-round) status:", r.status, r.json.error || "");

  // фрибет
  const fb = await api("POST", "/api/freebet/telegram", {
    cookies: sessionCookieFor(B.accountId),
    body: { username: "@probe_nicky" },
  });
  console.log("freebet:", fb.status, JSON.stringify(fb.json));

  // freebet в БД?
  const rows = await q(`SELECT "accountId", username, "amount_cents" FROM freebets WHERE username = 'probe_nicky'`);
  console.log("freebets rows:", JSON.stringify(rows));

  // summary для B
  const sum = await api("GET", "/api/me/summary", { cookies: sessionCookieFor(B.accountId) });
  console.log("summary.freebet:", JSON.stringify(sum.json.freebet));
  console.log("summary.shop:", JSON.stringify(sum.json.shop));
  console.log("summary.referrals:", JSON.stringify(sum.json.referrals));
  console.log("summary.badges:", JSON.stringify(sum.json.badges));

  await dropSelfSession(A.accountId);
  await dropSelfSession(B.accountId);
  await q(`DELETE FROM freebets WHERE username = 'probe_nicky'`).catch(() => {});
  await close();
}
main().catch((e) => { console.error(e); process.exit(1); });
