# RoadTrip Co-Pilot

**"Give your car a wallet."**

Your car has eyes, ears, and a brain — but no wallet. It can't pay for gas, tolls, or food. RoadTrip Co-Pilot fixes that. Friends pool USDC into a shared on-chain treasury on Arc, and a voice-first AI agent manages the trip: finds stops, recommends options, and pays from the pool — autonomously via nanopayments.

Built for [ETHGlobal Cannes 2026](https://ethglobal.com/events/cannes2026).

## Architecture

```
 +------------------+        +------------------+
 |    Web App       |        | Android Auto App |
 |   (Next.js)      |        |    (Kotlin)      |
 |  Reown AppKit    |        |   Voice I/O      |
 +--------+---------+        +--------+---------+
          |                           |
          +----------+   +------------+
                     |   |
               +-----v---v------+         +------------------+
               |  Orchestrator  |-------->|   Voice VM (GPU) |
               |  (FastAPI)     |         |   Whisper STT    |
               |  :8080         |<--------|   Kokoro TTS     |
               +-------+--------+         +------------------+
                       |
              +--------v---------+
              |  voice-channel   |
              |  (MCP :9000)     |
              +--------+---------+
                       |
              +--------v---------+         +---------------------------+
              |  Claude Code     |-------->| GroupTreasury.sol         |
              |  Session (tmux)  |         | (Arc Testnet / Anvil)     |
              |                  |         | 0x8AdC5Db1e62E5553...     |
              |  MCP Servers:    |         +---------------------------+
              |  - google-maps   |
              |  - treasury -----+-------->  Arc nanopayments (spend,
              |  - x402 client   |           vote, category budgets)
              |  - trip-memory   |
              |  - weather       |         +---------------------------+
              +------------------+-------->| x402 Mock Server (:4402)  |
                                           | Gas prices, restaurants,  |
                                           | weather, route data       |
                                           +---------------------------+
```

## Components

| Directory | What | Tech | Tests |
|-----------|------|------|-------|
| `contracts/` | GroupTreasury smart contract — escrow, nanopayments, voting | Solidity 0.8.24, Foundry | **36/36 pass** |
| `mcp-servers/treasury/` | Treasury MCP — 8 tools for agent spending | TypeScript, Bun, viem | Compiles + integration tested |
| `mcp-servers/x402-mock/` | x402 payment protocol mock server | TypeScript, Bun | **24/24 pass** |
| `mcp-servers/trip-memory/` | Trip data persistence | TypeScript, Bun | Smoke tested |
| `orchestrator/` | Backend API + voice pipeline + SIWE auth | Python, FastAPI | **15/15 pass** |
| `web/` | Frontend dashboard + voice UI | Next.js 15, Reown AppKit, wagmi | **9 E2E pass** |
| `agent/` | Claude Code persona + MCP config | CLAUDE.md, .mcp.json | — |
| `scripts/` | Circle Programmable Wallets setup | TypeScript, Bun | — |

## Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| GroupTreasury | **Arc Testnet** (5042002) | [`0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba`](https://testnet.arcscan.app/address/0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba) |
| GroupTreasury | Anvil Local (31337) | Deployed on each `forge script` run |

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, anvil, cast)
- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 18
- Python 3.12+ with `pip`

### 1. Smart Contracts (Foundry)

```bash
cd contracts

# Run all tests (36 tests across GroupTreasury, AgentNFT, etc.)
forge test -v

# Start local Anvil node
anvil --port 8545

# Deploy to local Anvil (in another terminal)
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Run full integration test (deploy + deposit + nanopayments + spend + vote + settle)
forge script script/IntegrationTest.s.sol:IntegrationTest \
  --rpc-url http://127.0.0.1:8545 --broadcast

# Deploy to Arc Testnet (requires funded wallet)
forge create src/GroupTreasury.sol:GroupTreasury \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key 0x<YOUR_PRIVATE_KEY> --broadcast
```

### 2. x402 Mock Server

```bash
cd mcp-servers/x402-mock

# Install dependencies
bun install

# Run tests (24 tests)
bun test

# Start server (port 4402)
bun start
```

The x402 server provides 4 paid data endpoints that the AI agent pays for per-query:

| Endpoint | Price (USDC) | Data |
|----------|-------------|------|
| `GET /gas-prices` | $0.003 | Gas stations along route |
| `GET /restaurants` | $0.005 | Restaurant recommendations |
| `GET /weather` | $0.002 | Weather forecast |
| `GET /route-optimization` | $0.010 | Optimized route + waypoints |

Without an `X-PAYMENT` header, endpoints return **HTTP 402** with payment requirements. The agent signs a payment, records it on-chain via `nanopayment()`, and retries with the header.

### 3. Treasury MCP Server

```bash
cd mcp-servers/treasury

# Install dependencies
bun install

# Run (requires env vars)
RPC_URL=http://127.0.0.1:8545 \
TREASURY_ADDRESS=0x5fbdb2315678afecb367f032d93f642f64180aa3 \
AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
CHAIN_ID=31337 \
bun start
```

