import type { NextConfig } from "next";

const isNetlify = Boolean(process.env.NETLIFY);

/* Файлы, нужные Node-рантайму на serverless (Netlify):
   - db/custom.db — SQLite, создаётся prisma db push при сборке на Netlify;
   - Prisma client + query engine (bun на Netlify пропускает postinstall-скрипты
     недоверенных пакетов, поэтому клиент генерится явно в build-команде). */
const serverlessIncludes = [
  "./db/custom.db",
  "./prisma/schema.prisma",
  "./node_modules/.prisma/**",
  "./node_modules/@prisma/client/**",
];

const tracedRoutes = [
  "/",
  "/v/[code]",
  "/r/[code]",
  "/api/admin/refresh",
  "/api/cron/tick",
  "/api/packs",
  "/api/webhooks/2328",
];

const nextConfig: NextConfig = {
  /* На Netlify работает свой Next-runtime (@netlify/plugin-nextjs) —
     standalone-выхлоп там не нужен и может конфликтовать. */
  output: isNetlify ? undefined : "standalone",
  outputFileTracingIncludes: Object.fromEntries(
    tracedRoutes.map((route) => [route, serverlessIncludes])
  ),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  /* v7 (п.13 ТЗ): скорость. Иконки lucide тянутся поимённо —
        optimizePackageImports режет мёртвые экспорты из бандла. */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  compress: true,
  poweredByHeader: false,

  /* v4: mood-каналы убраны; v6: продажа промптов убрана entirely —
     старые ссылки /market ведут в предикшен-ленту. */
  async redirects() {
    return [
      { source: "/moods", destination: "/feed", permanent: true },
      { source: "/moods/:mood", destination: "/feed", permanent: true },
      { source: "/market", destination: "/bet", permanent: true },
      { source: "/market/:path*", destination: "/bet", permanent: true },
    ];
  },

  /* Task 44 (Cloudflare free, §1) + v7 (п.10/14 ТЗ): origin-заголовки.
       - /_next/static — хэшированный бандл: immutable, год;
       - /images, /sfx, /partner — наши ассеты: неделя + SWR-сутки;
       - /api/posts — единственный «контентный» API: edge-кэш Vercel/CF
         60с + SWR 5 мин (лиента меняется редко, ставки — не тут);
       - /api — всё остальное никогда не кэшировать;
       - /admin/:path* — допускаем встраивание в iframe (white label):
         frame-ancestors *; остальной сайт — только self;
       - базовые security-заголовки на всё. */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:asset(images|sfx|partner)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/api/posts",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, s-maxage=60, stale-while-revalidate=300, max-age=15",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          /* CSP frame-ancestors вместо X-Frame-Options: /admin перекрывается
             своим правилом выше (white-label iframe), остальное — only self */
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
