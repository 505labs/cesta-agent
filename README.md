# RoadTrip Co-Pilot

### "Give your car a wallet."

A voice-first AI agent for group road trips. Friends pool USDC into a shared on-chain treasury on **Arc**. A Claude-powered AI agent manages the trip via voice: finds stops, recommends options, books hotels, pays tolls — and spends from the pool autonomously.

**ETHGlobal Cannes 2026** | Built on **Arc**, **0G**, and **Claude**

---

## The Problem

A road trip with friends means juggling 5-7 apps: Google Maps, Waze, GasBuddy, Yelp, Booking.com, Venmo, and a group chat to coordinate it all. Nobody knows who paid for what, splitting costs is painful, and the driver can't safely use any of these while driving.

## The Solution

One voice-first AI agent that plans, books, pays, and splits. You talk, the car pays.

- **"Book us a hotel in Cannes"** — Agent searches, compares options via 0G Compute, books via x402, pays from the shared treasury on Arc, saves the confirmation to 0G Memory.
- **"We're approaching the toll"** — Agent pays automatically via Arc nanopayment. No approval needed. Receipt saved.
- **"How's our budget?"** — Agent reads on-chain balances: "Spent $247 of $600. Lodging: $245. Tolls: $2.60."

---

## Architecture

```
                              +-----------------------+
                              |     WEB FRONTEND      |
                              |     (Next.js :3000)   |
                              |                       |
                              |  Reown AppKit         |  <-- Wallet connection + SIWE auth
                              |  Trip Dashboard       |  <-- Balance, spending feed, approvals
                              |  Voice Interface      |  <-- Push-to-talk mic + text fallback
                              +-----------+-----------+
                                          |
                                     HTTP | REST API
                                          |
                              +-----------v-----------+
                              |     ORCHESTRATOR      |
                              |   (FastAPI :8080)     |
                              |                       |
                              |  SIWE Auth            |  <-- Wallet-based login (no passwords)
                              |  Trip CRUD            |  <-- Create, join, list trips
                              |  Voice Pipeline       |  <-- Audio in -> STT -> Agent -> TTS -> Audio out
                              |  Payment Approvals    |  <-- 2-of-N in-app voting for large spends
                              +-----------+-----------+
                                          |
                          +---------------+----------------+
                          |                                |
                +---------v----------+          +----------v---------+
                |    VOICE VM (GPU)  |          |   CLAUDE CODE      |
                |                    |          |   AI AGENT         |
                |  Whisper STT       |          |                    |
                |  (speech -> text)  |          |  CLAUDE.md persona |
                |                    |          |  (voice-first,     |
                |  Kokoro TTS        |          |   budget-aware)    |
                |  (text -> speech)  |          |                    |
                +--------------------+          |  MCP Tool Servers: |
                                                |  +-- google-maps   |  <-- Places, directions, POIs
                                                |  +-- weather       |  <-- Forecasts, alerts
                                                |  +-- treasury -----+---> GroupTreasury.sol (Arc)
                                                |  |   book_hotel    |     +- deposit / spend / settle
                                                |  |   pay_toll      |     +- nanopayments (gas-free)
                                                |  |   x402 client   |     +- category budgets
                                                |  +-- trip-memory --+---> 0G Storage (KV + files)
                                                |  +-- 0g-compute ---+---> 0G Compute (TEE inference)
                                                |  +-- voice-channel |
                                                +--------------------+
                                                          |
                          +-------------------------------+-------------------------------+
                          |                               |                               |
                +---------v----------+          +---------v----------+          +---------v----------+
                |    ARC TESTNET     |          |    0G NETWORK      |          |   x402 MOCK APIs   |
                |                    |          |                    |          |   (:4402)           |
                |  GroupTreasury.sol |          |  0G Storage        |          |                    |
                |  +- USDC deposits  |          |  +- Trip memory   |          |  /book-hotel       |
                |  +- Agent spending |          |  +- Preferences   |          |  /pay-toll          |
                |  +- Nanopayments   |          |  +- Itinerary     |          |  /gas-prices        |
                |  +- Category budget|          |                    |          |  /restaurants       |
                |  +- Group voting   |          |  0G Compute (TEE) |          |  /weather           |
                |  +- Settlement     |          |  +- Hotel compare  |          |  /route-optimization|
                |                    |          |  +- Verified eval  |          |                    |
                |  ERC-8004 Identity |          |                    |          |  Accepts x402      |
                |  +- Agent NFT      |          |  Agent iNFT        |          |  nanopayments      |
                |  +- Reputation     |          |  +- ERC-7857 NFT  |          |  (HTTP 402 flow)   |
                |                    |          |  +- Reputation     |          |                    |
                |  Chain ID: 5042002 |          |  Chain ID: 16602   |          |                    |
                |  Gas token: USDC   |          |  (Galileo testnet) |          |                    |
                +--------------------+          +--------------------+          +--------------------+
```

