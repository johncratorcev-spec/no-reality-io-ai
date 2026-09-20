#!/usr/bin/env python3
"""Дедуп data/posts.csv (task 42, пункт 5).

Дубликаты = одинаковый автор + одинаковый нормализованный заголовок
(репост того же ролика другим постом Threads). Приоритет сохранения:
  1) запиненные (меньший номер пина выше);
  2) с бейджем;
  3) раньше в CSV.
Также страховка от точных дублей video_url.
"""
import csv
import sys

CSV = "data/posts.csv"

def norm(s: str) -> str:
    return (s or "").strip().lower()

def priority(row, idx):
    pin = int(row["pin"]) if (row.get("pin") or "").strip().isdigit() else 999
    badge = 1 if (row.get("badge") or "").strip() else 0
    return (0 if pin < 900 else 1, pin if pin < 900 else 0, -badge, idx)

def main():
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    print("rows before:", len(rows))

    seen_author_title = {}
    seen_video = {}
    drop = set()
    for i, r in enumerate(rows):
        key = (norm(r["author"]), norm(r["title"]))
        vu = norm(r["video_url"])
        if vu and vu in seen_video:
            drop.add(i)
            print(f"drop #{i} {r['utm_code']} (video_url dup of {seen_video[vu]})")
            continue
        if key[1] and key in seen_author_title:
            keep_idx = seen_author_title[key]
            keep, cur = rows[keep_idx], r
            # заменяем keep, если текущий «приоритетнее»
            if priority(cur, i) < priority(keep, keep_idx):
                drop.add(keep_idx)
                print(f"drop #{keep_idx} {keep['utm_code']} (author+title dup, worse slot) -> keep {r['utm_code']}")
                seen_author_title[key] = i
            else:
                drop.add(i)
                print(f"drop #{i} {r['utm_code']} (author+title dup of {keep['utm_code']})")
            continue
        if vu:
            seen_video[vu] = r["utm_code"]
        if key[1]:
            seen_author_title[key] = i

    if not drop:
        print("nothing to drop")
        return

    keep_rows = [r for i, r in enumerate(rows) if i not in drop]
    fields = list(rows[0].keys())
    with open(CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(keep_rows)
    print("rows after:", len(keep_rows))
    dropped_codes = sorted(rows[i]["utm_code"] for i in drop)
    print("dropped:", dropped_codes)

if __name__ == "__main__":
    sys.exit(main())
