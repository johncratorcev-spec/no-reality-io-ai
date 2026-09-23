import type { Metadata } from "next";
import UnlockPanel from "@/components/market/UnlockPanel";
import Menu from "@/components/menu/Menu";

export const metadata: Metadata = {
  title: "unlock — prompt market",
  description: "Your prompt unlocks here the second the card payment confirms.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/market/thanks" },
};

/* ================================================================
   /market/thanks?session_id=cs_… — возврат после Stripe Checkout.

   Страница транзакционная: noindex, без JSON-LD, ничего не кэшируем.
   Всё состояние живёт в UnlockPanel (поллинг session-status с
   проверкой cookie покупателя на сервере).
   ================================================================ */

export const dynamic = "force-dynamic";

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";

  return (
    <main className="min-h-dvh bg-white">
      <section className="relative overflow-hidden py-10 text-[#10161d] sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 80% at 70% 10%, rgba(183,157,255,.16), transparent 60%), radial-gradient(50% 60% at 15% 90%, rgba(255,178,125,.14), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="mb-8 flex items-center gap-3">
            <a
              href="/"
              className="nr-logo select-none text-[1.2rem] font-extrabold leading-none tracking-tight"
            >
              no reality.
            </a>
            <div className="ml-auto">
              <Menu />
            </div>
          </div>
          <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.28em] text-[#6d4fc2]">
            prompt market · unlock
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <UnlockPanel sessionId={sessionId} />
      </section>
    </main>
  );
}
