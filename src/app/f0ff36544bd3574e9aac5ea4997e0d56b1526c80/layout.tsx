import type { Metadata } from "next";

/* Панель управления лентой: доступ только по длинному секретному пути,
   никаких ссылок с сайта и индексации. */
export const metadata: Metadata = {
  title: "no reality. / control",
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
