#!/usr/bin/env python3
"""
Задача: @popaistudio1 — #1, @the_fawkeskin — #2 в ленте.

Механика ранжирования (src/lib/posts.ts):
  1) бустнутые выше всех;
  2) среди бустнутых — свежий boost_until выше (tie-break);
  3) дальше по score.

Значит: popaistudio получает boost_until на час ПОЗЖЕ fawkeskin.
Оба буста продлеваются до 2026-09-11 (~36ч), чтобы порядок держался
даже после истечения старых окон (10.09 08:29Z / 15:43Z).

Скрипт точечно правит только колонку boost_until у двух строк,
сохраняя все остальные колонки и порядок файла (papaparse-совместимо).
"""
import csv
import sys
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "posts.csv")

# код -> новый boost_until (ISO 8601 UTC)
NEW_BOOST = {
    "AOABUGXd": "2026-09-11T08:00:00.000Z",  # @popaistudio1 — #1 (свежее)
    "wcDJIxC1": "2026-09-11T07:00:00.000Z",  # @the_fawkeskin — #2
}


def main() -> int:
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys())

    changed = 0
    for row in rows:
        code = (row.get("utm_code") or "").strip()
        if code in NEW_BOOST:
            old = (row.get("boost_until") or "").strip()
            row["boost_until"] = NEW_BOOST[code]
            print(f"  {code} ({row.get('author')}): {old or '—'} -> {NEW_BOOST[code]}")
            changed += 1

    if changed != len(NEW_BOOST):
        print(f"ОШИБКА: найдено {changed} из {len(NEW_BOOST)} кодов", file=sys.stderr)
        return 1

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"OK: обновлено {changed} строк, всего строк: {len(rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