### How the layers work together

**User Layer (Web Frontend):** Users connect their wallet via Reown AppKit, authenticate with SIWE (Sign-In with Ethereum), create trips, deposit USDC, and interact with the AI agent through voice or text. The dashboard shows real-time treasury balance, spending feed by category, and agent identity.

**Orchestrator (FastAPI):** The central backend hub. Handles SIWE authentication (nonce -> sign -> verify -> session token), trip CRUD in SQLite, the voice pipeline (mic audio -> Whisper STT -> Claude agent -> Kokoro TTS -> audio response), and in-app payment approvals (2-of-N voting for spends over the auto-limit).

**AI Agent (Claude Code):** A persistent Claude Code session with a road trip co-pilot persona. Has 6 MCP tool servers giving it capabilities: Google Maps for navigation, weather forecasts, treasury management (spend, nanopay, book hotels, pay tolls), trip memory persistence on 0G Storage, 0G Compute for TEE-verified evaluations, and a voice channel for spoken responses.

**Arc Testnet (Payment Layer):** All payments flow through Arc. The GroupTreasury smart contract holds pooled USDC with per-transaction caps, daily limits, category budgets, and group voting for large spends. Nanopayments are gas-free micro-transactions for tolls, parking, and data API calls. The agent has an ERC-8004 identity on Arc's IdentityRegistry with reputation tracking.

**0G Network (Storage + Compute):** Trip data (preferences, itinerary, booking confirmations, toll receipts) persists to 0G Storage via a KV store with local fallback. 0G Compute provides TEE-sealed inference for spending decisions -- when the agent compares hotel options, the evaluation is cryptographically verified. The agent also has an iNFT identity (ERC-7857) on 0G Chain with reputation scoring.

**x402 Mock APIs:** Simulated paid data services that implement the x402 protocol (HTTP 402 Payment Required). The agent pays per-query via Arc nanopayments for gas prices ($0.003), restaurant data ($0.005), weather ($0.002), route optimization ($0.01), hotel bookings ($0.015), and toll payments ($0.002). In production, these would be real paid APIs.

---

## Payment Flows

### Agent Books a Hotel

```
User: "Book us a hotel in Cannes"
 |
 v
Claude Agent
 |-- 1. treasury_balance() -------> Arc: check lodging budget
 |-- 2. maps_search_places() -----> Google Maps: find hotels nearby
 |-- 3. verified_evaluate() ------> 0G Compute: TEE-verified comparison
 |-- 4. "Found Hotel Riviera, EUR245. Book it?"
 |-- 5. (user confirms)
 |-- 6. book_hotel() -------------> x402-mock: HTTP 402 -> nanopayment -> booking confirmation
 |                                  Arc: treasury.spend(245, "lodging")
 |-- 7. save_trip_data() ---------> 0G Storage: save booking confirmation
 |-- 8. "Booked! Check-in 3pm."
 v
Dashboard: lodging transaction appears in SpendingFeed
```

### Agent Pays a Toll (autonomous nanopayment)

