#!/usr/bin/env bash
# Lance (ou relance) le backend du dashboard Mav en arrière-plan.
# Pensé pour être appelé par cron (watchdog chaque minute).
set -euo pipefail

APP_DIR="/home/opencode/workspace/mav-dashboard"
VENV_PY="/home/opencode/bot/venv/bin/python"
LOG="/home/opencode/bot/mav-api.log"
PIDFILE="/home/opencode/bot/mav-api.pid"

export MAV_STATIC="$APP_DIR"
export BOT_DIR="/home/opencode/bot"
export OPENCODE_URL="http://127.0.0.1:4096"
export MAV_API_PORT="8787"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  exit 0
fi

# Nettoie un éventuel process orphelin
pkill -f "mav_api.py" 2>/dev/null || true
sleep 1

cd "$APP_DIR"
setsid "$VENV_PY" server/mav_api.py >> "$LOG" 2>&1 < /dev/null &
echo $! > "$PIDFILE"
