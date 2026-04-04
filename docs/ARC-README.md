# Arc Integration — RoadTrip Co-Pilot

> **"The car handles parking, tolls, and data on its own. Big stuff, the group approves. Every cent is on-chain."**

This document covers everything about our Arc integration: what we built, why, how it maps to the bounty tracks, how to run and test it, and what could be improved.

---

## What We're Building

RoadTrip Co-Pilot is a voice-first AI agent that manages group road trip spending. Friends pool USDC into a shared treasury on Arc. The AI agent autonomously pays for trip services — parking, tolls, data APIs, food — using Arc nanopayments. Larger purchases (hotels, expensive dinners) go through an in-app group vote before the agent executes them on Arc.

Arc is the **single payment layer** for the entire application. Every dollar flows through Arc — micro-transactions, regular spends, and voted large purchases alike.

### Why Arc?

Three properties of Arc make it the right chain for an autonomous AI agent managing group money:

1. **USDC is the native gas token.** No volatile token management. The treasury holds USDC, the agent spends USDC, gas costs USDC. One token for everything. This means $0.50 parking payments are economically viable — gas doesn't eat the payment.

2. **Sub-second deterministic finality.** When the agent pays for a toll, the transaction is final instantly. The dashboard updates in real-time. No waiting for block confirmations.

3. **Nanopayments / x402 protocol.** Gas-free micro-transactions let the agent pay fractions of a cent for data API calls. The agent literally pays for its own intelligence — $0.003 for gas prices, $0.005 for restaurant ratings — from the group treasury. This is economically impossible on Ethereum (gas > payment) but trivial on Arc.

---

## Bounty Track Mapping

### Track 3: Best Agentic Economy with Nanopayments ($6K) — PRIMARY

**What they want:**
> "Enable autonomous AI agents transacting via nanopayments on Arc. Gas-free micropayments for API calls, data access, compute resources, or services without human intervention."

**What we built:**

| Requirement | Our Implementation |
|---|---|
| AI agent paying for API calls per-use | x402 mock server with 4 paid data endpoints. Agent MCP tool `x402_data_request` handles the full 402→pay→retry flow. Each API call is recorded on-chain as a nanopayment from the group treasury. |
| Gas-free micropayments | `nanopayment()` contract function + `nanopayment_spend` MCP tool. Agent autonomously pays for parking ($3-8), tolls ($4-6), fares ($5-10), data ($0.001-$0.01) without human approval. |
| Agent marketplaces / service trading | The x402 server IS a paid service marketplace — the agent discovers prices via HTTP 402 responses and decides whether to pay based on treasury budget. |
| Scalable transaction systems | Nanopayments are tracked separately from regular spends (`nanopaymentTotal` mapping). Category budgets and daily caps provide guardrails. |
| Working frontend + backend | Dashboard shows nanopayment totals, daily spending, category breakdowns with "nanopayment" badges on autonomous transactions. |

**The narrative for judges:** The AI agent is a first-class economic actor on Arc. It pays $0.003 for gas price data, $0.005 for restaurant ratings, $4.50 for a toll, $6 for parking — all autonomously, all on-chain, all auditable. The group can see "Agent spent $0.34 on data services today" in the dashboard. This is what the agentic economy looks like: agents that pay for their own intelligence.

### Track 1: Best Smart Contracts with Advanced Stablecoin Logic ($3K) — SECONDARY

**What they want:**
> "Smart contracts demonstrating sophisticated programmable logic using USDC — conditional escrow, programmable payroll, crosschain conditional transfers."

**What we built:**

| Requirement | Our Implementation |
|---|---|
| Conditional escrow | GroupTreasury: multi-depositor escrow where USDC is locked until spent by the agent or returned at settlement. |
| Programmable spending rules | Per-transaction caps (`spendLimit`), daily caps (`dailyCap`), per-category budgets (`categoryBudgets` mapping). |
| Agent-authorized spending | Only the designated `agent` address can call `spend()` and `nanopayment()`. Immutable at trip creation. |
| Group voting / dispute resolution | `requestVote()` → `castVote()` → `executeVote()` for over-limit expenses. Configurable threshold (e.g., 2-of-3). |
| Automatic settlement | `settle()` returns remaining USDC proportionally to all depositors based on their share. |
| On-chain receipts | Every spend, nanopayment, vote, and settlement emits events with amount, category, description, and timestamp. |

