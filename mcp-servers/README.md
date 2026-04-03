# MCP Servers

Custom MCP (Model Context Protocol) servers that give the Claude Code road trip agent its capabilities.

## Treasury MCP (`treasury/`)
Interacts with the GroupTreasury smart contract on Arc. Tools: `treasury_balance`, `treasury_spend`, `treasury_history`.

**Env vars:**
- `RPC_URL` — Chain RPC endpoint
- `TREASURY_ADDRESS` — Deployed contract address
- `AGENT_PRIVATE_KEY` — Agent wallet private key (for spending)
- `CHAIN_ID` — Chain ID (default: 31337 for local Anvil)

## Trip Memory MCP (`trip-memory/`)
Persists trip data (preferences, itinerary, notes) to local JSON files with optional 0G Storage upload.

**Env vars:**
- `TRIP_MEMORY_DIR` — Data directory (default: `./trip-data`)

## Usage with Claude Code
Configure in `.mcp.json`:
```json
{
  "mcpServers": {
    "treasury": {
      "command": "bun",
      "args": ["mcp-servers/treasury/index.ts"],
      "env": { "RPC_URL": "...", "TREASURY_ADDRESS": "...", "AGENT_PRIVATE_KEY": "..." }
    },
    "trip-memory": {
      "command": "bun",
      "args": ["mcp-servers/trip-memory/index.ts"]
    }
  }
}
```
