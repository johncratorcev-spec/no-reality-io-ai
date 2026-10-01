import type { Metadata } from "next";
import { cookies } from "next/headers";
import AdminGate from "@/components/admin/AdminGate";
import BdConsole from "./BdConsole";
import { verifyAdminToken } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "no reality. / bd",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * v13 — BD-консоль (/admin/bd): доступ только по ADMIN_SECRET
 * (timing-safe, rate-limit, httpOnly HMAC-cookie 2ч). Мобиль-first.
 */
export default async function BdPage() {
  const jar = await cookies();
  const unlocked = verifyAdminToken(jar.get("nr_admin")?.value);

  return (
    <main className="min-h-screen bg-[#08070b] text-[#f2ede4]">
      {unlocked ? (
        <BdConsole />
      ) : (
        <div className="mx-auto max-w-md px-4 py-10">
          <AdminGate hint="no-reality.fun / admin — BD console" />
        </div>
      )}
    </main>
  );
}
