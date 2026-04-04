# MCP Servers

Custom MCP (Model Context Protocol) servers that give the Claude Code road trip agent its capabilities.

## Treasury MCP (`treasury/`)

Interacts with the GroupTreasury smart contract on Arc. Provides 8 tools for autonomous agent spending.

**Tools:**

| Tool | What it does |
|------|-------------|
| `treasury_balance` | Pool balance, per-member deposits, nanopayment total, daily spending |
| `treasury_spend` | Spend USDC from pool (under auto-limit, food/gas/lodging/activities) |
| `nanopayment_spend` | Micro-transaction for parking, tolls, fares, data fees |
| `x402_data_request` | Full x402 flow: request → 402 → pay → get data |
| `treasury_history` | All spending history with timestamps |
| `treasury_category_budgets` | Budget vs spent for all 7 categories |
| `group_vote_request` | Request group approval for over-limit spends |
| `group_vote_status` | Check vote approval count and threshold |

**Env vars:**
- `RPC_URL` — Chain RPC endpoint
- `TREASURY_ADDRESS` — Deployed contract address
- `AGENT_PRIVATE_KEY` — Agent wallet private key (for spending)
- `CHAIN_ID` — Chain ID (default: 31337 for local Anvil)
- `X402_SERVER_URL` — x402 mock server URL (default: `http://localhost:4402`)

## x402 Mock Server (`x402-mock/`)

Implements the HTTP 402 payment protocol. Runs on port 4402. The agent pays per-query for real trip data.

**Paid endpoints:**

| Endpoint | Price (USDC) | Data |
|----------|-------------|------|
| `GET /gas-prices` | $0.003 | Gas stations along route |
| `GET /restaurants` | $0.005 | Restaurant recommendations |
| `GET /weather` | $0.002 | Weather forecast |
| `GET /route-optimization` | $0.010 | Optimized route + waypoints |

Without an `X-PAYMENT` header, endpoints return HTTP 402 with payment requirements. The agent signs a payment, records it on-chain via `nanopayment()`, and retries with the header.

## Trip Memory MCP (`trip-memory/`)

Persists trip data to 0G decentralized storage (primary) with local JSON files as fallback when 0G is unavailable.

**Tools:**

| Tool | What it does |
|------|-------------|
| `save_trip_data` | Save JSON data under a key (preferences, itinerary, etc.) |
| `load_trip_data` | Retrieve saved data by key |
| `list_trip_keys` | List all saved keys for a trip |
| `save_trip_file` | Upload a file (photo, receipt) to 0G decentralized storage |
| `load_trip_file` | Download a file from 0G by root hash |
| `storage_status` | Check whether 0G or local fallback is active |

**Env vars:**
- `TRIP_MEMORY_DIR` — Local fallback data directory (default: `./trip-data`)
- `OG_STORAGE_ENABLED` — Enable 0G Storage (default: `true` — set to `false` to disable)
- `AGENT_PRIVATE_KEY` — Wallet key for signing 0G storage transactions
- `OG_RPC_URL` — 0G chain RPC (default: `https://evmrpc-testnet.0g.ai`)
- `OG_INDEXER_URL` — 0G indexer URL (default: `https://indexer-storage-testnet-turbo.0g.ai`)
- `OG_KV_NODE_URL` — 0G KV node URL (vestigial, kept for config compat)
- `OG_FLOW_CONTRACT` — 0G Flow contract address

## 0G Compute MCP (`0g-compute/`)

TEE-verified AI inference via the 0G Compute network. Requests are sealed inside a trusted execution environment.

**Tools:**

| Tool | What it does |
|------|-------------|
| `verified_evaluate` | Run inference in a TEE — returns result with verification proof |
| `list_providers` | List available TEE-verified compute providers |
| `compute_status` | Check if 0G Compute is available or in fallback mode |

Falls back to telling the agent to use its own reasoning when providers are unavailable.

## Usage with Claude Code

Configure in `.mcp.json` (see `agent/.mcp.json` for the full config):

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-google-maps"],
      "env": { "GOOGLE_MAPS_API_KEY": "..." }
    },
    "weather": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-weather"]
    },
    "treasury": {
      "command": "bun",
      "args": ["mcp-servers/treasury/index.ts"],
      "env": { "RPC_URL": "...", "TREASURY_ADDRESS": "...", "AGENT_PRIVATE_KEY": "...", "CHAIN_ID": "31337" }
    },
    "trip-memory": {
      "command": "bun",
      "args": ["mcp-servers/trip-memory/index.ts"],
      "env": { "AGENT_PRIVATE_KEY": "..." }
    },
    "0g-compute": {
      "command": "bun",
      "args": ["mcp-servers/0g-compute/index.ts"]
    }
  }
}
```
