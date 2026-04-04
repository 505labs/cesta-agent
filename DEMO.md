# RoadTrip Co-Pilot — Demo Guide

## "Give your car a wallet."

Voice-first AI agent for group road trips. Friends pool USDC on Arc, and the AI agent pays for everything — hotels, tolls, gas, food — autonomously.

**Sponsors:** Arc ($9K), 0G ($6K), Ledger ($6K stretch)

---

## Quick Start

### Prerequisites
- Node.js 18+, Bun, Python 3.10+, Foundry
- MetaMask or similar wallet
- Arc testnet USDC (get from https://faucet.circle.com)

### Start Services

```bash
# Terminal 1: Local blockchain (for dev) OR use Arc testnet
cd contracts && anvil

# Terminal 2: Deploy contracts
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3: Backend API
cd orchestrator && source .venv/bin/activate && uvicorn main:app --reload --port 8080

# Terminal 4: Web frontend
cd web && npm run dev

# Terminal 5: x402 mock server (hotel bookings, toll payments, data APIs)
cd mcp-servers/x402-mock && bun run index.ts
```

App runs at http://localhost:3000

### Run Tests

```bash
# Smart contracts (44 tests)
cd contracts && forge test -vvv

# Backend API (15 tests)
cd orchestrator && pytest tests/ -v

# x402 mock server
cd mcp-servers/x402-mock && bun test

# Trip memory
cd mcp-servers/trip-memory && bun test

# Web build check
cd web && npm run build
```

---

## 3-Minute Demo Script

### 1. Connect Wallet (15s)
- Open http://localhost:3000
- Click "Connect Wallet"
- Connect MetaMask (pointed at Anvil localhost:8545 or Arc testnet)
- Sign the SIWE message
- Dashboard loads

### 2. Create Trip + Fund (30s)
- Click "Create Trip"
- Name: "Cannes Road Trip", Budget: $600
- Click Create → redirected to trip dashboard
- Enter $200 in deposit field
- Click "Deposit" → approve USDC in wallet
- Pool balance updates to $200

### 3. Agent Books Hotel (45s)
- Use voice (push-to-talk) or text input
- Say: "Book us a hotel in Cannes for tonight"
- Agent searches hotels via Google Maps
- Agent evaluates options via 0G Compute (TEE-verified)
- Agent: "Found Hotel de Cannes Riviera, €245/night. Want me to book?"
- Say: "Yes"
- Agent books via x402 (nanopayment to booking API)
- Agent pays €245 from treasury (on-chain on Arc)
- Agent saves booking to 0G Memory
- Dashboard shows "lodging" transaction

### 4. Agent Pays Toll (20s)
- Say: "We're approaching the toll on A8"
- Agent automatically pays toll via x402 nanopayment
- No approval needed — tolls are under the auto-limit
- Agent: "Toll paid, €2.60 for A8. Receipt saved."
- Dashboard shows "tolls" transaction

### 5. Budget Check (15s)
- Say: "How's our budget?"
- Agent: "Spent €247.60 of €600. Lodging: €245. Tolls: €2.60."

---

## Architecture

```
User (Web/Voice) → Reown AppKit (wallet auth)
       ↓
Orchestrator (FastAPI :8080) → Voice Pipeline (Whisper STT + Kokoro TTS)
       ↓
Claude Code Agent (MCP tools)
  ├── Google Maps (places, directions)
  ├── Weather (forecasts)
  ├── Treasury (spend, nanopay, balance, book_hotel, pay_toll)
  ├── Trip Memory (0G Storage)
  └── 0G Compute (TEE-verified inference)
       ↓
Arc Testnet (GroupTreasury.sol — USDC payments)
x402 Mock (hotel bookings, toll payments, data APIs)
0G Network (Storage + Compute)
```

## Key Technologies
- **Arc**: USDC treasury, nanopayments, x402 protocol, ERC-8004 agent identity
- **0G**: Storage (trip memory), Compute (TEE-verified evaluation), Agent NFT (iNFT)
- **Reown AppKit**: Wallet connection + SIWE authentication
- **Claude Code**: AI agent with MCP tool servers
