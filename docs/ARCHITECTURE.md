# RoadTrip Co-Pilot — Architecture & Workflows

## What We've Built

A voice-first AI road trip assistant with a shared crypto wallet. The system has 6 layers:

1. **Clients** — Web app (browser) + Android Auto app (car)
2. **Orchestrator** — Central API hub handling auth, trips, and the voice pipeline
3. **Voice Pipeline** — Speech-to-text + text-to-speech on a GPU VM
4. **AI Agent** — Claude Code session with MCP tools for maps, payments, and memory
5. **Smart Contracts** — GroupTreasury on Arc (USDC escrow, spending, settlement)
6. **MCP Servers** — Custom tools that give the AI agent its capabilities

### Sponsor Integration

- **Arc** = The payment layer. ALL payments go through Arc — nanopayments (gas-free micro-transactions for parking, tolls, fares, data APIs) and direct on-chain treasury transactions (larger spends). The treasury contract on Arc is the single source of truth.
- **0G** = Storage + compute layer. Trip data persistence via 0G Storage. Agent framework.
- **Reown AppKit** = Wallet connection + auth infrastructure. Users connect wallets and authenticate via SIWE. Not a payment rail.
- **Ledger** (stretch) = Hardware approval for high-value spends.

---

## System Architecture

```
 CLIENTS                          BACKEND                              AI LAYER
 ======                          =======                              ========

 +------------------+
 |  Web App         |            +-----------------------+
 |  (Next.js)       |---HTTP---->|                       |
 |  - WalletConnect |            |    Orchestrator       |
 |  - Voice (mic)   |            |    (FastAPI :8080)    |
 |  - Dashboard     |            |                       |
 +------------------+            |  Endpoints:           |
                                 |  POST /v1/auth/nonce  |            +---------------------+
 +------------------+            |  POST /v1/auth/verify |            |  Claude Code        |
 |  Android Auto    |---HTTP---->|  POST /v1/trips       |            |  Session (tmux)     |
 |  (Kotlin)        |            |  GET  /v1/trips       |            |                     |
 |  - Voice (mic)   |            |  POST /v1/voice/conv. |-----+      |  CLAUDE.md persona  |
 |  - Sessions      |            |  POST /v1/text/conv.  |     |      |                     |
 +------------------+            +-----------+-----------+     |      |  MCP Servers:       |
                                             |                 |      |  +- google-maps     |
                                             |                 |      |  +- weather         |
                                     +-------v-------+        |      |  +- treasury  ------+----> GroupTreasury.sol
                                     |  Voice VM     |        |      |  +- trip-memory     |      (Arc Testnet)
                                     |  (GPU)        |  +-----v----+ |  +- voice-channel   |
                                     |               |  | voice-   | |                     |
                                     | Whisper STT   |  | channel  | +---------------------+
                                     | Kokoro TTS    |  | (MCP     |
                                     |               |  |  :9000)  |
                                     +---------------+  +----------+
```

---

## Component Map

### 1. Smart Contracts (`contracts/`)

**What:** A Solidity smart contract (`GroupTreasury.sol`) deployed on Arc testnet (or local Anvil).

**What it does:**
- `createTrip(usdc, agent, spendLimit)` — Creates a new trip with an authorized AI agent wallet and per-transaction spend cap
- `deposit(tripId, amount)` — Members deposit USDC into the shared pool
- `spend(tripId, recipient, amount, category, description)` — Agent spends from the pool (only the authorized agent wallet can call this)
- `settle(tripId)` — Ends the trip, returns leftover USDC proportionally to depositors
- `emergencyWithdraw(tripId)` — Any member can pull their share at any time
- View functions: `getTrip`, `getBalance`, `getMembers`, `getSpends`, `getMemberDeposit`

**Key design:**
- USDC only (on Arc, USDC is the native gas token — no ETH needed)
- Every spend emits on-chain events with category and description
- The agent wallet address is set at trip creation and cannot be changed
- 14 Foundry tests covering all functions and edge cases

