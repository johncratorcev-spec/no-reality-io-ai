/** Cleanup после API-смоука: ставки тестовые удаляются, рынки — в исходное live-состояние. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CODES = ["ZznHA9HM", "-bBc5Nno"];

const run = async () => {
  await db.cryoBet.deleteMany({});
  const res = await db.cryoMarket.updateMany({
    where: { postCode: { in: CODES } },
    data: {
      status: "live",
      endsAt: new Date("2026-09-22T12:00:00Z"),
      result: null,
      resolvedAt: null,
    },
  });
  console.log(`markets reset: ${res.count}`);
  const left = await db.cryoMarket.findMany({ include: { _count: { select: { bets: true } } } });
  for (const m of left) {
    console.log(`${m.postCode}: ${m.status}, endsAt=${m.endsAt.toISOString()}, bets=${m._count.bets}`);
  }
};

run().finally(() => db.$disconnect());
