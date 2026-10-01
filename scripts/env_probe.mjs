/* Проверка Supabase-соединения после восстановления .env */
import { q, one, close } from "./lib/supadb.mjs";

const v = await one('SELECT version() AS v');
console.log("PG:", (v?.v || "?").split(",")[0]);

const acc = await one('SELECT COUNT(*)::int AS n FROM "Account"');
const tg = await one('SELECT COUNT(*)::int AS n FROM "Account" WHERE "telegramId" IS NOT NULL');
const season = await one('SELECT code, status, "startsAt", "endsAt" FROM "Season" WHERE status = \'active\' LIMIT 1');
const bets = await one('SELECT COUNT(*)::int AS n FROM "Bet"');
console.log("accounts:", acc?.n, "| telegram-linked:", tg?.n, "| bets:", bets?.n);
console.log("active season:", season ? `${season.code} ${season.startsAt} → ${season.endsAt}` : "NONE");
await close();
