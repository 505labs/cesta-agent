# 0G Integration — RoadTrip Co-Pilot

## Deployed Contract Addresses (0G Galileo Testnet, Chain ID: 16602)

| Contract | Address | Explorer |
|----------|---------|----------|
| **AgentNFT** | `0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba` | [View](https://chainscan-galileo.0g.ai/address/0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba) |
| **AgentReputation** | `0xaf421c7fad3a550a7da7478b05df9f6b0611c14a` | [View](https://chainscan-galileo.0g.ai/address/0xaf421c7fad3a550a7da7478b05df9f6b0611c14a) |
| **TripRegistry** | `0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5` | [View](https://chainscan-galileo.0g.ai/address/0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5) |

**Agent Wallet:** `0xabD736bB59DFA66a5a2ec92519142A6A37FC5805`

---

## What We've Implemented

### 1. Smart Contracts on 0G Chain (Galileo Testnet)

**AgentNFT.sol** — Simplified ERC-7857 iNFT for AI Agent Identity
- Mints AI agents as NFTs with encrypted metadata stored on 0G Storage
- Each token stores: agent name, metadata URI (0G Storage root hash), description URI, creator address
- Supports transfer with metadata preservation — new owners can re-encrypt metadata
- Declares ERC-7857 interface support via ERC-165
- 12 Foundry tests

**AgentReputation.sol** — On-chain Reputation System
- Trip members rate agents 1-5 after trips with text comments
- Prevents double-rating (same rater, same trip)
- Tracks aggregate stats: total score, total ratings, total trips
- `getAverageRating()` returns score scaled to 2 decimal places (e.g., 450 = 4.50)
- `getAgentStats()` returns all stats in a single call
- 14 Foundry tests

**TripRegistry.sol** — Trip Lifecycle Registry
- Links each trip to: agent iNFT token ID, organizer, 0G Storage stream ID
- Records trip creation, itinerary updates (hash of itinerary on 0G Storage), and trip completion
- Tracks all trips per agent for reputation/history lookups
- Only organizer can update itinerary or end trip
- 14 Foundry tests

### 2. 0G Storage — Trip Memory MCP Server (v2.0)

The `mcp-servers/trip-memory` MCP server was rewritten to use 0G decentralized storage as the primary backend with local filesystem as graceful fallback.

**How it works:**
- **KV Store** (`@0glabs/0g-ts-sdk`): Structured trip data (preferences, itinerary, spending state, conversation history) stored as key-value pairs in 0G's decentralized KV store. Each trip gets a deterministic stream ID derived from `keccak256("roadtrip-copilot:trip:{tripId}")`.
- **File Storage**: Trip artifacts (photos, receipts, reports) uploaded to 0G's content-addressed file storage, returning a permanent root hash.
- **Local Fallback**: When 0G is unavailable (no tokens, network down), all operations transparently fall back to local JSON files. Data is always cached locally regardless.

**MCP Tools:**
| Tool | Description |
|------|-------------|
| `save_trip_data` | Write structured data to 0G KV store (or local) |
| `load_trip_data` | Read structured data from 0G KV store (or local) |
| `list_trip_keys` | List all saved data keys for a trip |
| `save_trip_file` | Upload a file to 0G decentralized storage |
| `load_trip_file` | Download a file by 0G root hash |
| `storage_status` | Check connection mode (0g/local) |

### 3. 0G Compute — Verified Inference MCP Server

New `mcp-servers/0g-compute` MCP server provides TEE-verified AI inference via 0G Compute Network.

**How it works:**
- Uses `@0glabs/0g-serving-broker` to connect to 0G Compute providers running models inside Trusted Execution Environments (Intel TDX + NVIDIA H100/H200 in TEE mode)
- Auto-discovers the best available chatbot provider
- Every inference response is cryptographically signed by the TEE enclave
- Response verification via `processResponse()` confirms: the specific model processed the query, input was not tampered with, output was not modified
- Graceful fallback when no providers are available — returns a message telling the agent to use its own reasoning

**MCP Tools:**
| Tool | Description |
|------|-------------|
| `verified_evaluate` | Run TEE-verified inference for spending decisions |
| `list_providers` | List available 0G Compute providers and models |
| `compute_status` | Check connection mode (0g/fallback) |

### 4. Frontend Components

**ZeroGStatus** — Shows real-time 0G infrastructure connection status (Storage, Compute, Chain) with animated status indicators.

**AgentIdentity** — Displays the agent's iNFT identity card: name, token ID, reputation stats (average rating, number of reviews, trips completed). Reads directly from the deployed AgentNFT and AgentReputation contracts.

Both are integrated into the trip dashboard page right column.

---

## What Still Needs to Be Implemented

### Must-Do Before Submission
1. **Mint the agent as an iNFT** — Upload character.json and description to 0G Storage, then call `mintAgent()` on the AgentNFT contract. Script ready: `contracts/script/MintAgent.s.sol`.
2. **Fund the agent wallet** with enough 0G tokens for Storage writes and Compute inference (minimum ~5 0G for all operations).
3. **Test 0G Storage end-to-end** — With funded wallet, verify KV write/read cycle on testnet.
4. **Set .env vars** — Update `web/.env.example` values with deployed contract addresses.

### Should-Do (Strengthens Bounty Case)
5. **0G Compute demo** — Show a live verified inference call for a spending recommendation. Requires: ledger creation (3 0G), provider acknowledgement, fund transfer to provider sub-account (1 0G).
6. **Register a trip on TripRegistry** — After creating a trip on the treasury, also register it on 0G Chain with the agent's iNFT token ID.
7. **Agent reputation demo** — After a trip ends, show members rating the agent and the on-chain stats updating.

### Nice-to-Have (Wow Factor)
8. **Cross-session memory demo** — Kill the agent, restart it, show it loading state from 0G Storage.
9. **Store inference receipts** — After each verified_evaluate call, store the signed result to 0G Storage as a receipt.
10. **Demo video** — 3-minute video showing the full flow: mint agent, create trip, voice interaction, verified spend, check reputation.

---

## How This Qualifies for 0G Sponsor Tracks

### Track 1: Best OpenClaw Agent on 0G — $6,000 (PRIMARY TARGET)

> "Build applications integrating OpenClaw or **alternative Claw agents** with 0G's decentralized infrastructure."

**Why we qualify:**

| Requirement | Our Implementation |
|-------------|--------------------|
| Agent framework | Claude Code as "alternative Claw agent" — a persistent AI agent running in tmux with MCP tool servers. Superior reasoning to OpenClaw's routing-layer approach. |
| 0G Storage for memory | Trip Memory MCP uses 0G KV Store for structured trip state and 0G File Storage for artifacts. The agent's persistent brain. |
| 0G Compute for inference | Verified Evaluate MCP routes spending decisions through TEE-sealed inference. Cryptographically proves AI recommendations are genuine. |
| 0G Chain for on-chain actions | AgentNFT (ERC-7857), AgentReputation, and TripRegistry contracts deployed on Galileo. |
| iNFT for agent ownership | Agent identity minted as ERC-7857 iNFT with encrypted metadata on 0G Storage. |

**The pitch:** "We gave a car a wallet AND a brain. The wallet lives on Arc (USDC treasury). The brain lives on 0G (persistent memory, verifiable reasoning, tokenized identity). Claude Code is our agent framework — it reasons about budgets, navigates routes, and makes autonomous spending decisions. Every recommendation is TEE-verified via 0G Compute. Every piece of trip data persists on 0G Storage. The agent itself is an iNFT — ownable, reputable, tradeable."

### Track 3: Wildcard on 0G — $3,000 (SECONDARY TARGET)

The dual-chain architecture (Arc for finance + 0G for agent intelligence) is genuinely novel and doesn't fit neatly into either agent-only or DeFi-only categories. Voice-first interface is unusual for blockchain apps.

---

## How to Run & Test Everything

### Prerequisites

- [Foundry](https://getfoundry.sh/) (forge, cast, anvil)
- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 20
- 0G testnet tokens in the agent wallet (https://faucet.0g.ai)

### 1. Run All Tests (Local, No Tokens Needed)

```bash
# Solidity contracts — 54 tests
cd contracts && forge test -vv

# Trip Memory MCP — 8 tests
cd mcp-servers/trip-memory && bun test

# 0G Compute MCP — 4 tests
cd mcp-servers/0g-compute && bun test

# Web frontend — verify build
cd web && npm install && npx next build
```

### 2. Test Contracts on Galileo Testnet

```bash
# Set your private key
export AGENT_PRIVATE_KEY=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62

# Verify contracts are deployed
cast call 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba "nextTokenId()" --rpc-url https://evmrpc-testnet.0g.ai
cast call 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a "totalTrips(uint256)(uint256)" 0 --rpc-url https://evmrpc-testnet.0g.ai
cast call 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 "nextTripId()" --rpc-url https://evmrpc-testnet.0g.ai

# NOTE: 0G Galileo requires --legacy --gas-price 4000000000 for transactions

# Mint the agent as an iNFT (already done — token #0 exists)
cast send 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba \
  "mintAgent(string,string,string)" \
  "RoadTrip Co-Pilot" "0g://agent-metadata" "0g://agent-description" \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $AGENT_PRIVATE_KEY \
  --legacy --gas-price 4000000000

# Verify the mint
cast call 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba \
  "getAgent(uint256)" 0 \
  --rpc-url https://evmrpc-testnet.0g.ai

# Register a trip on TripRegistry
cast send 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 \
  "registerTrip(uint256,string)" 0 "trip:1" \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $AGENT_PRIVATE_KEY \
  --legacy --gas-price 4000000000

# Verify trip registration
cast call 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 \
  "getTrip(uint256)" 0 \
  --rpc-url https://evmrpc-testnet.0g.ai

# Rate the agent after a trip
cast send 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a \
  "rateAgent(uint256,uint256,uint8,string)" 0 0 5 "Excellent trip planning!" \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $AGENT_PRIVATE_KEY \
  --legacy --gas-price 4000000000

# Check agent reputation stats
# Returns: (avgRating, numRatings, numTrips) — e.g., (450, 2, 0) = 4.50 avg from 2 ratings
cast call 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a \
  "getAgentStats(uint256)" 0 \
  --rpc-url https://evmrpc-testnet.0g.ai
```

### 3. Test 0G Storage MCP Server

```bash
cd mcp-servers/trip-memory

# Test in local fallback mode (no tokens needed)
OG_STORAGE_ENABLED=false bun index.ts
# In another terminal, send MCP requests to stdin

# Test with 0G Storage (needs funded wallet)
AGENT_PRIVATE_KEY=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62 \
OG_STORAGE_ENABLED=true \
bun index.ts
```

### 4. Set Up & Test 0G Compute

0G Compute requires a funded ledger account (minimum 3 0G) plus a provider sub-account (1 0G).

```bash
cd mcp-servers/0g-compute

# Step 1: Run the setup script (creates ledger + funds provider)
# Requires >= 4 0G tokens in the agent wallet
AGENT_PRIVATE_KEY=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62 \
bun setup.ts

# Step 2: Run setup with --test flag to also fire a test inference
AGENT_PRIVATE_KEY=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62 \
bun setup.ts --test

# Step 3: Run the MCP server in fallback mode (no tokens needed)
OG_COMPUTE_ENABLED=false bun index.ts

# Step 4: Run the MCP server with 0G Compute (needs funded ledger)
AGENT_PRIVATE_KEY=0x7309cec2d75f93a7c8327e200f964dc5ccf56e4eda8819ff1ffad9f424ad5f62 \
OG_COMPUTE_ENABLED=true \
bun index.ts
```

### 5. Test Full Frontend

```bash
cd web

# Create .env.local with deployed addresses
cat > .env.local << 'EOF'
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080
NEXT_PUBLIC_TREASURY_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_USDC_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_CHAIN_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_AGENT_NFT_ADDRESS=0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba
NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS=0xaf421c7fad3a550a7da7478b05df9f6b0611c14a
NEXT_PUBLIC_TRIP_REGISTRY_ADDRESS=0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5
NEXT_PUBLIC_OG_STORAGE_MODE=0g
NEXT_PUBLIC_OG_COMPUTE_MODE=0g
NEXT_PUBLIC_OG_HAS_KEY=true
EOF

npm run dev
# Visit http://localhost:3000/trip/0 to see 0G components
```

---

## 0G Components Used

| Component | What We Use It For | Implementation |
|-----------|--------------------|----------------|
| **0G Chain** | Agent identity (iNFT), reputation, trip registry | 3 Solidity contracts deployed on Galileo |
| **0G Storage (KV)** | Structured trip state (preferences, itinerary, spending) | Trip Memory MCP Server v2 |
| **0G Storage (Files)** | Trip artifacts (photos, receipts, reports) | Trip Memory MCP Server v2 |
| **0G Compute** | TEE-verified spending recommendations | 0G Compute MCP Server |
| **iNFT (ERC-7857)** | Agent as ownable on-chain asset with encrypted metadata | AgentNFT.sol |

---

## Testnet Reference

| Parameter | Value |
|-----------|-------|
| Network | 0G-Galileo-Testnet |
| Chain ID | `16602` |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Storage Explorer | `https://storagescan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` |
| Storage Flow Contract | `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` |

---

## File Structure

```
contracts/
  src/
    AgentNFT.sol           # ERC-7857 iNFT for agent identity
    AgentReputation.sol     # On-chain rating system
    TripRegistry.sol        # Trip lifecycle registry
    GroupTreasury.sol       # USDC group treasury (Arc chain)
  test/
    AgentNFT.t.sol          # 12 tests
    AgentReputation.t.sol   # 14 tests
    TripRegistry.t.sol      # 14 tests
    GroupTreasury.t.sol     # 14 tests
  script/
    Deploy0G.s.sol          # Deploy all 0G contracts
    MintAgent.s.sol         # Mint agent as iNFT

mcp-servers/
  trip-memory/
    index.ts                # MCP server (0G Storage + local fallback)
    storage-0g.ts           # 0G Storage SDK wrapper
    index.test.ts           # 8 tests
  0g-compute/
    index.ts                # MCP server (0G Compute + fallback)
    compute-0g.ts           # 0G Compute SDK wrapper
    index.test.ts           # 4 tests

web/src/components/
  ZeroGStatus.tsx           # 0G infrastructure status display
  AgentIdentity.tsx         # Agent iNFT identity card
```
