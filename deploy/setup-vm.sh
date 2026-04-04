#!/bin/bash
# First-time setup for RoadTrip Co-Pilot on superapp-core VM.
# Clones the repo and installs dependencies.

set -euo pipefail

ROADTRIP_DIR="/opt/roadtrip"
REPO_URL="${ROADTRIP_REPO:?Set ROADTRIP_REPO env var (e.g. git@github.com:org/repo.git)}"

echo "=== RoadTrip Co-Pilot VM Setup ==="

# --- Install bun if not present ---
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  echo "Installing bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# --- Clone the repo ---
if [ -d "$ROADTRIP_DIR/.git" ]; then
  echo "Repo already cloned. Pulling latest..."
  cd "$ROADTRIP_DIR" && git pull --ff-only
else
  echo "Cloning $REPO_URL to $ROADTRIP_DIR..."
  sudo mkdir -p "$(dirname "$ROADTRIP_DIR")"
  sudo chown "$(whoami)" "$(dirname "$ROADTRIP_DIR")"
  git clone "$REPO_URL" "$ROADTRIP_DIR"
fi

# --- Create data directories (not in repo) ---
mkdir -p "$ROADTRIP_DIR/data/trip-memory"

# --- Install voice-channel dependencies ---
if [ -f "$ROADTRIP_DIR/voice-channel/package.json" ]; then
  echo "Installing voice-channel dependencies..."
  cd "$ROADTRIP_DIR/voice-channel" && bun install
fi

# --- Install MCP server dependencies ---
for server_dir in "$ROADTRIP_DIR"/mcp-servers/*/; do
  if [ -f "$server_dir/package.json" ]; then
    echo "Installing deps for $(basename "$server_dir")..."
    cd "$server_dir" && bun install
  fi
done

# --- Make scripts executable ---
chmod +x "$ROADTRIP_DIR"/deploy/*.sh "$ROADTRIP_DIR"/agent/.claude/hooks/*.sh 2>/dev/null || true

# --- Set up cron watchdog ---
CRON_LINE="*/5 * * * * bash $ROADTRIP_DIR/deploy/health-check.sh >> /var/log/roadtrip-watchdog.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "roadtrip"; then
  echo "Adding watchdog to crontab..."
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
fi

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Create $ROADTRIP_DIR/.env with required env vars (see deploy/.env.example)"
echo "  2. Run: bash $ROADTRIP_DIR/deploy/start.sh"