**Files:**
- `contracts/src/GroupTreasury.sol` — The contract (190 lines)
- `contracts/test/GroupTreasury.t.sol` — Tests with MockUSDC (170 lines)
- `contracts/script/Deploy.s.sol` — Foundry deploy script

---

### 2. MCP Servers (`mcp-servers/`)

**What:** Custom MCP (Model Context Protocol) servers that give the Claude Code AI agent its capabilities. These are TypeScript processes that run alongside the Claude Code session and expose tools the AI can call.

#### Treasury MCP (`mcp-servers/treasury/`)

Wraps the GroupTreasury smart contract via `viem`. The AI agent calls these tools to manage the group's money.

| Tool | What it does |
|------|-------------|
| `treasury_balance` | Returns pool balance, per-member deposits, spend limit, trip status |
| `treasury_spend` | Sends USDC from the pool to a recipient (calls the contract's `spend` function) |
| `treasury_history` | Returns all past spends with category, description, amount, timestamp |

**How it works:** Uses `viem` to create a public client (for reads) and a wallet client (for writes, using the agent's private key). Connects to the RPC endpoint for the blockchain where the contract is deployed.

**Env vars:** `RPC_URL`, `TREASURY_ADDRESS`, `AGENT_PRIVATE_KEY`, `CHAIN_ID`

#### Trip Memory MCP (`mcp-servers/trip-memory/`)

Persists trip data to local JSON files (with 0G Storage as future decentralized backend).

| Tool | What it does |
|------|-------------|
| `save_trip_data` | Save any JSON data under a key (e.g., "preferences", "itinerary") |
| `load_trip_data` | Retrieve saved data by key |
| `list_trip_keys` | List all saved keys for a trip |

**How it works:** Each trip gets a directory (`trip-data/trip-{id}/`), each key is a JSON file. Simple and hackathon-appropriate.

---

### 3. Orchestrator (`orchestrator/`)

**What:** A FastAPI backend that serves as the central hub. All clients (web, Android Auto) talk to this.

#### Auth Flow (SIWE / WalletConnect)

```
Client                          Orchestrator
  |                                  |
  |--- GET /v1/auth/nonce ---------> |  Returns a random nonce
  |                                  |
  |  (client signs SIWE message      |
  |   with wallet)                   |
  |                                  |
  |--- POST /v1/auth/verify -------> |  Verifies signature,
  |    {message, signature}          |  creates session token
  |                                  |
  |<-- {token, wallet_address} ------|
  |                                  |
  |  (all subsequent requests use    |
  |   Authorization: Bearer <token>) |
```

No passwords, no accounts. Your wallet IS your identity. The orchestrator uses `eth_account` to recover the signer address from the SIWE signature.

#### Trip Management

| Endpoint | Auth | What |
|----------|------|------|
| `POST /v1/trips` | Yes | Create a new trip (name, spend limit) |
| `GET /v1/trips` | Yes | List trips the wallet is a member of |
| `GET /v1/trips/:id` | Yes | Get trip details + members |
| `POST /v1/trips/:id/join` | Yes | Join an existing trip |

Trip data is stored in SQLite (`data/roadtrip.db`). Tables: `users`, `trips`, `trip_members`, `conversations`.

#### Voice Pipeline

This is the core magic — voice in, AI response out.

```
                     Voice Pipeline (one request)
                     ============================

Client sends audio WAV
        |
        v
+--[Orchestrator]--+
|                  |
|  1. Send WAV to  |        +--[Voice VM (GPU)]--+
|     Voice VM  ---|------->| Whisper STT        |
|                  |<-------| Returns: "find me  |
|  user_transcript |        |  somewhere to eat" |
|                  |        +--------------------+
|  2. Send text to |
|     voice-channel|------->+--[voice-channel :9000]--+
|                  |        | MCP notification to     |
|                  |        | Claude Code session     |
|                  |        +----------+--------------+
|                  |                   |
|                  |                   v
|                  |        +--[Claude Code]----------+
|                  |        | Reads CLAUDE.md persona  |
|                  |        | Calls MCP tools:         |
|                  |        |   maps_search_places()   |
|                  |        |   treasury_balance()     |
|                  |        | Calls voice_reply() with |
|                  |        | spoken response          |
|                  |        +--------------------------+
|                  |                   |
|  3. Get response |<------------------+
|     from channel |
|                  |
|  4. Send text to |        +--[Voice VM (GPU)]-------+
|     Voice VM TTS |------->| Kokoro TTS              |
|                  |<-------| Returns: WAV audio      |
|  response_audio  |        +-------------------------+
|                  |
|  5. Return WAV   |
+-------+----------+
        |
        v
Client plays audio
```

#### Text Pipeline (fallback)

For when mic isn't available (or for the web text input):

```
POST /v1/text/converse {text: "how's our budget?", trip_id: 1}
  -> voice-channel -> Claude Code -> voice_reply -> JSON response
```

---

### 4. AI Agent (`agent/`)

**What:** A Claude Code session configured as a road trip co-pilot.

**CLAUDE.md** defines the agent's personality:
- Concise, spoken responses (1-3 sentences, no markdown)
- Proactive suggestions (cheap gas, weather, break reminders)
- Budget-aware spending (checks balance before suggesting expensive options)
- Category tracking (every spend tagged as food/gas/lodging/activities)

**.mcp.json** loads 4 MCP servers into the session:

| MCP Server | Tools | Source |
|-----------|-------|--------|
| `google-maps` | `maps_search_places`, `maps_place_details`, `maps_directions`, `maps_distance_matrix` | Official Anthropic MCP (`@modelcontextprotocol/server-google-maps`) |
| `weather` | `get_forecast`, `get_alerts` | Official Anthropic MCP (`@modelcontextprotocol/server-weather`) |
| `treasury` | `treasury_balance`, `treasury_spend`, `treasury_history` | Custom (`mcp-servers/treasury/`) |
| `trip-memory` | `save_trip_data`, `load_trip_data`, `list_trip_keys` | Custom (`mcp-servers/trip-memory/`) |

Plus the **voice-channel** MCP loaded at Claude Code startup, which provides the `voice_reply` tool.

**Example interaction:**
1. User says: "Find us somewhere to eat under $15"
2. Claude calls `maps_search_places({type: "restaurant", radius: 5000})`
3. Claude calls `treasury_balance({trip_id: 0})` to check budget
4. Claude calls `voice_reply({text: "There's a great taco place 10 minutes ahead, $12 average. Want me to route there?"})`
5. User says: "Yeah book it"
6. Claude calls `treasury_spend({trip_id: 0, amount_usd: 36, category: "food", description: "3x tacos at Rosa's"})`
7. Claude calls `voice_reply({text: "Done. Paid thirty-six bucks from the pool. Food budget is at eighty of two hundred."})`

---

### 5. Web Frontend (`web/`)

**What:** Next.js app with Reown AppKit (WalletConnect) for wallet-based auth.

**Pages:**
- `/` — Landing page with "Give your car a wallet" hero + Connect Wallet button + trip creation form + trip list
- `/trip/[id]` — Trip dashboard with treasury stats, spending feed, voice interface

**Components:**

| Component | What |
|-----------|------|
| `ConnectButton` | Reown AppKit wallet connect/disconnect |
| `CreateTrip` | Form: trip name + spend limit + create button |
| `TreasuryDashboard` | Pool balance, total deposited/spent, member count, spend limit, budget progress bar, deposit form |
| `SpendingFeed` | List of on-chain transactions from the treasury (reads `getSpends` from contract) |
| `VoiceInterface` | Push-to-talk mic recording + text input fallback + message history |

**Contract integration** (`lib/treasury.ts`): Wagmi hooks wrapping every GroupTreasury view function + deposit flow (approve USDC + deposit).

**API client** (`lib/api.ts`): Fetch wrapper for orchestrator endpoints with Bearer token auth.

---

### 6. Android Auto Integration (from claude-superapp)

**What:** The existing Claude-Auto Kotlin app from `claude-superapp` can be pointed at this orchestrator. It already implements:
- Audio recording (WAV) from car microphone
- Submit/poll pattern for voice converse (`POST /v1/voice/converse`)
- Audio playback through car speakers
- Session management (create, activate, stop)
- Detail level selection (overview/standard/detailed)

**What needs to change for road trip app:**
- Point `ClaudeApiClient` at the new orchestrator URL
- Add WalletConnect mobile wallet connection (or use the existing Bearer token auth initially)
- Add a trip selection screen (list trips, pick active trip)
- Pass `trip_id` in the converse request

The Android Auto app communicates with the **same orchestrator** and **same voice pipeline** as the web app. The only difference is the client UI.

---

## Data Flow Diagrams

### Flow 1: User Creates Trip & Deposits

```
Web App                    Orchestrator              Blockchain (Arc)
  |                             |                         |
  |-- Connect Wallet (Reown) -->|                         |
  |<-- SIWE nonce --------------|                         |
  |-- Sign & verify ----------->|                         |
  |<-- Session token -----------|                         |
  |                             |                         |
  |-- POST /v1/trips ---------->|                         |
  |   {name, spend_limit}      |-- (store in SQLite) --->|
  |<-- {trip_id} ---------------|                         |
  |                             |                         |
  |-- USDC.approve(treasury) ---|------------------------>|
  |-- treasury.deposit(id,amt) -|------------------------>|
  |                             |                    [USDC moves to
  |                             |                     contract pool]
  |                             |                         |
  |<-- Event: MemberJoined -----|<------------------------|
```

### Flow 2: Voice Command Triggers Payment

```
Car Mic / Web Mic          Orchestrator          Voice VM        Claude Code         Blockchain
     |                         |                    |                 |                   |
     |-- WAV audio ----------->|                    |                 |                   |
     |                         |-- WAV to STT ----->|                 |                   |
     |                         |<-- "pay for gas" --|                 |                   |
     |                         |                    |                 |                   |
     |                         |-- text to -------->|-- MCP notify -->|                   |
     |                         |   voice-channel    |                 |                   |
     |                         |                    |                 |-- treasury_spend ->|
     |                         |                    |                 |   (smart contract) |
     |                         |                    |                 |<-- tx receipt -----|
     |                         |                    |                 |                   |
     |                         |                    |<-- voice_reply -|                   |
     |                         |<-- response text --|                 |                   |
     |                         |                    |                 |                   |
     |                         |-- text to TTS ---->|                 |                   |
     |                         |<-- WAV audio ------|                 |                   |
     |                         |                    |                 |                   |
     |<-- WAV audio response --|                    |                 |                   |
     |   (plays through        |                    |                 |                   |
     |    car speakers)        |                    |                 |                   |
```

### Flow 3: Trip Settlement

```
Any Member (Web)           Orchestrator              Blockchain (Arc)
     |                         |                         |
     |-- treasury.settle(id) --|------------------------>|
     |                         |                    [Contract calculates
     |                         |                     proportional shares,
     |                         |                     returns USDC to each
     |                         |                     depositor]
     |                         |                         |
     |<-- Event: TripSettled --|<------------------------|
     |                         |                         |
     |  (Dashboard shows final |                         |
     |   breakdown per person) |                         |
```

---

## What's Deployed vs What Runs Locally

| Component | Where it runs | Status |
|-----------|--------------|--------|
| GroupTreasury.sol | Local Anvil (chainId 31337) or Arc testnet | Deployed locally, 14 tests pass |
| Orchestrator | Local (`:8080`) | Running, 15 tests pass |
| Voice VM (STT/TTS) | GCE GPU VM (existing from claude-superapp) | Already deployed |
| voice-channel | Local (`:9000`) or App VM | Reused from claude-superapp |
| Treasury MCP | Local (stdio, launched by Claude Code) | Built, deps installed |
| Trip Memory MCP | Local (stdio, launched by Claude Code) | Built, deps installed |
| Web Frontend | Local (`:3000`) | Builds successfully (Next.js) |
| Android Auto App | Android device/emulator | Existing app from claude-superapp, needs minor modifications |

---

## Testing Guide

### Smart Contracts
```bash
cd contracts
forge test -vvv          # Run all 14 tests
forge test --match-test test_spend  # Run specific test
```

### Orchestrator
```bash
cd orchestrator
source .venv/bin/activate
pytest tests/ -v         # Run all 15 tests
pytest tests/test_auth.py -v  # Auth tests only
pytest tests/test_trips.py -v # Trip + health tests
```

### Web Frontend
```bash
cd web
npm run dev              # Start dev server at :3000
npm run build            # Production build (verify no errors)
```

### MCP Servers (smoke test)
```bash
# Treasury MCP — starts and responds to MCP initialize
cd mcp-servers/treasury && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 bun index.ts

# Trip Memory MCP — same pattern
cd mcp-servers/trip-memory && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 bun index.ts
```

### Full E2E Test (manual)
1. Start Anvil: `cd contracts && anvil`
2. Deploy: `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast`
3. Note the deployed address from the output
4. Start orchestrator: `cd orchestrator && uvicorn main:app --port 8080`
5. Start web: `cd web && npm run dev`
6. Open http://localhost:3000
7. Connect wallet (MetaMask pointed at localhost:8545)
8. Create trip, deposit USDC, test voice/text interface

---

## File Tree (source files only)

```
ethglobal/
+-- contracts/
|   +-- src/GroupTreasury.sol          # Smart contract (190 lines)
|   +-- test/GroupTreasury.t.sol       # Foundry tests (170 lines)
|   +-- script/Deploy.s.sol           # Deploy script
|   +-- foundry.toml                  # Foundry config
|
+-- mcp-servers/
|   +-- treasury/
|   |   +-- index.ts                  # Treasury MCP server
|   |   +-- abi.ts                    # Contract ABI
|   |   +-- package.json
|   +-- trip-memory/
|       +-- index.ts                  # Trip memory MCP server
|       +-- package.json
|
+-- orchestrator/
|   +-- main.py                       # FastAPI app (voice pipeline, auth endpoints, trip routes)
|   +-- auth.py                       # SIWE wallet auth (nonce, verify, sessions)
|   +-- trips.py                      # Trip CRUD endpoints
|   +-- db.py                         # SQLite database layer
|   +-- requirements.txt
|   +-- tests/
|       +-- test_auth.py              # Auth tests (7 tests)
|       +-- test_trips.py             # Trip + health tests (8 tests)
|       +-- conftest.py               # Test fixtures (temp DB)
|
+-- web/
|   +-- src/
|   |   +-- app/
|   |   |   +-- layout.tsx            # Root layout with AppKit provider
|   |   |   +-- page.tsx              # Landing: "Give your car a wallet" + trip management
|   |   |   +-- trip/[id]/page.tsx    # Trip dashboard
|   |   +-- components/
|   |   |   +-- ConnectButton.tsx     # WalletConnect button
|   |   |   +-- CreateTrip.tsx        # Trip creation form
|   |   |   +-- TreasuryDashboard.tsx # Balance, deposits, budget progress
|   |   |   +-- SpendingFeed.tsx      # Transaction history from contract
|   |   |   +-- VoiceInterface.tsx    # Push-to-talk + text chat
|   |   +-- lib/
|   |   |   +-- wagmi.ts             # Chain config (Anvil / Arc testnet)
|   |   |   +-- appkit.tsx           # Reown AppKit provider setup
|   |   |   +-- treasury.ts          # Wagmi hooks for GroupTreasury contract
|   |   |   +-- api.ts               # Orchestrator API client
|   |   +-- abi/
|   |       +-- GroupTreasury.json    # Contract ABI (from Foundry build)
|   +-- next.config.ts
|   +-- package.json
|
+-- agent/
|   +-- CLAUDE.md                     # AI agent persona and behavior rules
|   +-- .mcp.json                     # MCP server configuration
|
+-- docs/
    +-- ARCHITECTURE.md               # This file
    +-- superpowers/
        +-- specs/...                 # Design spec
        +-- plans/...                 # Implementation plan
```
