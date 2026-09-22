import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import RefCapture from "@/components/wallet/RefCapture";
import TrackVisit from "@/components/track/TrackVisit";
import { FEATURES } from "@/lib/features";
import { SITE } from "@/lib/site";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

/* SEO/GEO base (task 43): every route inherits metadataBase (canonical/OG
   URL resolution), the title template, EN locale targeting, social cards
   with a real cover image and geo/distribution hints for search crawlers. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: "%s — no reality.",
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: "no reality.", url: SITE.url }],
  creator: "no reality.",
  publisher: "no reality.",
  category: "technology",
  keywords: [
    "AI video feed",
    "AI generated videos",
    "prediction market",
    "USDC predictions",
    "Phantom wallet predictions",
    "pari-mutuel betting",
    "prompt marketplace",
    "buy AI video prompts",
    "Threads AI video",
    "Veo prompts",
    "AI video curation",
  ],
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    locale: "en_US",
    images: [
      {
        url: "/images/og-cover.png",
        width: 1200,
        height: 630,
        alt: "no reality. — AI video feed, prediction markets and the prompt market",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: ["/images/og-cover.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#0A0A0A'/><text x='16' y='22' font-family='Arial' font-size='16' font-weight='bold' fill='white' text-anchor='middle'>nr</text></svg>`
      ),
  },
  other: {
    /* geo hints: the feed is globally targeted, EN content */
    "geo.region": "US",
    "geo.placename": "Worldwide",
    distribution: "global",
    coverage: "Worldwide",
    target: "all",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} antialiased bg-white text-[#1B1523] font-[family-name:var(--font-manrope)]`}
      >
        {/* ловец ?ref= — реферальная атрибуция на любой странице */}
        <RefCapture />
        {/* счётчик посещений страниц → /api/track (pageviews в БД) */}
        <TrackVisit />
        {children}
        {/* Vercel Web Analytics: счётчик посетителей.
            Активируется в Vercel Dashboard → Analytics (нужен один клик,
            код уже подключён). На других хостингах компонент просто
            ничего не отправляет. */}
        <Analytics />
        {/* Cloudflare Web Analytics (task 44, §1.4): beacon ставится только
            при заданном NEXT_PUBLIC_CF_BEACON_TOKEN (токен из
            Cloudflare → Analytics → Install). Без токена — ничего не грузит. */}
        {FEATURES.cloudflareBeacon && (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({
              token: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN,
            })}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
