#!/bin/bash
# v26 — извлечение медиа из 9 новых Threads-ссылок (методика v23_refresh_11):
# открываем пост, ждём гидрацию, тянем <video> src / фото-карусель / автора / подпись.
AB=/home/z/.bun/install/global/node_modules/agent-browser/bin/agent-browser-linux-x64
OUT=/tmp/v26_extract
mkdir -p $OUT

LINKS=(
  "BAFlXcFGIM"
  "BACRfexmcs"
  "BAOae9mS6I"
  "BAcXZq7jFB"
  "_paRxlBpt"
  "BApb_G708_"
  "BAZTVfLNoA"
  "_6gx0GNBq"
  "BCMC1ZQX-H"
)

for id in "${LINKS[@]}"; do
  echo "=== $id ==="
  $AB open "https://www.threads.com/share/$id/" >/dev/null 2>&1
  $AB wait --load networkidle >/dev/null 2>&1
  sleep 5
  # поллинг появления <video> до 25с
  for i in 1 2 3 4 5; do
    RAW=$($AB eval '(() => {
      const vids = Array.from(document.querySelectorAll("video")).map(v => v.src || (v.querySelector("source") && v.querySelector("source").src)).filter(Boolean);
      const imgs = Array.from(document.querySelectorAll("img")).map(i => i.src).filter(s => s.includes("cdninstagram") || s.includes("fbcdn"));
      const author = (document.querySelector('[data-username]')||{}).dataset?.username || "";
      const tEl = document.querySelector("title");
      return JSON.stringify({vids: vids.slice(0,4), imgs: imgs.slice(0,6), title: tEl ? tEl.textContent : "", url: location.href});
    })()' 2>/dev/null)
    # CLI печатает JSON-строку В кавычках — снимаем обёртку
    CLEAN=$(echo "$RAW" | sed 's/^"//; s/"$//; s/\\"/"/g; s/\\\\/\\/g')
    echo "$CLEAN" > "$OUT/$id.json"
    HASV=$(echo "$CLEAN" | rg -c '"vids":\["https' 2>/dev/null || true)
    HASI=$(echo "$CLEAN" | rg -c 'cdninstagram|fbcdn' 2>/dev/null || true)
    if [ "$HASV" != "0" ] || [ "$HASI" != "0" ]; then echo "  → медиа найдено (попытка $i)"; break; fi
    sleep 5
  done
  # скрин для классификации (кадр)
  $AB screenshot "$OUT/$id.png" >/dev/null 2>&1
  echo "  → сохранено $OUT/$id.json"
done
echo "DONE"
