#!/usr/bin/env python3
# v2 Phase 0: колонки truth (real|synth) + mood (swag|creepy|future|ufo) в posts.csv.
# truth — кураторский вердикт (для резолва ставок REAL/SYNTH). Пусто = клип вне
# ставок (панель скрыта), пока куратор не разметит через админ-очередь (Phase 2).
# Mood — косметика (фильтр/акцент), можно править безболезненно.
import csv, io

PATH = "/home/z/my-project/data/posts.csv"

# кураторская разметка (best-effort по метаданным; админ-очередь уточнит)
TRUTH = {
    # REAL — настоящееlive-съёмка (аккаунт партнёра = реальные коты;实录-стилистика)
    "71vsIPUu": "real",   # pawcrewdaily — реальные коты (партнёр недели)
    "TK4_0wTI": "real",   # pawcrewdaily — коты (пилот)
    "j0o8-Wwe": "real",   # «somebody’s uncle» — живая камера
    "J9tQLqnH": "real",   # Have_it — реальная съёмка
    "QAJ4DRds": "real",   # the_siberian — archival-стилистика
    "K2Cyj240": "real",   # Showa-era — архивная плёнка
}

MOOD = {
    "71vsIPUu": "swag", "TK4_0wTI": "swag",
    "zXMNjL2F": "creepy", "ALdCmvh7": "creepy", "xUAgSLzz": "creepy",
    "I4z2q24Z": "creepy", "y3ZH8wdt": "creepy",
    "wcDJIxC1": "future", "r1PfYkmW": "future", "NzUdliRV": "future",
    "EJszWHvA": "future", "ga9l9UEc": "future", "LR7j5-V8": "future",
    "AOABUGXd": "future", "MehFNQyX": "swag", "Cd5kn7GN": "swag",
    "Wi-5HoqV": "swag", "GQtfbzIZ": "swag", "FR76WfCi": "swag",
    "UkoN8r2X": "swag", "Lu9rS6xV": "swag", "eFsxs2JD": "swag",
    "iYIxY7qx": "swag", "e91lKDa0": "swag", "63GLQu_Z": "future",
    "EwNwx4oG": "swag", "76JKeMPf": "creepy", "dA64-UFH": "creepy",
    "mr42EPRm": "creepy", "-bBc5Nno": "creepy", "H8N865zj": "creepy",
    "hMKB_IqJ": "creepy", "vM_DQv1q": "creepy", "QPu6TzrX": "creepy",
    "lwslgtNH": "swag", "KKiWBRka": "swag", "ytJiU5XO": "swag",
    "rRAfCpxz": "swag", "j0o8-Wwe": "creepy", "J9tQLqnH": "creepy",
    "ZznHA9HM": "ufo", "2m0nwLwF": "ufo", "QAJ4DRds": "creepy",
    "K2Cyj240": "creepy", "j59dA1Ld": "creepy",
}

with open(PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())

if "truth" not in fieldnames:
    fieldnames += ["truth", "mood"]

for r in rows:
    code = r.get("utm_code", "").strip()
    r["truth"] = TRUTH.get(code, "synth" if code in MOOD else "")
    r["mood"] = MOOD.get(code, "")

buf = io.StringIO()
w = csv.DictWriter(buf, fieldnames=fieldnames, lineterminator="\n")
w.writeheader()
w.writerows(rows)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(buf.getvalue())

real = sum(1 for r in rows if r["truth"] == "real")
synth = sum(1 for r in rows if r["truth"] == "synth")
unmarked = sum(1 for r in rows if not r["truth"])
print(f"rows={len(rows)} real={real} synth={synth} unmarked={unmarked} real_ratio={real/max(1,real+synth):.2f}")