**The narrative for judges:** This isn't a simple escrow — it's a programmable treasury with layered spending rules. The agent can auto-spend under $100 but needs 2-of-3 approval for a hotel. Food budget is capped at $200. Daily spending can't exceed $500. And every cent is accounted for with on-chain receipts by category.

---

## Architecture

```
                    ┌─────────────────────────────┐
                    │         WEB DASHBOARD        │
                    │  Reown AppKit (wallet auth)  │
                    │  Arc Testnet chain config    │
                    │  Nanopayment stats display   │
                    │  Category budget breakdown   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        ORCHESTRATOR          │
                    │   FastAPI + SIWE auth        │
                    │   Trip management endpoints  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      CLAUDE CODE AGENT       │
                    │                              │
                    │  MCP Tools:                  │
                    │  ├─ treasury_balance          │
                    │  ├─ treasury_spend            │ ──► GroupTreasury.sol
                    │  ├─ nanopayment_spend         │ ──► (Arc Testnet)
                    │  ├─ x402_data_request         │ ──► x402 Server
                    │  ├─ treasury_category_budgets  │
                    │  ├─ treasury_history           │
                    │  ├─ group_vote_request         │
                    │  └─ group_vote_status          │
                    └──────────────┬──────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
               ▼                   ▼                   ▼
┌──────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│  GroupTreasury.sol   │ │  x402 Mock      │ │  Arc Testnet        │
│  (Arc Testnet)       │ │  Server (:4402) │ │  Chain ID: 5042002  │
│                      │ │                 │ │  RPC: rpc.testnet.  │
│  Functions:          │ │  GET /gas-prices│ │       arc.network   │
│  - createTrip        │ │  GET /restaurants│ │  USDC: 0x3600...   │
│  - deposit           │ │  GET /weather   │ │  Explorer:          │
│  - spend             │ │  GET /route-opt*│ │   testnet.arcscan.  │
│  - nanopayment       │ │                 │ │       app           │
│  - requestVote       │ │  Returns 402    │ │                     │
│  - castVote          │ │  with payment   │ │  Sub-second         │
│  - executeVote       │ │  requirements   │ │  finality           │
│  - settle            │ │  Agent pays +   │ │  USDC native gas    │
│                      │ │  retries        │ │                     │
└──────────────────────┘ └─────────────────┘ └─────────────────────┘
```

### The x402 Payment Flow (Agent Pays for Data)

This is the core of Track 3. Here's exactly what happens when the agent needs gas prices:

```
1. Agent MCP tool `x402_data_request` called with endpoint="gas-prices"

2. HTTP GET http://localhost:4402/gas-prices
   → Server responds: 402 Payment Required
   {
     "x402": {
       "version": "1",
       "price": "3000",          // $0.003 in 6-decimal USDC
       "token": "USDC",
       "network": "arc-testnet",
       "recipient": "0x...402",
       "description": "Gas prices along route"
     }
   }

3. MCP tool reads payment requirements from 402 body

4. MCP tool calls GroupTreasury.nanopayment() on Arc:
   - tripId: current trip
   - recipient: 0x...402 (API provider)
   - amount: 3000 (USDC units, $0.003)
   - category: "data"
   - description: "Gas prices API $0.003"
   → On-chain receipt emitted: NanopaymentProcessed event

5. MCP tool creates X-PAYMENT header (base64 JSON with from, to, amount, tripId, timestamp)

6. HTTP GET http://localhost:4402/gas-prices + X-PAYMENT header
   → Server validates payment, responds: 200 OK
   {
     "stations": [
       { "name": "Shell A8", "price_per_liter": 1.45, "distance_km": 2.1 },
       { "name": "Total Nice", "price_per_liter": 1.52, "distance_km": 4.3 },
       ...
     ]
   }

7. Agent receives data + payment confirmation. Returns both to Claude.
   Agent says: "Gas is cheapest at Shell on exit 42 — €1.45/L"
```

