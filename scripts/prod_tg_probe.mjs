/* Prod-проба: подписанный Telegram-payload против боевого /api/auth/telegram.
   Учётка welcome-only (0 ставок) — в снапшот сезона не попадает по правилам. */
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";

const line = fs.readFileSync("/home/z/my-project/.env", "utf-8")
  .split("\n").find((l) => l.startsWith("TELEGRAM_BOT_TOKEN="));
const TOKEN = line.slice("TELEGRAM_BOT_TOKEN=".length).trim();

const fields = {
  auth_date: String(Math.floor(Date.now() / 1000) - 30),
  first_name: "Prod Probe",
  id: "900700600",
  username: "nr_prod_probe",
};
const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(check).digest("hex");

const r = await fetch("https://no-reality.fun/api/auth/telegram", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...fields, hash }),
});
const d = await r.json().catch(() => null);
console.log("status:", r.status, "| ok:", d?.ok, "| created:", d?.created, "| balance:", d?.account?.balanceCents ?? d?.account?.balance, "| err:", d?.error ?? "-");
console.log(r.status === 200 && d?.ok ? "PROD TELEGRAM LOGIN: WORKS" : "PROD TELEGRAM LOGIN: BROKEN");

/* контроль подделки */
const bad = await fetch("https://no-reality.fun/api/auth/telegram", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...fields, hash: "f".repeat(64) }),
});
console.log("forged hash →", bad.status, bad.status === 401 ? "(rejected correctly)" : "(!!)");
