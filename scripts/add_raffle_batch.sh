#!/usr/bin/env bash
# v16: пакетная вставка 4 раффлов из манифеста raffle_batch_v16.json.
# Требует один из доступов: SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY или DIRECT_URL (пароль БД) в .env.
# Запуск:  bash scripts/add_raffle_batch.sh          # вставка
#          bash scripts/add_raffle_batch.sh --dry    # валидация без записи
set -u
MODE="${1:-}"
DRY_FLAG=""; [ "$MODE" = "--dry" ] && DRY_FLAG="--dry"
DRY_FLAG="$DRY_FLAG" python3 - <<'PY' > /tmp/raffle/batch_cmds.sh
import json, os
m = json.load(open("/home/z/my-project/scripts/raffle_batch_v16.json"))
dry = " --dry" if os.environ.get("DRY_FLAG", "").strip() else ""
print("#!/usr/bin/env bash")
print("set -e")
print('cd /home/z/my-project')
for c in m["clips"]:
    if not c.get("videoUrl"):
        print(f'# SKIP {c["badge"]}: {c["status"][:60]}')
        continue
    print(" ".join([
        'node scripts/add_raffle_clip.mjs',
        f'--source "{c["sourceUrl"]}"',
        f'--video "{c["videoUrl"]}"',
        f'--label {c["label"]}',
        f'--badge {c["badge"]}',
        f'--caption "{c["caption"]}"',
        f'--author "{c["author"]}"',
        '--listed-by bd',
        '--featured-days 7' + dry,
    ]))
PY
bash /tmp/raffle/batch_cmds.sh
