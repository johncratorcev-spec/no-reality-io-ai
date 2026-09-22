import type { NextConfig } from "next";

const isNetlify = Boolean(process.env.NETLIFY);

/* Файлы, нужные Node-рантайму на serverless (Netlify):
   - data/posts.csv — источник ленты (плюс встроенный снапшот-фолбэк);
   - db/custom.db — SQLite, создаётся prisma db push при сборке на Netlify;
   - Prisma client + query engine (bun на Netlify пропускает postinstall-скрипты
     недоверенных пакетов, поэтому клиент генерится явно в build-команде). */
const serverlessIncludes = [
  "./data/posts.csv",
  "./data/prompts.csv",
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
  "/api/admin/payouts",
  "/api/prompts/[code]/checkout",
  "/api/prompts/[code]/status",
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

  /* Task 44 (Cloudflare free, §1): origin-заголовки, которыми CF (и любые
     CDN/браузеры) руководствуются автоматически:
       - /_next/static — хэшированный бандл: immutable, год;
       - /images, /sfx, /partner — наши ассеты: неделя + SWR-сутки;
       - /api — никогда не кэшировать (ставки/сессии/статистика).
     HTML Next отдаёт сам с no-store (страницы динамические) — в CF
     достаточно Cache Rule «Bypass для HTML», см. docs/cloudflare-setup.md. */
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
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;