**MCP Tools available to the AI agent:**

| Tool | Purpose |
|------|---------|
| `treasury_balance` | Pool balance, per-member deposits, nanopayment total, daily spending |
| `treasury_spend` | Spend USDC from pool (under auto-limit, food/gas/lodging) |
| `nanopayment_spend` | Micro-transaction for parking, tolls, fares, data APIs |
| `x402_data_request` | Full x402 flow: request → 402 → pay → get data |
| `treasury_history` | All spending history with timestamps |
| `treasury_category_budgets` | Budget vs spent for all categories |
| `group_vote_request` | Request group approval for over-limit spends |
| `group_vote_status` | Check vote approval count |

### 4. Orchestrator

```bash
cd orchestrator
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run tests (15 tests)
pytest tests/ -v

# Start server
uvicorn main:app --port 8080
```

### 5. Web Frontend

```bash
cd web
npm install

# Run dev server
npm run dev

# Run E2E tests (requires dev server or uses webServer config)
npx playwright test

# Run just the Arc integration tests
npx playwright test arc-integration
```

### 6. Run Everything Together

```bash
# Terminal 1: Local blockchain
cd contracts && anvil --port 8545

# Terminal 2: Deploy contracts
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3: x402 mock server
cd mcp-servers/x402-mock && bun start

# Terminal 4: Orchestrator
cd orchestrator && source .venv/bin/activate && uvicorn main:app --port 8080

# Terminal 5: Web frontend
cd web && npm run dev

# Terminal 6 (optional): Agent
cd agent && claude --dangerously-load-development-channels server:../voice-channel
```

### Getting Arc Testnet USDC

1. Go to [faucet.circle.com](https://faucet.circle.com)
2. Select **Arc Testnet**
3. Paste your wallet address
4. Request USDC — you'll get native USDC (for gas) and ERC-20 USDC

Arc Testnet details:
- **Chain ID:** 5042002
- **RPC:** `https://rpc.testnet.arc.network`
- **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)
- **USDC:** `0x3600000000000000000000000000000000000000`

## Sponsor Tracks

### Arc — Track 3: Best Agentic Economy with Nanopayments ($6K) — PRIMARY

The AI agent is a first-class economic actor on Arc. It autonomously pays for trip services using gas-free nanopayments:

- **Data APIs via x402:** Agent pays $0.001-$0.01 per query for gas prices, restaurant data, weather, route optimization. Every API call is an auditable on-chain expense from the group treasury.
- **Autonomous micro-spending:** Parking ($3-8), tolls ($4-6), fares ($5-10) — the agent streams nanopayments without human approval.
- **On-chain receipts:** Every nanopayment is recorded with category, description, amount, and timestamp.
- **Budget guardrails:** Daily caps and category budgets prevent overspending. The agent can't exceed what the group authorized.

**Key demo flow:** Agent says "Checking gas prices..." → pays $0.003 via x402 → gets data → recommends cheapest station → pays $4.50 toll via nanopayment → dashboard updates in real-time.

### Arc — Track 1: Best Smart Contracts with Stablecoin Logic ($3K) — SECONDARY

GroupTreasury.sol is a programmable USDC escrow with:

- Multi-depositor group funding (friends pool money)
- Per-transaction spend limits with agent authorization
- Daily spending caps
- Category budgets (food: $200, gas: $150, etc.)
- Group voting for over-limit expenses (2-of-3 approval)
- Proportional settlement at trip end
- Nanopayment tracking (separate from regular spends)
- Full event emission for every state change

### WalletConnect — Reown SDK ($1K)

- Reown AppKit for wallet-based auth (SIWE — Sign In With Ethereum)
- Multi-chain wallet connection (EVM + Solana adapters)
- No passwords, no API keys — wallet IS your identity

### 0G — OpenClaw Agent ($6K)

- Trip data persistence via 0G Storage MCP server
- Agent conversation history survives session restarts

## How It Works

1. **Connect wallet** — Reown AppKit modal. Your wallet is your identity.
2. **Create a trip** — Name, budget, spend limits, category budgets.
3. **Friends deposit** — Each person deposits USDC into the shared pool on Arc.
4. **The car drives** — AI agent monitors route, finds stops, pays for data via x402.
5. **Autonomous spending** — Parking, tolls, fares paid via nanopayments. No human needed.
6. **Group approval** — Hotel over $100? Agent requests a vote. 2-of-3 approve.
7. **Settle up** — Trip ends, leftovers returned proportionally. On-chain receipts for everything.

## Testing Summary

```
Foundry (contracts):      76 tests pass (36 GroupTreasury + 12 AgentNFT + others)
x402 mock server:         24 tests pass (95 assertions)
Orchestrator (pytest):    15 tests pass
Playwright E2E (web):      9 tests pass
Integration test:         Full demo flow on Anvil passes
Arc Testnet:              Contract deployed and verified
```

## Team

Built by [snojj25](https://github.com/snojj25) at ETHGlobal Cannes 2026.
