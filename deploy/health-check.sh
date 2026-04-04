#!/bin/bash
# Watchdog for the RoadTrip Co-Pilot bot.
# Add to cron: */5 * * * * /opt/roadtrip/deploy/health-check.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROADTRIP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if any roadtrip tmux session exists
if tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -q '^session-'; then
  exit 0
fi

# Session is dead — log and restart
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "$ROADTRIP_DIR/agent/memory"
echo "[$TIMESTAMP] WATCHDOG_RESTART" >> "$ROADTRIP_DIR/agent/memory/audit.log"

echo "[$TIMESTAMP] RoadTrip bot session not found. Restarting..."
bash "$SCRIPT_DIR/start.sh"