```
User: "We're approaching the A8 toll"
 |
 v
Claude Agent
 |-- 1. pay_toll() ---------------> x402-mock: HTTP 402 -> nanopayment -> toll receipt
 |                                  Arc: treasury.nanopayment(2.60, "tolls")
 |-- 2. save_trip_data() ---------> 0G Storage: save toll receipt
 |-- 3. "Toll paid, EUR2.60. Receipt saved."
 v
Dashboard: tolls transaction appears (no approval needed)
```

---

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, anvil, cast)
- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 18
- Python 3.10+ with pip
- MetaMask or similar EVM wallet

### Install Dependencies

```bash
# Smart contracts
cd contracts && forge install

# Orchestrator
cd orchestrator && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Web frontend
cd web && npm install

# MCP servers (Node.js)
cd mcp-servers/treasury && bun install
cd mcp-servers/trip-memory && bun install
cd mcp-servers/0g-compute && bun install
cd mcp-servers/x402-mock && bun install

# MCP servers (Python)
cd mcp-servers/x402-pay && pip install -r requirements.txt
cd mcp-servers/tee-web-agent && pip install -r requirements.txt

# TEE server
cd tee-server && bun install
```

### Start Services (5 terminals)

```bash
# Terminal 1: Local blockchain
cd contracts && anvil

# Terminal 2: Deploy contracts
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Note the deployed TREASURY_ADDRESS and USDC_ADDRESS from output

# Terminal 3: Backend API
cd orchestrator && source .venv/bin/activate && uvicorn main:app --reload --port 8080

# Terminal 4: Web frontend
cd web && npm run dev
# Open http://localhost:3000

# Terminal 5: x402 mock server (hotel bookings, toll payments, data APIs)
cd mcp-servers/x402-mock && bun run index.ts
# Runs at http://localhost:4402
```

### Configure Environment

Copy `web/.env.example` to `web/.env.local` and fill in:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` -- get from [cloud.walletconnect.com](https://cloud.walletconnect.com)
- `NEXT_PUBLIC_TREASURY_ADDRESS` -- from deployment output
- `NEXT_PUBLIC_USDC_ADDRESS` -- from deployment output

### Deploy to Arc Testnet

```bash
# 1. Get testnet USDC from https://faucet.circle.com (select Arc Testnet)

# 2. Deploy GroupTreasury
cd contracts && PRIVATE_KEY=0x<your_key> forge script script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.network --broadcast

# 3. Register agent on Arc's ERC-8004 IdentityRegistry
PRIVATE_KEY=0x<your_key> forge script script/RegisterArcAgent.s.sol \
  --rpc-url https://rpc.testnet.arc.network --broadcast

# 4. Update web/.env.local with Arc testnet addresses
```

Arc Testnet details:
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: [testnet.arcscan.app](https://testnet.arcscan.app)
- USDC: `0x3600000000000000000000000000000000000000`
- Faucet: [faucet.circle.com](https://faucet.circle.com)

---

## Run Tests

```bash
# Smart contracts -- 76 tests
cd contracts && forge test -vvv

# Backend API -- 15 tests
cd orchestrator && source .venv/bin/activate && pytest tests/ -v

# x402 mock server -- 32 tests
cd mcp-servers/x402-mock && bun test

# Trip memory -- 8+ tests
cd mcp-servers/trip-memory && bun test

# Web build verification
cd web && npm run build

