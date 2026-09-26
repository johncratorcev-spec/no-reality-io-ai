import type { Metadata } from "next";
import MoodPageView from "@/components/vhz/MoodPageView";
import { getMood } from "@/lib/moods";

const KEY = "future" as const;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const m = getMood(KEY);
  if (!m) return { title: "mood not found", robots: { index: false } };
  return {
    title: m.en.title,
    description: m.en.blurb,
    alternates: {
      canonical: `/moods/${m.key}`,
      languages: {
        en: `/moods/${m.key}`,
        ru: `/moods/${m.key}?lang=ru`,
        "x-default": `/moods/${m.key}`,
      },
    },
    openGraph: {
      title: m.en.title,
      description: m.en.blurb,
      url: `/moods/${m.key}`,
      type: "website",
      images: ["/images/og-vhs.png"],
    },
  };
}

export default function MoodPage() {
  return <MoodPageView moodKey={KEY} />;
}
