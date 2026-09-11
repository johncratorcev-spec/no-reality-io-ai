#!/usr/bin/env python3
"""Очистка после теста панели: удаляет тестовую строку из CSV + снапшот."""
import csv

CSV = "/home/z/my-project/data/posts.csv"
rows = list(csv.reader(open(CSV, newline="", encoding="utf-8")))
kept = [rows[0]] + [r for r in rows[1:] if "TESTPANEL1" not in r[0]]
with open(CSV, "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(kept)
print("строк осталось:", len(kept) - 1)
