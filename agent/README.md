# Agent Config

Claude Code configuration for the RoadTrip Co-Pilot agent.

## Files

- `CLAUDE.md` — Agent persona, behavior rules, tool descriptions, voice response style
- `.mcp.json` — MCP server configuration (google-maps, weather, treasury, trip-memory)

## Setup

1. Set environment variables:
   ```bash
   export GOOGLE_MAPS_API_KEY=your-key
   export RPC_URL=http://127.0.0.1:8545          # or Arc testnet RPC
   export TREASURY_ADDRESS=0x...                   # deployed GroupTreasury
   export AGENT_PRIVATE_KEY=0x...                  # agent wallet private key
   export CHAIN_ID=31337                           # or Arc testnet chain ID
   export TRIP_MEMORY_DIR=./trip-data
   ```

2. Start Claude Code in this directory with voice-channel loaded:
   ```bash
   cd agent
   claude --dangerously-load-development-channels server:../voice-channel
   ```

3. The agent will have access to all MCP tools defined in `.mcp.json`.
