import type { NextConfig } from "next";

const isNetlify = Boolean(process.env.NETLIFY);

/* Файлы, нужные Node-рантайму на serverless (Netlify):
   - data/posts.csv — источник ленты (плюс встроенный снапшот-фолбэк);
   - db/custom.db — SQLite, создаётся prisma db push при сборке на Netlify;
   - Prisma client + query engine (bun на Netlify пропускает postinstall-скрипты
     недоверенных пакетов, поэтому клиент генерится явно в build-команде). */
const serverlessIncludes = [
  "./data/posts.csv",
  "./db/custom.db",
  "./prisma/schema.prisma",
  "./node_modules/.prisma/**",
  "./node_modules/@prisma/client/**",
];

const tracedRoutes = ["/", "/v/[code]", "/r/[code]", "/api/admin/refresh"];

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
};

export default nextConfig;
