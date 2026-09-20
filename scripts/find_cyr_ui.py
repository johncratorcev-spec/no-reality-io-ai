#!/usr/bin/env python3
"""Find user-visible Cyrillic strings (string literals) in src/, skipping comments."""
import re, pathlib, sys

SRC = pathlib.Path("/home/z/my-project/src")
OUT = pathlib.Path("/home/z/my-project/scripts/cyr_ui_report.txt")

# match Cyrillic inside single/double/backtick quotes on a single line
STR_RE = re.compile(r'''(["'`])((?:\\.|(?!\1).)*[А-Яа-яёЁ](?:\\.|(?!\1).)*)\1''')
LINE_COMMENT = re.compile(r'//.*[А-Яа-яёЁ]')
BLOCKISH = re.compile(r'^\s*(\*|/\*|\*/)')

rows = []
for p in sorted(SRC.rglob("*.ts*")):
    if "snapshot" in p.name:
        continue
    text = p.read_text(encoding="utf-8", errors="replace")
    for i, line in enumerate(text.splitlines(), 1):
        if len(line) > 600:
            continue
        s = line.strip()
        if BLOCKISH.match(s):      # block comment lines
            continue
        if LINE_COMMENT.search(line):
            line = LINE_COMMENT.sub('', line)
        for m in STR_RE.finditer(line):
            val = m.group(2)
            if re.search(r'[А-Яа-яёЁ]', val):
                rows.append(f"{p.relative_to(SRC.parent)}:{i}: {val[:180]}")

OUT.write_text("\n".join(rows), encoding="utf-8")
print(f"{len(rows)} user-visible cyrillic strings -> {OUT}")
for r in rows[:400]:
    print(r)
