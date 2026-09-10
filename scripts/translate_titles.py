#!/usr/bin/env python3
"""Перевод русских заголовков постов в data/posts.csv на английский.

Заголовки — это видимые тексты приложения (статус-панель карточки).
По требованию «только английский» переводим их; оригинальные ссылки,
авторы, UTM и бусты не трогаем.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "posts.csv")

# utm_code -> английский перевод оригинального описания поста
TRANSLATIONS = {
    "rRAfCpxz": (
        "ChatGPT image 2 quality is honestly embarrassing... "
        "and it really shows in video"
    ),
    "Cd5kn7GN": (
        "a new AI trend is going viral on 🍋 — who wants a tutorial?"
    ),
    "iYIxY7qx": (
        "Fellow creators, I honestly don't get it — how do you do this? "
        "How do you write Seedance 2.5 prompts for 30 seconds and still get "
        "quality results. Even my 10-second generations fail without somet"
    ),
    "eFsxs2JD": (
        "I'm already tired of testing the new Seedance 2.5, it just won't "
        "stop 😂 and it's unlimited... what have you all generated? "
        "Share it in the comments ❤️"
    ),
    "Lu9rS6xV": (
        "never thought I'd ever say this, but… I just “filmed” a "
        "Hollywood-level action scene without leaving my home 💀 "
        "Seedance 2.5 😍"
    ),
    "ytJiU5XO": (
        "My Threads pretends I don't exist, but I'm posting this here "
        "anyway ) Decided to experiment and created Totti — a cute little "
        "octopus 🐙"
    ),
    "FR76WfCi": (
        "I'm a beginner AI creator and this is my first realistic clip ✨ "
        "I'd really appreciate some likes on this tricky but beautiful "
        "journey 🥰"
    ),
}


def main() -> None:
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    changed = 0
    for row in rows:
        code = (row.get("utm_code") or "").strip()
        if code in TRANSLATIONS:
            row["title"] = TRANSLATIONS[code]
            changed += 1

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"[titles] переведено {changed} заголовков (ожидалось {len(TRANSLATIONS)})")
    if changed != len(TRANSLATIONS):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
