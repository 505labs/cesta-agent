#!/bin/bash
# Run RoadTrip Co-Pilot locally (no GCP, no session manager).
# Starts Claude Code agent + voice channel + orchestrator.
# Run ngrok separately: ngrok http 8080
#
# Usage: bash deploy/run-local.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_DIR="$ROOT_DIR/agent"
ORCHESTRATOR_DIR="$ROOT_DIR/orchestrator"

TMUX_SESSION="roadtrip-local"
VOICE_PORT="${VOICE_CHANNEL_PORT:-9000}"
ORCHESTRATOR_PORT="${ORCHESTRATOR_PORT:-8080}"

# --- Load .env ---
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
  echo "[+] Loaded .env"
fi

# Override for local: voice channel is on localhost
export VOICE_CHANNEL_URL="http://localhost:${VOICE_PORT}"
export VOICE_CHANNEL_PORT="$VOICE_PORT"

# --- Preflight checks ---
for cmd in claude bun tmux python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is not installed."
    exit 1
  fi
done

# --- Kill any previous local session ---
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  echo "[*] Killing previous tmux session '$TMUX_SESSION'..."
  tmux kill-session -t "$TMUX_SESSION"
fi

# Also kill any stale processes on our ports
lsof -ti :"$VOICE_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :"$ORCHESTRATOR_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true

# --- Start Claude Code + voice channel in tmux ---
echo "[+] Starting Claude Code agent with voice channel (tmux: $TMUX_SESSION)..."

tmux new-session -d -s "$TMUX_SESSION" -c "$AGENT_DIR" -- \
  claude \
    --dangerously-load-development-channels "server:voice-channel" \
    --dangerously-skip-permissions

# Wait for the dev-channels prompt and auto-accept
sleep 3
tmux send-keys -t "$TMUX_SESSION" Enter

# --- Wait for voice channel to come up ---
echo "[*] Waiting for voice channel on port $VOICE_PORT..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:${VOICE_PORT}/health" >/dev/null 2>&1; then
    echo "[+] Voice channel is healthy"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "[!] Voice channel did not start within 20s"
    echo "    Check: tmux attach -t $TMUX_SESSION"
    exit 1
  fi
  sleep 1
done

# --- Start orchestrator ---
echo "[+] Starting orchestrator on port $ORCHESTRATOR_PORT..."
cd "$ORCHESTRATOR_DIR"
python3 -m uvicorn main:app --host 0.0.0.0 --port "$ORCHESTRATOR_PORT" &
ORCH_PID=$!
echo "    PID: $ORCH_PID"

# Wait for orchestrator
for i in $(seq 1 10); do
  if curl -sf "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
    echo "[+] Orchestrator is healthy"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "[!] Orchestrator did not start within 10s"
    exit 1
  fi
  sleep 1
done

echo ""
echo "=========================================="
echo "  RoadTrip Co-Pilot is running locally!"
echo "=========================================="
echo ""
echo "  Orchestrator:  http://localhost:$ORCHESTRATOR_PORT"
echo "  Voice channel: http://localhost:$VOICE_PORT"
echo "  Claude session: tmux attach -t $TMUX_SESSION"
echo ""
echo "  For external access, run in another terminal:"
echo "    ngrok http $ORCHESTRATOR_PORT"
echo ""

# --- Cleanup on exit ---
cleanup() {
  echo ""
  echo "[*] Shutting down..."
  kill "$ORCH_PID" 2>/dev/null || true
  tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
  echo "[+] Done."
}
trap cleanup EXIT

# --- Keep running (wait for Ctrl-C) ---
echo "Press Ctrl-C to stop everything."
wait
