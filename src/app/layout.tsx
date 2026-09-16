import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "no reality.",
  description:
    "A feed of AI video from Threads. Watch. Share reality. pawcrewdaily — Partner of the Week.",
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#0A0A0A'/><text x='16' y='22' font-family='Arial' font-size='16' font-weight='bold' fill='white' text-anchor='middle'>nr</text></svg>`
      ),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFFFFF",
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
        {children}
        {/* Vercel Web Analytics: счётчик посетителей.
            Активируется в Vercel Dashboard → Analytics (нужен один клик,
            код уже подключён). На других хостингах компонент просто
            ничего не отправляет. */}
        <Analytics />
      </body>
    </html>
  );
}
