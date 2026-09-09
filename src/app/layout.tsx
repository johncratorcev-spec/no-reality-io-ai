import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "no reality.",
  description:
    "Лента AI-видео из Threads. Смотри, делись реальностью — место ожидает владельца.",
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7C3AED'/><stop offset='0.5' stop-color='#D946EF'/><stop offset='1' stop-color='#F59E0B'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-family='Arial' font-size='16' font-weight='bold' fill='white' text-anchor='middle'>nr</text></svg>`
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
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${manrope.variable} antialiased bg-white text-[#1B1523] font-[family-name:var(--font-manrope)]`}
      >
        {children}
      </body>
    </html>
  );
}
