# 0G Integration — RoadTrip Co-Pilot

## The Big Picture

Our app has two blockchains doing two different jobs:
- **Arc** = the wallet. Holds USDC, pays for things.
- **0G** = the brain. Stores memory, verifies decisions, owns the agent's identity.

The AI agent (Claude Code) sits in the middle with MCP tool servers connecting it to both chains. When someone says "find us lunch," Claude reasons about options, asks 0G Compute to verify its recommendation inside a hardware enclave, stores the trip state to 0G Storage, and pays from the Arc treasury.

```
                    Claude Code Agent (tmux)
                           |
              +------------+------------+
              |            |            |
         0G Storage   0G Compute   Arc Treasury
         (memory)    (verified AI)  (USDC payments)
              |            |            |
         0G Chain ----+    |     Arc Chain
         (identity,   |    |
          reputation)  +---+
```

## What's Deployed & Working

### Contracts on 0G Galileo Testnet (Chain ID: 16602)

| Contract | Address | What it does |
|----------|---------|--------------|
| **AgentNFT** | [`0x8adc...40ba`](https://chainscan-galileo.0g.ai/address/0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba) | ERC-7857 iNFT — the agent is a token. Token #0 minted. |
| **AgentReputation** | [`0xaf42...14a`](https://chainscan-galileo.0g.ai/address/0xaf421c7fad3a550a7da7478b05df9f6b0611c14a) | 1-5 star ratings per trip. Currently 4.50 avg from 2 ratings. |
| **TripRegistry** | [`0x2e9f...8d5`](https://chainscan-galileo.0g.ai/address/0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5) | Links trips to agent iNFTs and 0G Storage hashes. 2 trips registered. |

**Agent Wallet:** `0xabD736bB59DFA66a5a2ec92519142A6A37FC5805`

### 0G Storage (Trip Memory MCP)

Every piece of trip data gets uploaded to 0G's decentralized storage network as a content-addressed file. Upload returns a Merkle root hash — a permanent, verifiable pointer to that exact data across hundreds of storage nodes.

The MCP server wraps this as simple tools the agent calls naturally. Available tools: `save_trip_data`, `load_trip_data`, `list_trip_keys`, `save_trip_file`, `load_trip_file`, `storage_status`.

```
Agent: save_trip_data(trip_id=1, key="preferences", data={dietary: ["vegetarian"], budget: "moderate"})
  → Uploads JSON to 0G Storage
  → Returns root hash 0x9e8a33...
  → Also cached locally as fallback
  → Verifiable at storagescan-galileo.0g.ai
```

Falls back to local JSON files transparently when 0G is unavailable. Uses `@0gfoundation/0g-ts-sdk@1.2.1`.

### 0G Compute (Verified Inference MCP)

When the agent makes a spending recommendation, it routes the evaluation through 0G Compute — a GPU running whichever TEE-verified model the 0G Compute network provides (dynamically selected at runtime) inside a Trusted Execution Environment (hardware enclave). The response comes back cryptographically signed, proving the model actually produced that output untampered.

```
Agent: verified_evaluate("Compare: Station A $3.20 vs Station B $2.89")
  → Sent to 0G Compute provider (TEE-sealed GPU)
  → Response: "Station B is cheaper..." 
  → TEE Verified: true
  → Chat ID: chatcmpl-bff1f1b8... (on-chain proof)
```

Falls back to telling Claude to use its own reasoning when providers are down. Available tools: `verified_evaluate`, `list_providers`, `compute_status`. Uses `@0glabs/0g-serving-broker@0.7.4`.

### Frontend

Two minimal components on the trip dashboard:
- **AgentIdentity** — shows the iNFT card (name, token ID, rating, trip count)
- **ZeroGStatus** — shows connection status for Storage, Compute, and Chain

---

## How It Qualifies for 0G Tracks

### Track 1: Best OpenClaw Agent — $6,000

The bounty says "OpenClaw **or alternative Claw agents**." Claude Code is our alternative — a persistent AI agent with MCP tools, not a chat routing framework. We use every 0G component they asked for:

| They asked for | We built |
|----------------|----------|
| 0G Compute for inference | TEE-verified spending evaluations (proven working) |
| 0G Storage for memory | Trip data as content-addressed files (proven working) |
| 0G Chain for on-chain actions | 3 contracts deployed and live |
| iNFTs (ERC-7857) for agent identity | Token #0 minted, agent is an on-chain asset |

### Track 3: Wildcard — $3,000

Dual-chain architecture (finance on Arc + intelligence on 0G) with a voice-first interface. Doesn't fit agent-only or DeFi-only categories.

---

## Testing & Usage

### Run Tests (no tokens needed)

```bash
cd contracts && forge test -vv          # 76 Solidity tests
cd mcp-servers/trip-memory && bun test  # 8 tests
cd mcp-servers/0g-compute && bun test   # 4 tests
cd web && npm install && npx next build # frontend build check
```

### Verify Deployed Contracts

```bash
export RPC=https://evmrpc-testnet.0g.ai
export PK=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62

# Read agent iNFT
cast call 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba "getAgent(uint256)" 0 --rpc-url $RPC

# Read reputation (returns: avgRating, numRatings, numTrips)
cast call 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a "getAgentStats(uint256)" 0 --rpc-url $RPC

# Read trip registry
cast call 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 "getTrip(uint256)" 0 --rpc-url $RPC
```

### Write to Contracts

All writes on 0G Galileo need `--legacy --gas-price 4000000000`:

```bash
# Mint another agent
cast send 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba \
  "mintAgent(string,string,string)" "My Agent" "0g://meta" "0g://desc" \
  --rpc-url $RPC --private-key $PK --legacy --gas-price 4000000000

# Register a trip
cast send 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 \
  "registerTrip(uint256,string)" 0 "trip:42" \
  --rpc-url $RPC --private-key $PK --legacy --gas-price 4000000000

# Rate an agent (1-5)
cast send 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a \
  "rateAgent(uint256,uint256,uint8,string)" 0 42 5 "Great trip!" \
  --rpc-url $RPC --private-key $PK --legacy --gas-price 4000000000
```

### Test 0G Storage (upload + download round-trip)

```bash
cd mcp-servers/trip-memory
# OG_STORAGE_ENABLED defaults to true (opt-out via =false), so setting =true is redundant but explicit
AGENT_PRIVATE_KEY=$PK OG_STORAGE_ENABLED=true bun -e '
import { ZeroGStorage } from "./storage-0g.ts";
const s = new ZeroGStorage({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  kvNodeUrl: "", flowContractAddress: "",  // vestigial — kept for config compat, not used by current SDK
});
await s.initialize();
const res = await s.kvSet(1, "test", { hello: "world" });
console.log("Uploaded:", res.rootHash);
const data = await s.kvGet(1, "test");
console.log("Downloaded:", JSON.stringify(data));
process.exit(0);
'
```

### Test 0G Compute (TEE-verified inference)

```bash
cd mcp-servers/0g-compute

# One-time setup (needs >= 3 0G in wallet)
AGENT_PRIVATE_KEY=$PK bun setup.ts

# Setup + fire a test inference
AGENT_PRIVATE_KEY=$PK bun setup.ts --test

# Run the MCP server
AGENT_PRIVATE_KEY=$PK OG_COMPUTE_ENABLED=true bun index.ts
```

### Run the Frontend

```bash
cd web && npm run dev
# Visit http://localhost:3000/trip/0
# AgentIdentity and ZeroGStatus panels visible in right column
```

---

## File Map

```
contracts/src/
  AgentNFT.sol            # ERC-7857 iNFT — agent as on-chain token
  AgentReputation.sol     # Star ratings tied to iNFT token IDs
  TripRegistry.sol        # Trip lifecycle linked to agent + 0G Storage
contracts/script/
  Deploy0G.s.sol          # Deploy all 3 to Galileo
  MintAgent.s.sol         # Mint agent iNFT

mcp-servers/trip-memory/
  index.ts                # MCP server: save/load trip data
  storage-0g.ts           # 0G Storage SDK wrapper (upload/download files)
mcp-servers/0g-compute/
  index.ts                # MCP server: verified_evaluate tool
  compute-0g.ts           # 0G Compute broker wrapper
  setup.ts                # One-time ledger + provider funding script

web/src/components/
  AgentIdentity.tsx       # iNFT card (name, rating, trips)
  ZeroGStatus.tsx         # Storage/Compute/Chain status indicators
```

## Testnet Reference

| | |
|---|---|
| Chain ID | `16602` |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Storage Explorer | `https://storagescan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` |
