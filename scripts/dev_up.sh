#!/bin/bash
# Гарантирует живой дев-сервер: проверяет :3000, при отсутствии — поднимает и ждёт Ready.
cd /home/z/my-project
if curl -s -m 4 -o /dev/null http://localhost:3000/; then
  echo "dev: already up"
  exit 0
fi
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
