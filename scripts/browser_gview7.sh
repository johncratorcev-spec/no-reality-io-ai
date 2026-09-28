#!/usr/bin/env bash
# v7 UI-пруф Google Sign-In: кнопка «G google» в шапке для гостя
# (без кошелька) + клик ведёт на consent-экран Google.
set -u
cd /home/z/my-project
export AGENT_BROWSER_SESSION="gview7-$(date +%s)"
OUT=tool-results
mkdir -p $OUT

# дев-сервер уже поднят (run(): :3000). Открываем главную гостем.
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 4
agent-browser wait --text "google" --timeout 15000 2>/dev/null || true

# 1. скрин шапки с кнопкой Google
agent-browser screenshot $OUT/g-btn-viewport.png >/dev/null 2>&1

# 2. полный скрин страницы
agent-browser screenshot --full-page $OUT/g-btn-full.png >/dev/null 2>&1

echo "--- snapshots ---"
ls -la $OUT/g-btn-*.png 2>/dev/null
