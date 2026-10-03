#!/bin/bash
# Гарантирует живой дев-сервер: проверяет :3000, при отсутствии — поднимает и ждёт Ready.
# ВАЖНО: экспортируем .env ПОВЕРХ унаследованного окружения — иначе внешний
# DATABASE_URL=file:... (системный экспорт) побеждает Supabase-строку и Prisma падает.
cd /home/z/my-project
if curl -s -m 4 -o /dev/null http://localhost:3000/; then
  echo "dev: already up"
  exit 0
fi
# Экспортируем .env ПОСТРОЧНО (не source!): в значениях есть & и % —
# bash-парсер рвёт строку по первому & и DATABASE_URL остаётся системным.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  key="${line%%=*}"
  val="${line#*=}"
  case "$val" in \"*\") val="${val#\"}" ; val="${val%\"}" ;; \'*\') val="${val#\'}" ; val="${val%\'}" ;; esac
  [ -n "$key" ] && export "$key=$val"
done < .env
# Selftest-режим (v8/v9): мок-эндпоинты Google/2328, если ещё не заданы.
# Без GOOGLE_TOKEN_URL exchange уйдёт на настоящий Google и google-сценарии
# selftest'ов упадут; GOOGLE_USERINFO_URL — то же самое (passport ходит за
# профилем отдельно от токена; без перекрытия — реальный www.googleapis.com).
export GOOGLE_TOKEN_URL="${GOOGLE_TOKEN_URL:-http://127.0.0.1:9998/token}"
export GOOGLE_USERINFO_URL="${GOOGLE_USERINFO_URL:-http://127.0.0.1:9998/userinfo}"
export TWOTHOUSAND328_API_BASE="${TWOTHOUSAND328_API_BASE:-http://127.0.0.1:9999/api}"
export TWOTHOUSAND328_PAYMENT_API_KEY="${TWOTHOUSAND328_PAYMENT_API_KEY:-test-payment-key}"
export TWOTHOUSAND328_PAYOUT_API_KEY="${TWOTHOUSAND328_PAYOUT_API_KEY:-test-payout-key}"
export TWOTHOUSAND328_PROJECT_UUID="${TWOTHOUSAND328_PROJECT_UUID:-test-project-uuid}"
setsid nohup npm run dev < /dev/null > dev.log 2>&1 &
for i in $(seq 1 40); do
  sleep 2
  if curl -s -m 4 -o /dev/null http://localhost:3000/; then
    echo "dev: up (waited $((i*2))s)"
    exit 0
  fi
done
echo "dev: FAILED to start"
tail -20 dev.log
exit 1
