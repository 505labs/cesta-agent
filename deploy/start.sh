#!/bin/bash
# Launch RoadTrip Co-Pilot bot via the session manager
# Usage: bash deploy/start.sh
#
# Requires:
#   - tmux installed
#   - Claude Code CLI installed
#   - Session manager running on localhost:9001

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROADTRIP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_DIR="${ROADTRIP_AGENT_DIR:-$ROADTRIP_DIR/agent}"

# --- Load .env so MCP servers get env vars ---
if [ -f "$ROADTRIP_DIR/.env" ]; then
  set -a
  source "$ROADTRIP_DIR/.env"
  set +a
  echo "Loaded environment from $ROADTRIP_DIR/.env"
fi

# --- Verify prerequisites ---
if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is not installed."
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude CLI is not installed."
  exit 1
fi

# --- Check voice channel directory ---
VOICE_CHANNEL_DIR="${VOICE_CHANNEL_DIR:-$ROADTRIP_DIR/voice-channel}"
if [ ! -f "$VOICE_CHANNEL_DIR/.mcp.json" ]; then
  echo "Warning: Voice channel not found at $VOICE_CHANNEL_DIR"
  echo "Voice commands will not work."
fi

# --- Ensure session manager is running ---
if ! curl -sf localhost:9001/health >/dev/null 2>&1; then
  echo "Error: Session manager is not running on localhost:9001."
  echo "Start it before running this script."
  exit 1
fi

# --- Start tee-server (local dev — move to TEE for production) ---
TEE_SERVER_DIR="${ROADTRIP_DIR}/tee-server"
if [ -d "$TEE_SERVER_DIR" ]; then
  echo "Starting tee-server..."
  if ! curl -sf localhost:3000/health >/dev/null 2>&1; then
    (cd "$TEE_SERVER_DIR" && npm run dev > /tmp/tee-server.log 2>&1 &)
    # Wait up to 10s for tee-server to become ready
    for i in $(seq 1 10); do
      sleep 1
      if curl -sf localhost:3000/health >/dev/null 2>&1; then
        echo "tee-server ready on port 3000"
        break
      fi
      if [ "$i" -eq 10 ]; then
        echo "Warning: tee-server did not start within 10s (check /tmp/tee-server.log)"
      fi
    done
  else
    echo "tee-server already running on port 3000"
  fi
else
  echo "Warning: tee-server not found at $TEE_SERVER_DIR — card issuance will not work"
fi

# --- Set voice channel port (avoid conflict with superapp on 9000) ---
export VOICE_CHANNEL_PORT="${VOICE_CHANNEL_PORT:-9002}"
echo "Using voice channel port: $VOICE_CHANNEL_PORT"

# --- Create the roadtrip session (409 = already exists, OK) ---
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST localhost:9001/sessions \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"roadtrip\",\"working_dir\":\"$AGENT_DIR\"}")

if [ "$HTTP_STATUS" != "200" ] && [ "$HTTP_STATUS" != "201" ] && [ "$HTTP_STATUS" != "409" ]; then
  echo "Error: Failed to create session (HTTP $HTTP_STATUS)."
  exit 1
fi

# --- Look up the roadtrip session ID ---
SESSIONS_JSON=$(curl -sf localhost:9001/sessions)
SESSION_ID=$(python3 -c "
import json, sys
sessions = json.loads('''$SESSIONS_JSON''')
match = next((s for s in sessions if s.get('name') == 'roadtrip'), None)
if match:
    print(match['id'])
else:
    sys.exit(1)
" 2>/dev/null) || {
  echo "Error: Could not find a session named 'roadtrip' in session manager."
  exit 1
}

echo "Using session ID: $SESSION_ID"

# --- Activate the session ---
if ! curl -sf -X POST "localhost:9001/sessions/${SESSION_ID}/activate" >/dev/null; then
  echo "Error: Failed to activate session $SESSION_ID."
  exit 1
fi

# --- Accept the --dangerously-skip-permissions risk prompt ---
sleep 1
tmux send-keys -t "session-${SESSION_ID}" Enter

echo "RoadTrip bot started via session manager (session id=$SESSION_ID)."
echo "  Attach:  tmux attach -t session-${SESSION_ID}"
echo "  Detach:  Ctrl+B then D"
echo "  Stop:    curl -X POST localhost:9001/sessions/${SESSION_ID}/stop"
echo "  Voice channel health: curl localhost:${VOICE_CHANNEL_PORT}/health"
