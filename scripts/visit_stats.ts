// Статистика посещений и событий из Prisma/SQLite (db/custom.db).
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db npx tsx scripts/visit_stats.ts
// или: bun scripts/visit_stats.ts (bun сам подхватит .env)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function fmt(n: number) {
  return n.toLocaleString("ru-RU");
}

async function main() {
  const [clicks, stats, profiles, events, purchases] = await Promise.all([
    db.click.findMany({ orderBy: { createdAt: "asc" } }),
    db.postStats.findMany({ orderBy: { score: "desc" } }),
    db.referralProfile.findMany({ orderBy: { createdAt: "asc" } }),
    db.referralEvent.findMany({ orderBy: { createdAt: "asc" } }),
    db.purchase.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  console.log("=== ПОСЕЩЕНИЯ (Click — уникальные переходы по UTM) ===");
  console.log("Всего уникальных посещений:", fmt(clicks.length));
  if (clicks.length > 0) {
    const first = clicks[0].createdAt;
    const last = clicks[clicks.length - 1].createdAt;
    console.log("Первое:", first.toISOString(), "| Последнее:", last.toISOString());

    // по дням (UTC)
    const byDay = new Map<string, number>();
    for (const c of clicks) {
      const d = c.createdAt.toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    console.log("\n-- По дням (UTC) --");
    for (const [d, n] of [...byDay.entries()].sort()) {
      console.log(`${d}: ${"#".repeat(Math.min(n, 60))} ${n}`);
    }

    // по кодам
    const byCode = new Map<string, number>();
    for (const c of clicks) byCode.set(c.utmCode, (byCode.get(c.utmCode) ?? 0) + 1);
    console.log("\n-- Топ UTM-кодов --");
    for (const [code, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`${code}: ${n}`);
    }
  }

  console.log("\n=== РЕЙТИНГ (PostStats) ===");
  console.log("Кодов в рейтинге:", stats.length);
  const totalScore = stats.reduce((s, r) => s + r.score, 0);
  console.log("Сумма score:", fmt(totalScore));
  for (const s of stats.slice(0, 10)) console.log(`${s.utmCode}: ${s.score}`);

  console.log("\n=== КОШЕЛЬКИ (ReferralProfile) ===");
  console.log("Подключено кошельков:", fmt(profiles.length));
  for (const p of profiles) {
    console.log(`${p.wallet.slice(0, 10)}… → ${p.code} (${p.createdAt.toISOString()})`);
  }

  console.log("\n=== РЕФСОБЫТИЯ (ReferralEvent) ===");
  const evByKind = new Map<string, number>();
  for (const e of events) evByKind.set(e.kind, (evByKind.get(e.kind) ?? 0) + 1);
  console.log("Всего:", fmt(events.length), "| по типам:", JSON.stringify([...evByKind.entries()]));
  const paidSum = events
    .filter((e) => e.kind === "paid")
    .reduce((s, e) => s + parseFloat(e.payoutUsdt ?? "0"), 0);
  console.log("Начислено реферерам (USDT):", paidSum.toFixed(2));

  console.log("\n=== ПОКУПКИ (Purchase) ===");
  const byStatus = new Map<string, number>();
  for (const p of purchases) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  console.log("Всего:", fmt(purchases.length), "| по статусам:", JSON.stringify([...byStatus.entries()]));
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
