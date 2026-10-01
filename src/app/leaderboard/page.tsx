import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LeaderboardClient from "./LeaderboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "god eye — season leaderboard",
  description:
    "The best eyes of the season, ranked. Winrate, streaks, volume, correct calls — humans vs the machine, scored live. Only current season counts.",
  alternates: { canonical: "/leaderboard", languages: { ru: "/leaderboard?lang=ru", en: "/leaderboard" } },
  robots: { index: true, follow: true },
};

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0B0910] text-[#f2ede4]">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8">
        <LeaderboardClient />
      </main>
      <Footer />
    </div>
  );
}
