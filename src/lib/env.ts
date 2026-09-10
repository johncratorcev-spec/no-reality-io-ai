/**
 * Среда исполнения: локальная/VPS или serverless (Netlify/Vercel/AWS Lambda).
 *
 * Влияет на:
 * - автоджобу обновления ссылок (в serverless выключена: нет python,
 *   нет headless-браузера, процесс живет минуты);
 * - стратегию SQLite (в serverless копия БД кладётся в /tmp — см. lib/db.ts).
 */
export function isServerless(): boolean {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_DEV ||
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}