Every step is auditable. The nanopayment is on-chain. The dashboard shows "Agent spent $0.003 on Gas prices API."

### The Nanopayment Flow (Agent Pays Autonomously)

When the agent detects a toll, parking, or other micro-expense:

```
1. Agent decides to pay (based on route data, GPS, etc.)

2. Agent MCP tool `nanopayment_spend` called:
   - trip_id: 0
   - recipient: "0x...tollbooth"
   - amount_usd: 4.50
   - category: "tolls"
   - description: "Highway A8 toll"

3. MCP tool calls GroupTreasury.nanopayment() on Arc:
   - Checks: trip active, agent authorized, sufficient funds
   - Updates: totalSpent, nanopaymentTotal, dailySpending, categoryBudgets
   - Transfers: 4,500,000 USDC units to toll recipient
   - Emits: NanopaymentProcessed event

4. Agent tells the user: "Toll was $4.50. Transport budget: $45 of $150."
```

Key difference from `spend()`: nanopayments skip the per-transaction spend limit (they're micro by definition) but still respect daily caps and category budgets.

### The Group Vote Flow (Human Approval for Big Spends)

When the agent wants to book a $220 hotel (over the $100 auto-limit):

```
1. Agent calls `group_vote_request`:
   - recipient: hotel address
   - amount: $220
   - category: "lodging"
   - description: "Hotel & Spa Nice"
   - threshold: 2 (need 2 approvals)

2. GroupTreasury.requestVote() emits VoteRequested event
   → Frontend shows pending approval card

3. Alice opens dashboard, taps Approve → castVote(voteId)
4. Bob opens dashboard, taps Approve → castVote(voteId)
   → 2 approvals >= 2 threshold

5. Agent calls executeVote(voteId)
   → $220 transferred to hotel
   → On-chain receipt emitted
   → Agent: "Booked! Hotel & Spa Nice, $220 from the pool."
```

---

## Implementation Details

### Smart Contract: GroupTreasury.sol

**File:** `contracts/src/GroupTreasury.sol` (236 lines)
**Deployed:** `0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba` on Arc Testnet
**Tests:** 36/36 pass in `contracts/test/GroupTreasury.t.sol`

**State structures:**
- `Trip` — organizer, agent address, USDC address, spendLimit, dailyCap, totals, status
- `Spend` — recipient, amount, category string, description string, timestamp
- `CategoryBudget` — budget cap and amount spent per category
- `VoteRequest` — tripId, recipient, amount, category, description, approvals, threshold, executed flag, per-address vote tracking

**Key design decisions:**
- USDC-only (Arc's native token). No ETH, no wrapped tokens.
- Agent address set at trip creation and immutable. Only the agent can spend.
- `nanopayment()` is a separate function from `spend()`. It skips the per-tx spend limit but respects daily caps and category budgets. This models the real-world distinction: the agent shouldn't need approval for a $0.003 API call, but it also shouldn't blow the daily budget on data queries.
- Category budgets are optional (0 = unlimited). Set by the organizer at trip creation.
- Voting uses a simple threshold model. Any member can vote. Once threshold is met, anyone can execute.
- Settlement is proportional: if Alice deposited 40% of the pool, she gets 40% of what's left.

### x402 Mock Server

**File:** `mcp-servers/x402-mock/index.ts` (300 lines)
**Port:** 4402
**Tests:** 18/18 pass in `mcp-servers/x402-mock/index.test.ts`

This simulates a real x402-compliant API marketplace. In production, these would be third-party services (gas price aggregators, restaurant APIs, weather providers) that accept nanopayments via the x402 protocol. For the hackathon demo, we run our own server with realistic mock data.

**Endpoints and pricing:**

| Endpoint | Price | Mock Data |
|----------|-------|-----------|
| `GET /gas-prices` | $0.003 (3000 units) | 5 gas stations with name, price/L, distance, brand |
| `GET /restaurants` | $0.005 (5000 units) | 5 restaurants with name, cuisine, avg price, rating |
| `GET /weather` | $0.002 (2000 units) | Current conditions + 6-hour forecast |
| `GET /route-optimization` | $0.010 (10000 units) | Waypoints, distance, time, traffic status |
| `GET /health` | Free | Server status |
| `GET /stats` | Free | Total payments received, breakdown per endpoint |

**x402 validation:** The server checks that the `X-PAYMENT` header contains valid base64-encoded JSON with `from`, `to` (matching the recipient), and `amount` (sufficient for the endpoint's price). In production, this would be a cryptographic EIP-3009 signature verified by Circle Gateway.

### Treasury MCP Server

**File:** `mcp-servers/treasury/index.ts` (763 lines)
**ABI:** `mcp-servers/treasury/abi.ts`

8 tools exposed to the Claude Code agent via the Model Context Protocol:

| Tool | What It Does |
|------|-------------|
| `treasury_balance` | Reads pool balance, per-member deposits, nanopayment total, daily spending |
| `treasury_spend` | Calls `spend()` on the contract. For regular expenses under the auto-limit. |
| `nanopayment_spend` | Calls `nanopayment()`. For parking, tolls, fares, data APIs. |
| `x402_data_request` | Full x402 flow: GET → 402 → pay nanopayment on-chain → retry with header → return data |
| `treasury_history` | Reads all spend records with formatted timestamps |
| `treasury_category_budgets` | Reads budget/spent for 7 categories: food, gas, lodging, activities, parking, tolls, data |
| `group_vote_request` | Calls `requestVote()` for over-limit expenses, returns vote ID |
| `group_vote_status` | Reads vote state: pending, ready to execute, or executed |

The MCP server connects to Arc via viem. It uses a private key to sign agent transactions (in production, this would be Circle Programmable Wallets with MPC).

### Frontend: Arc Chain + Nanopayment Display

**Arc Testnet chain** defined in `web/src/lib/wagmi.ts`:
- Chain ID 5042002, USDC native currency (6 decimals)
- RPC: `https://rpc.testnet.arc.network`
- Block explorer: `https://testnet.arcscan.app`
- Listed as the primary chain in the wallet connection UI

**SpendingFeed component** (`web/src/components/SpendingFeed.tsx`):
- Shows "Arc Nanopayments" card with autonomous spending total and daily total
- 8 category types with color coding (food, gas, lodging, activities, parking, tolls, data, fares)
- "nanopayment" badge on autonomous transactions (parking, tolls, data, fares)
- Reads `getNanopaymentTotal()` and `getDailySpending()` from the contract

**MultiChainDeposit component** (`web/src/components/MultiChainDeposit.tsx`):
- Arc Testnet listed first with "USDC native" badge
- Anvil, Sepolia, Base Sepolia also available for development/testing

---

## How to Run and Test

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `forge`, `anvil`, `cast`
- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 18

### Test 1: Smart Contract (Foundry)

```bash
cd contracts
forge test -v
```

Runs 36 tests covering:
- Trip creation, deposits, multi-member deposits
- Agent spending with spend limit enforcement
- **Daily cap enforcement** — spend rejects when daily total would exceed cap
- **Category budget enforcement** — spend rejects when category is over budget
- **Nanopayment basics** — records payment, updates nanopaymentTotal, skips spend limit
- **Multiple nanopayment data API calls** — simulates agent buying intelligence
- **Nanopayment category tracking** — budget spent counter updates
- **Group voting** — request vote, cast votes, execute after threshold met
- **Vote rejection** — not enough approvals, double voting prevention
- Settlement, emergency withdraw, edge cases
- **Full demo flow** — creates trip with budgets, 3 members deposit, agent makes data API nanopayments + toll + parking + food spend + hotel vote → settle

### Test 2: x402 Mock Server

```bash
cd mcp-servers/x402-mock
bun install
bun test
```

Runs 24 tests covering:
- Health endpoint returns 200
- All 4 paid endpoints return 402 without payment
- 402 responses contain correct x402 payment requirements (price, token, network, recipient)
- Endpoints return 200 with valid X-PAYMENT header
- Mock data structure validation (stations have names, restaurants have ratings, etc.)
- Stats tracking across payments
- Error cases: invalid base64, bad JSON, missing fields, wrong recipient, insufficient payment

### Test 3: Full Integration (Anvil)

```bash
# Terminal 1
cd contracts && anvil --port 8545

# Terminal 2
cd contracts && forge script script/IntegrationTest.s.sol:IntegrationTest \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

This script deploys everything and runs a complete demo scenario:
1. Deploys GroupTreasury + MockUSDC
2. Creates trip with $100 spend limit, $500 daily cap, category budgets ($200 food, $1 data, $50 tolls)
3. Single deployer deposits $600 into the pool
4. Agent makes 3 nanopayments for data APIs ($0.003 + $0.005 + $0.002 = $0.01)
5. Agent pays toll ($4.50) and parking ($6.00) via nanopayment
6. Agent spends $38.50 on food (regular spend, under limit)
7. Logs nanopaymentTotal = $10.51, food budget spent = $38.50

Output:
```
Treasury: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
USDC: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Trip ID: 0
=== INTEGRATION TEST PASSED ===
```

### Test 4: Frontend E2E (Playwright)

```bash
cd web
npx playwright test arc-integration
```

Tests that the app loads with Arc chain config, feature cards render, and no critical JS errors.

### Test 5: Verify Arc Testnet Deployment

```bash
# Check contract has code
cast code 0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba --rpc-url https://rpc.testnet.arc.network | head -c 100

# Call nextTripId (should return 0)
cast call 0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba "nextTripId()" --rpc-url https://rpc.testnet.arc.network
```

Or view on the explorer: [testnet.arcscan.app/address/0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba](https://testnet.arcscan.app/address/0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba)

---

## Bounty Checklist

### Track 3 Requirements (from ethglobal.com/events/cannes2026/prizes#arc)

| Requirement | Status | Evidence |
|---|---|---|
| Functional MVP | **Done** | Contract deployed on Arc testnet, MCP tools work, frontend renders |
| Architecture diagram | **Done** | See Architecture section above + `docs/ARCHITECTURE.md` |
| Working frontend | **Done** | Next.js dashboard with nanopayment stats, Arc chain, category breakdowns |
| Working backend | **Done** | FastAPI orchestrator, Treasury MCP server with 8 tools, x402 server |
| Video demonstration | **TODO** | Need to record 3-min demo |
| Detailed documentation | **Done** | This document + README.md + arc-integration-strategy.md |
| GitHub repository | **Done** | This repo |
| Uses nanopayments | **Done** | `nanopayment()` contract function, `nanopayment_spend` MCP tool, x402 data payments |
| Agent pays for API calls | **Done** | x402 flow: 402 → sign → pay on-chain → retry → get data |
| Gas-free micropayments | **Partial** | On-chain recording works. Real Circle Gateway batching (off-chain settlement) is simulated — we record directly on-chain which costs gas. In production, nanopayments would be signed off-chain and batched by Gateway. |
| Without human intervention | **Done** | Agent calls `nanopayment_spend` and `x402_data_request` autonomously. No wallet popup, no approval needed. |

### Track 1 Requirements

| Requirement | Status | Evidence |
|---|---|---|
| Conditional escrow | **Done** | Deposit → spend rules → settle lifecycle |
| Programmable spending rules | **Done** | Per-tx caps, daily caps, category budgets |
| Group voting | **Done** | requestVote, castVote, executeVote |
| Settlement | **Done** | Proportional return at trip end |
| On-chain receipts | **Done** | Events for every spend, nanopayment, vote |
| Deployed on Arc | **Done** | `0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba` |

---

## What Could Be Stronger

Listed in priority order — highest impact first.

### 1. ERC-8004 Agent Identity on Arc (Medium Impact)

Arc has native contracts for AI agent identity:
- `IdentityRegistry` at `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- `ReputationRegistry` at `0x8004B663056A597Dffe9eCcC1965A193B7388713`

We could additionally register our agent on Arc's native registry for deeper Arc integration.

> **Note:** Custom `AgentNFT.sol` (ERC-7857 iNFT) and `AgentReputation.sol` contracts are already deployed on **0G Galileo Testnet**, with the `AgentIdentity.tsx` frontend component wired up. The Arc-native ERC-8004 registration would be complementary to this existing 0G-based identity.

**Effort:** ~1-2 hours. Call `IdentityRegistry.register(metadataURI)` with agent metadata on IPFS.

### 2. Real EIP-3009 Signatures in x402 (Medium Impact)

Currently the X-PAYMENT header is a mock (base64 JSON). A proper implementation would use EIP-3009 `transferWithAuthorization` signatures — the agent signs a USDC transfer authorization off-chain, and the server verifies the cryptographic signature before serving data.

This would match the real x402 protocol more closely and impress judges who inspect the code.

**Effort:** ~2-3 hours. Use viem's `signTypedData` for EIP-712 structured data.

### 3. Circle Programmable Wallets (Medium Impact)

Replace the raw private key with Circle's MPC-secured wallet. The agent would call Circle's API to sign transactions — no private key in memory.

Currently blocked by an entity secret issue (a previous secret was registered with our API key and we don't know what it was). Would need a fresh Circle API key.

**Effort:** ~1 hour once API key is available. The setup script (`scripts/setup-circle-wallet.ts`) is already written.

### 4. ERC-8183 Escrow Extension (Low Impact)

Arc has a native escrow standard at `0x0747EEf0706327138c69792bF28Cd525089e4583`. We could extend it instead of building custom escrow. Tells judges "we used Arc's native primitives."

**Effort:** ~3-4 hours. Would require refactoring GroupTreasury to inherit from ERC-8183.

### 5. Real Circle Gateway Settlement (Low Impact for Demo)

In production, nanopayments would be signed off-chain (zero gas) and settled in batches by Circle Gateway. Our mock records them as individual on-chain transactions. For the demo this is actually fine — each nanopayment shows up immediately on-chain, which is more visually compelling than batched settlement.

---

## File Map

```
contracts/
├── src/GroupTreasury.sol          # Enhanced treasury: nanopayments, voting, budgets
├── test/GroupTreasury.t.sol       # 36 tests including full demo flow
├── script/Deploy.s.sol            # Simple deployment script
├── script/IntegrationTest.s.sol   # Full E2E integration test
└── foundry.toml                   # Arc testnet RPC configured

mcp-servers/
├── treasury/
│   ├── index.ts                   # 8 MCP tools for agent spending
│   └── abi.ts                     # Full contract ABI (all new functions)
├── x402-mock/
│   ├── index.ts                   # x402 payment protocol server
│   └── index.test.ts              # 24 tests

web/
├── src/lib/wagmi.ts               # Arc Testnet chain definition (5042002)
├── src/lib/treasury.ts            # Hooks: nanopaymentTotal, dailySpending, categoryBudget, voteRequest
├── src/components/SpendingFeed.tsx # Nanopayment stats + category display
├── src/components/MultiChainDeposit.tsx  # Arc as primary deposit chain
└── e2e/arc-integration.spec.ts    # Playwright tests

scripts/
└── setup-circle-wallet.ts         # Circle Programmable Wallets setup (optional)
```

---

## Key Addresses

| What | Address / Value |
|------|----------------|
| GroupTreasury (Arc Testnet) | `0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba` |
| Arc Testnet Chain ID | `5042002` |
| Arc Testnet RPC | `https://rpc.testnet.arc.network` |
| Arc Block Explorer | `https://testnet.arcscan.app` |
| USDC on Arc | `0x3600000000000000000000000000000000000000` |
| Deployer / Agent Wallet | `0xabD736bB59DFA66a5a2ec92519142A6A37FC5805` |
| Faucet | `https://faucet.circle.com` (select Arc Testnet) |
