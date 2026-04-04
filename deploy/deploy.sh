#!/bin/bash
# Redeploy RoadTrip Co-Pilot: git pull + install deps.
# Run this on the VM (called by `make deploy`).

set -euo pipefail

ROADTRIP_DIR="/opt/roadtrip"
export PATH="$HOME/.bun/bin:$PATH"

cd "$ROADTRIP_DIR"

echo "=== Pulling latest code ==="
git pull --ff-only

echo "=== Installing voice-channel deps ==="
cd "$ROADTRIP_DIR/voice-channel" && bun install --no-summary

echo "=== Installing MCP server deps ==="
for d in "$ROADTRIP_DIR"/mcp-servers/*/; do
  [ -f "$d/package.json" ] && (cd "$d" && bun install --no-summary)
done

echo "=== Making scripts executable ==="
chmod +x "$ROADTRIP_DIR"/deploy/*.sh "$ROADTRIP_DIR"/agent/.claude/hooks/*.sh 2>/dev/null || true

echo "=== Deploy complete ==="
echo "Run 'bash $ROADTRIP_DIR/deploy/start.sh' to start/restart the bot."