# E2E tests (requires web dev server running)
cd web && npx playwright test
```

---

## 3-Minute Demo Script

**"What if your car had a wallet?"**

| Step | Duration | What Happens |
|------|----------|-------------|
| **1. Connect Wallet** | 15s | Open app, connect MetaMask via Reown AppKit, sign SIWE message |
| **2. Create Trip + Fund** | 30s | Create "Cannes Road Trip" ($600 budget), deposit $200 USDC into Arc treasury |
| **3. Book Hotel** | 45s | Voice: "Book a hotel in Cannes" -> agent searches Google Maps -> 0G Compute evaluates -> x402 books -> Arc pays $245 -> 0G Memory saves confirmation |
| **4. Pay Toll** | 20s | Voice: "Approaching the A8 toll" -> agent pays $2.60 autonomously via Arc nanopayment -> receipt saved to 0G |
| **5. Budget Check** | 15s | Voice: "How's our budget?" -> agent reads on-chain balances: "Lodging: $245, Tolls: $2.60" |

---

## Components

| Directory | What | Tech | Tests |
|-----------|------|------|-------|
| `contracts/` | GroupTreasury + AgentNFT + AgentReputation + TripRegistry | Solidity 0.8.24, Foundry | 76 pass |
| `mcp-servers/treasury/` | Treasury MCP: spend, nanopay, book_hotel, pay_toll, x402, voting | TypeScript, Bun, viem | Integration tested |
| `mcp-servers/x402-mock/` | x402 protocol mock: hotel booking, toll payment, data APIs | TypeScript, Bun | 32 pass |
| `mcp-servers/trip-memory/` | Trip data persistence via 0G Storage | TypeScript, Bun | 8 pass |
| `mcp-servers/0g-compute/` | TEE-verified inference via 0G Compute | TypeScript, Bun | 4 pass |
| `orchestrator/` | Backend API + voice pipeline + SIWE auth | Python, FastAPI | 15 pass |
| `web/` | Frontend dashboard + voice UI | Next.js 15, Reown AppKit, wagmi | E2E pass |
| `agent/` | Claude Code persona + MCP config | CLAUDE.md, .mcp.json | -- |

### MCP Tools Available to the Agent

| Tool | Purpose |
|------|---------|
| `treasury_balance` | Pool balance, per-member deposits, daily spending |
| `treasury_spend` | Spend USDC from pool (food, gas, lodging, activities) |
| `nanopayment_spend` | Gas-free micro-transaction (parking, tolls, fares) |
| `book_hotel` | Full hotel booking: x402 API + on-chain lodging payment + confirmation |
| `pay_toll` | Autonomous toll payment: x402 + on-chain nanopayment + receipt |
| `x402_data_request` | Pay-per-query data APIs (gas prices, restaurants, weather, routes) |
| `treasury_history` | All spending history with timestamps |
| `treasury_category_budgets` | Budget vs spent for all categories |
| `group_vote_request` | Request group approval for over-limit spends |
| `group_vote_status` | Check vote approval count |
| `save_trip_data` | Persist data to 0G Storage |
| `load_trip_data` | Retrieve persisted data |
| `verified_evaluate` | 0G Compute TEE-verified AI evaluation |
| `maps_search_places` | Google Maps place search |
| `get_directions` | Google Maps routing |

### x402 Mock Endpoints

| Endpoint | Price (USDC) | Returns |
|----------|-------------|---------|
| `GET /gas-prices` | $0.003 | Gas stations along Cannes-Nice corridor |
| `GET /restaurants` | $0.005 | Restaurant recommendations with ratings |
| `GET /weather` | $0.002 | Weather forecast for route |
| `GET /route-optimization` | $0.010 | Optimized route with waypoints |
| `GET /book-hotel` | $0.015 | Hotel booking confirmation (bookingId, check-in/out, address) |
| `GET /pay-toll` | $0.002 | Toll payment receipt (tollId, route, amount, receipt number) |

---

## Deployed Contracts

| Contract | Network | Address |
|----------|---------|---------|
| GroupTreasury | **Arc Testnet** (5042002) | [`0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba`](https://testnet.arcscan.app/address/0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba) |
| AgentNFT | **0G Galileo** (16602) | Deployed via `Deploy0G.s.sol` |
| AgentReputation | **0G Galileo** (16602) | Deployed via `Deploy0G.s.sol` |
| TripRegistry | **0G Galileo** (16602) | Deployed via `Deploy0G.s.sol` |
| Agent Identity | **Arc ERC-8004** | Via `RegisterArcAgent.s.sol` |

---

## Sponsor Tracks

### Arc -- $15K (targeting $9K)

| Track | Prize | What We Show |
|-------|-------|-------------|
| **Agentic Nanopayments** | $6K | Agent books hotels, pays tolls, queries data APIs -- all via x402/nanopayments on Arc |
| **Stablecoin Logic** | $3K | GroupTreasury: conditional USDC escrow with caps, budgets, voting, settlement |

### 0G -- $15K (targeting $6K)

| Track | Prize | What We Show |
|-------|-------|-------------|
| **Best OpenClaw Agent** | $6K | Claude Code agent + 0G Storage persistence + 0G Compute TEE evaluation + Agent iNFT |

### Ledger -- $10K (stretch)

| Track | Prize | What We Show |
|-------|-------|-------------|
| **AI Agents x Ledger** | $6K | Hardware approval for high-value treasury spends |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Reown AppKit, wagmi v2, viem |
| Backend | Python FastAPI, SQLite, SIWE (eth_account) |
| AI Agent | Claude Code (Claude Sonnet), MCP protocol, 6 tool servers |
| Voice | Whisper (STT), Kokoro (TTS), voice-channel MCP |
| Contracts | Solidity 0.8.24, Foundry, Arc testnet (chain 5042002) |
| Payments | Arc nanopayments, x402 protocol, USDC |
| Storage | 0G Storage (KV + file), local JSON fallback |
| Compute | 0G Compute (TEE-verified inference) |
| Identity | Arc ERC-8004 IdentityRegistry, 0G Agent iNFT (ERC-7857) |

---

## Project Structure

```
ethglobal/
+-- contracts/                    # Solidity smart contracts (Foundry)
|   +-- src/
|   |   +-- GroupTreasury.sol     # USDC treasury with nanopayments, budgets, voting
|   |   +-- AgentNFT.sol          # ERC-7857 iNFT for agent identity (0G)
|   |   +-- AgentReputation.sol   # Post-trip rating system (0G)
|   |   +-- TripRegistry.sol      # Trip lifecycle registry (0G)
|   +-- test/GroupTreasury.t.sol  # 76 Foundry tests
|   +-- script/
|       +-- Deploy.s.sol          # Deploy to Anvil or Arc testnet
|       +-- Deploy0G.s.sol        # Deploy to 0G Galileo testnet
|       +-- RegisterArcAgent.s.sol # Register agent on Arc ERC-8004
|       +-- MintAgent.s.sol       # Mint agent iNFT on 0G
|
+-- orchestrator/                 # FastAPI backend
|   +-- main.py                   # Voice pipeline, API routes
|   +-- auth.py                   # SIWE wallet authentication
|   +-- trips.py                  # Trip CRUD + payment approvals
|   +-- db.py                     # SQLite database layer
|   +-- tests/                    # 15 pytest tests
|
+-- web/                          # Next.js frontend
|   +-- src/app/                  # Landing page (/), trip dashboard (/trip/[id])
|   +-- src/components/           # ConnectButton, CreateTrip, TreasuryDashboard,
|   |                             # SpendingFeed, VoiceInterface, PaymentApproval,
|   |                             # AgentIdentity, ZeroGStatus, MultiChainDeposit
|   +-- src/lib/                  # wagmi config, AppKit, SIWE, treasury hooks, API
|   +-- public/agent-metadata.json
|
+-- mcp-servers/
|   +-- treasury/                 # Treasury MCP: spend, nanopay, book_hotel, pay_toll, x402
|   +-- trip-memory/              # 0G Storage: save/load trip data + files
|   +-- 0g-compute/              # 0G Compute: TEE-verified inference
|   +-- x402-mock/               # Mock x402 APIs: hotel, toll, gas, restaurants, weather
|
+-- agent/
|   +-- CLAUDE.md                 # Agent persona + behavior rules
|   +-- .mcp.json                 # MCP server configuration (5 servers)
|
+-- docs/                         # Design docs, integration strategies
+-- DEMO.md                       # Quick demo guide
+-- README.md                     # This file
```


