import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Manrope, Unbounded } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import RefCapture from "@/components/wallet/RefCapture";
import TrackVisit from "@/components/track/TrackVisit";
import { LangProvider } from "@/lib/i18n";
import { FEATURES } from "@/lib/features";
import { SITE } from "@/lib/site";
import "./globals.css";
// кровавый карнавал (nrld-*) — шим легаси-страниц; vhz-* (VHS-zine) —
// дизайн-система v3, грузится последней и перекрывает палитру
import "@/components/landing/landing.css";
import "@/components/vhz/vhz.css";

/* v3 VHS-zine: Manrope — тело (теперь с кириллицей), Unbounded —
   дисплейные заголовки, IBM Plex Mono — таймкоды/стампы/капшены */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});
const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700", "900"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
  display: "swap",
});

/* SEO/GEO base (v3 hub): позиционирование — интерактивный хаб
   AI-контента и предсказаний; hreflang en/ru с первого дня. */
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
    "AI content hub",
    "AI predictions",
    "real or synth",
    "AI generated video",
    "synthetic media game",
    "spot AI video",
    "AI video feed",
    "prediction game",
    "pari-mutuel betting",
    "crypto predictions",
    "prompt market",
  ],
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      ru: "/?lang=ru",
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
    alternateLocale: ["ru_RU"],
    images: [
      {
        url: "/images/og-vhs.png",
        width: 1200,
        height: 630,
        alt: "no reality. — interactive hub of AI content & predictions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
    images: ["/images/og-vhs.png"],
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
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#0b0b10'/><text x='16' y='22' font-family='Arial' font-size='16' font-weight='bold' fill='#FFD400' text-anchor='middle'>nr</text></svg>`
      ),
  },
  other: {
    /* geo hints: хаб глобальный, EN+RU */
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
  themeColor: "#0b0b10",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${unbounded.variable} ${plexMono.variable} vhz-root antialiased bg-[#0b0b10] text-[#f4f2ec] font-[family-name:var(--font-manrope)]`}
      >
        <LangProvider>
          {/* ловец ?ref= — реферальная атрибуция на любой странице */}
          <RefCapture />
          {/* счётчик посещений страниц → /api/track (pageviews в БД) */}
          <TrackVisit />
          {children}
        </LangProvider>
        {/* Vercel Web Analytics: счётчик посетителей.
            Активируется в Vercel Dashboard → Analytics (нужен один клик,
            код уже подключён). На других хостингах компонент просто
            ничего не отправляет. */}
        <Analytics />
        {/* Cloudflare Web Analytics (task 44, §1.4): beacon ставится только
            при заданном NEXT_PUBLIC_CF_BEACON_TOKEN. Без токена — ничего
            не грузит. */}
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
