/* eslint-disable @typescript-eslint/no-require-imports */
/* Cleanup task 43 test data: bets, market state, favorites */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  await db.cryoBet.deleteMany({});
  await db.cryoMarket.updateMany({
    where: { status: { in: ["expired", "resolved"] } },
    data: { status: "live", result: null, resolvedAt: null },
  });
  await db.favorite.deleteMany({});
  const markets = await db.cryoMarket.findMany();
  console.log("markets:", markets.map((m) => `${m.postCode}:${m.status}`).join(" "));
  console.log("bets:", await db.cryoBet.count(), "favorites:", await db.favorite.count());
  await db.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
