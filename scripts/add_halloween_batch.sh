#!/usr/bin/env bash
# v18: пакетная вставка 7 Halloween-клипов из манифеста halloween_batch_v18.json.
# "videoUrl": "FROM_FILE:<path>" — URL читается из файла (CDN-ссылки длинные).
# Требует доступ: SUPABASE_URL+SERVICE_ROLE_KEY или DIRECT_URL в .env.
# Запуск:  bash scripts/add_halloween_batch.sh          # вставка
#          bash scripts/add_halloween_batch.sh --dry    # валидация без записи
set -u
MODE="${1:-}"
export DRY_FLAG=""; [ "$MODE" = "--dry" ] && DRY_FLAG="--dry"
DRY_FLAG="$DRY_FLAG" python3 - <<'PY' > /tmp/halloween/batch_cmds.sh
import json, os
# приоритет — resolved-манифест (CDN-ссылки уже подставлены)
import os.path
p = "/home/z/my-project/scripts/halloween_batch_v18_resolved.json"
if not os.path.exists(p):
    p = "/home/z/my-project/scripts/halloween_batch_v18.json"
m = json.load(open(p))
dry = " --dry" if os.environ.get("DRY_FLAG", "").strip() else ""
print("#!/usr/bin/env bash")
print("set -e")
print('cd /home/z/my-project')
for c in m["clips"]:
    v = c["videoUrl"]
    if v.startswith("FROM_FILE:"):
        v = open(v.split("FROM_FILE:",1)[1]).read().strip()
    assert v.startswith("https://"), f"bad videoUrl for {c['author']}"
    print(" ".join([
        'node scripts/add_raffle_clip.mjs',
        f'--source "{c["sourceUrl"]}"',
        f'--video "{v}"',
        f'--label {c["label"]}',
        f'--badge {c["badge"]}',
        f'--caption "{c["caption"]}"',
        f'--author "{c["author"]}"',
        '--listed-by bd',
        '--featured-days 7' + dry,
    ]))
PY
bash /tmp/halloween/batch_cmds.sh
