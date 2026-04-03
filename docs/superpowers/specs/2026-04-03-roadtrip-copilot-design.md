# RoadTrip Co-Pilot — Design Spec

**Date:** 2026-04-03
**Event:** ETHGlobal Cannes 2026 (April 3-5)
**Status:** Approved (v2 — revised)

---

## Overview

**"Give your car a wallet."**

RoadTrip Co-Pilot is a voice-first AI agent for group road trips. Friends pool USDC into a shared on-chain treasury. A Claude-powered AI agent manages the trip from the car: finds stops, recommends options, and autonomously spends from the pool. Users connect via WalletConnect — the same wallet that funds the trip also authenticates the user, replacing traditional logins. All trip data persisted on 0G Storage.

### The Narrative: Give Your Car a Wallet

Your car has eyes (cameras), ears (microphones), a brain (AI) — but no wallet. It can't pay for gas, tolls, parking, or food. You have to stop, pull out your phone, open an app, tap buttons.

RoadTrip Co-Pilot gives your car a crypto wallet. The AI agent holds a group treasury loaded with USDC. When you say "fill up the tank" or "book a hotel," the car pays — instantly, on-chain, from a shared pool. No apps, no tapping, no "who owes who." Just talk and go.

This is what the agentic economy looks like when it meets the open road.

### Core Value Proposition

No road trip app today bridges pre-trip planning and in-motion driving. Users juggle 5-7 apps (Google Maps, Waze, GasBuddy, Roadtrippers, Yelp, TripIt, Venmo). RoadTrip Co-Pilot collapses all of this into a single voice-first AI agent that plans, books, pays, and splits — autonomously.

The crypto layer solves the group money problem: shared treasury with transparent spending, automatic splitting, and on-chain receipts. No more "who owes who" after the trip.

---

## Target Sponsors

### How Arc and WalletConnect Fit Together — The Clean Split

Arc and WalletConnect are **complementary layers** with a clean boundary:

- **WalletConnect** = the **human UX layer**. Everything a human touches: connecting wallets, depositing funds into the car's wallet, approving large spends. WalletConnect Pay handles merchant payments that need human approval (hotel bookings, big restaurant bills).
- **Arc nanopayments** = the **autonomous agent layer**. Everything the AI agent does without human intervention: paying tolls, parking, small fares, API data calls. These are gas-free streaming micro-transactions that would be terrible UX if they required a wallet popup each time.

The split is about **who initiates the payment**:
- Human initiates → WalletConnect (deposit, approve, tap-to-pay)
- Agent initiates autonomously → Arc nanopayments (parking, fares, tolls, data APIs)

Together: Users fund the car's wallet via WalletConnect → treasury on Arc holds the pool → agent streams nanopayments from the pool for pre-approved categories (no human needed) → large spends go through WalletConnect approval flow.

### Sponsor Map

| Tier | Sponsor | Track | Prize | Role in App |
|------|---------|-------|-------|-------------|
| 1 | **Arc** | Best Agentic Economy with Nanopayments | $6K | **Primary Arc track.** Agent streams autonomous gas-free nanopayments for parking, fares, tolls, API data — anything pre-approved, no human needed |
| 1 | **Arc** | Best Smart Contracts with Advanced Stablecoin Logic | $3K | Secondary: treasury contract qualifies naturally (escrow, budgets, voting, settlement) |
| 1 | **WalletConnect** | Best Use of WalletConnect Pay | $4K | Human UX: deposits into car wallet, approval flow for big spends, spending/budgeting dashboard |
| 1 | **WalletConnect** | Best App Built with Reown SDK | $1K | Wallet-based auth (replacing API keys), multi-chain wallet connection |
| 1 | **0G** | Best OpenClaw Agent on 0G | $6K | Agent framework + trip data on 0G Storage/Compute |
| 2 | **Ledger** | AI Agents x Ledger | $6K | Hardware approval for high-value group spends |
| | | **Total potential** | **$26K** | |

### Deliverables per Sponsor

- **Arc (Track 3 — Agentic Nanopayments, primary):** Functional MVP, architecture diagram, video demo, GitHub repo. Deploy on Arc testnet. Show agent streaming gas-free nanopayments for parking/fares/tolls/data APIs autonomously. Use Circle developer tools (USDC, Nanopayments, x402, Programmable Wallets).
- **Arc (Track 1 — Stablecoin Logic, secondary):** Same deliverables — the treasury contract qualifies naturally.
- **WalletConnect:** Public GitHub repo, demo video (<=3 min). Use Reown AppKit for wallet auth + deposits. WalletConnect Pay for human-approved spend flows (big purchases needing group vote). Obtain WCPay ID from dashboard.walletconnect.com.
- **0G:** Project name/description, contract addresses, public GitHub repo with README, demo video (<=3 min). Integrate 0G Storage + optionally Compute.
- **Ledger:** Build agent with Ledger as trust layer for device-backed approval of high-value transactions.

---

## Feature 1: Group Trip Treasury

### What It Is

A shared on-chain smart contract on Arc where friends pool USDC for a road trip. USDC is Arc's native gas token, so there's no separate gas token to manage — everything is USDC. The contract enforces spending rules, tracks every expense by category and person, and automatically settles when the trip ends.

### User Flow

**1. Trip Creation**

The trip organizer creates a trip in the web app:
- Trip name
- Estimated total budget
- Spending categories: gas, food, lodging, activities
- Per-transaction auto-spend limit (e.g., $100 — agent can spend up to this without group approval)
- Daily spending cap (optional)

**2. Wallet-Based Login (WalletConnect replaces API keys)**

No username/password. No API keys. Users authenticate by connecting their wallet via Reown AppKit (WalletConnect). The connected wallet address IS the user identity. This replaces the nginx Bearer token auth from the existing claude-superapp architecture.

Flow:
- User clicks "Connect Wallet" → Reown AppKit modal → scans QR or selects wallet
- Wallet signature proves ownership (Sign-In with Ethereum / SIWE)
- Session token issued, tied to wallet address
- All subsequent API calls authenticated via this session

**3. Depositing Funds**

Each friend:
- Connects wallet via WalletConnect (this also logs them in)
- Deposits their USDC share into the group pool on Arc
- If their USDC is on another chain, Arc's Gateway/CCTP bridges it seamlessly (chain abstraction)

All members see the pool fill up in real-time.

**4. During the Trip**

- Pool balance always visible in the app
- Every agent spend appears as a line item: what, where, when, amount, category
- Running per-person consumption tracked: "Alice: $127, Bob: $94, Carol: $156"
- Category budget burn shown: "Food: $210 / $400, Gas: $89 / $200"

**5. Trip End / Settlement**

- Any member triggers "end trip"
- Leftover USDC returned proportionally to depositors
- Full spending breakdown exported (per person, per category)
- On-chain receipt history permanently queryable on Arc

### Smart Contract Logic (Solidity, deployed on Arc testnet)

- **Deposits:** USDC only (native on Arc — no approval needed, direct transfer)
- **Spending rules:** Per-transaction cap, daily cap, category budgets — configurable at trip creation
- **Agent authorization:** Only the designated agent wallet can initiate spends
- **Group voting:** Spends exceeding the auto-limit trigger a vote. Configurable threshold (majority/unanimous)
- **Emergency withdrawal:** Any member can pull their remaining proportional share at any time
- **On-chain receipts:** Every transaction emits events with: amount, recipient, category, timestamp, description

### Sponsor Mapping

- **Arc (Stablecoin Logic — secondary track):** Conditional USDC escrow with programmable settlement rules
- **WalletConnect (Reown SDK):** Wallet-based authentication + wallet connection for deposits into the car's wallet
- **WalletConnect (Pay):** Human-facing UX for approving large spends from the treasury dashboard

---

## Feature 2: Voice AI Agent with Autonomous Spending

### What It Is

A Claude-powered AI agent running as a persistent Claude Code session (reusing the existing claude-superapp voice pipeline). The agent has custom MCP tools for places search, route planning, treasury management, and payments. Users talk to it — it finds stops, recommends options, and pays from the group pool via WalletConnect Pay on Arc.

### Agent Tools (MCP Servers + Custom Tools)

The agent gets its capabilities through MCP servers and custom tools loaded into the Claude Code session:

**MCP Server: Google Maps (`mcp-google-map`)**
- Existing open-source MCP server: `github.com/cablate/mcp-google-map`
- Tools: `search_places`, `get_place_details`, `get_directions`, `search_nearby`, `search_text`
- Requires: `GOOGLE_MAPS_API_KEY` env var
- Gives the agent real place search, directions, and POI data

**MCP Server: EVM/Blockchain (`evm-mcp-server`)**
- Existing open-source: `github.com/mcpdotdirect/evm-mcp-server`
- Tools: `get_balance`, `read_contract`, `send_transaction`, `get_token_balance`
- Gives the agent ability to read treasury state, check balances, interact with smart contracts

**Custom MCP Server: Trip Treasury**
- Build custom — wraps the treasury smart contract in ergonomic tools
- Tools:
  - `treasury_balance` — current pool balance, per-person spend, category budgets
  - `treasury_spend` — initiate a USDC payment from the pool (calls contract + WalletConnect Pay)
  - `treasury_history` — recent transactions from the pool
  - `group_vote_request` — trigger a vote for spends over the limit
  - `group_vote_status` — check vote results

**Custom MCP Server: Trip Memory (0G Storage)**
- Build custom — wraps 0G Storage SDK
- Tools:
  - `save_trip_data` — persist itinerary, preferences, conversation context to 0G
  - `load_trip_data` — retrieve persisted data
  - `save_trip_photo` — store trip photos/media on 0G

**Voice Channel (existing from claude-superapp)**
- `voice_reply` tool — sends spoken response back through the TTS pipeline
- Already implemented in the voice-channel MCP server

### Integration with Existing claude-superapp

The voice pipeline is reused from the existing architecture:

```
Web App (browser mic) OR Android Auto
        |
  [orchestrator :8080] ── FastAPI (reused, modified)
     /        |
[Voice VM]    |
 (GPU VM)     |
 Whisper STT  |
 Kokoro TTS   |
              |
    [voice-channel :9000] (reused as-is)
              |
     [Claude Code session] ── persistent tmux
       with MCP servers:
       ├── mcp-google-map (places, directions)
       ├── evm-mcp-server (blockchain reads)
       ├── trip-treasury-mcp (custom, spending)
       ├── trip-memory-mcp (custom, 0G storage)
       └── voice-channel (voice reply)
```

**What changes from claude-superapp:**
- **Orchestrator:** Replace nginx Bearer token auth with WalletConnect/SIWE session auth. Add trip management endpoints (`/v1/trip/create`, `/v1/trip/join`, `/v1/trip/deposit`, etc.).
- **Claude Code session:** Load with road trip co-pilot CLAUDE.md persona + the MCP servers above. Different system prompt and skills.
- **voice-channel:** Reuse as-is. The MCP notification pattern is identical.
- **Voice VM:** Reuse as-is. Already deployed. STT + TTS unchanged.
- **Frontend:** Build new web app for trip dashboard + voice interface (browser mic → orchestrator → voice pipeline).

### User Flow

**1. Passive Monitoring**

While driving, the agent monitors the route silently. It knows:
- Current GPS location (sent from browser/phone)
- Remaining route and ETA
- Group preferences (dietary restrictions, budget sensitivity)
- Treasury balance and budget status
- Weather conditions ahead

**2. Proactive Suggestions**

The agent speaks up when it detects an opportunity:
- "There's a highly-rated diner 2 miles off the highway — burgers, $12 average."
- "Gas is $3.20 here but $2.89 at the next exit."
- "Rain starting in 45 minutes on your route."

**3. Voice Commands**

Users speak naturally:
- "Find us somewhere to eat under $15 per person" → agent calls `search_places` MCP tool
- "How much have we spent on food today?" → agent calls `treasury_balance` MCP tool
- "Book that restaurant" → agent calls `treasury_spend` MCP tool

**4. Autonomous Spending via Arc Nanopayments (under limit, no human needed)**

For pre-approved categories under the auto-spend limit — parking, tolls, fares, data APIs:
- "I topped up the toll pass — $4.50 from the pool."
- Agent streams a gas-free nanopayment on Arc → on-chain receipt emitted
- No wallet popup, no human approval, no UX friction — the agent just pays
- Dashboard updates in real-time
- This is the **Arc Track 3 (Agentic Nanopayments)** integration

**5. Group Approval Flow via WalletConnect (over limit, human approves)**

For larger purchases that exceed the auto-spend limit:
- Agent calls `group_vote_request` → notifications sent to members
- Members approve via WalletConnect-connected wallets on their phones
- Agent calls `treasury_spend` after approval threshold met
- This is the **WalletConnect Pay** integration — human-facing UX for big decisions

### 0G Integration

- **0G Storage:** Trip conversation history, user preferences, itinerary state persisted via `trip-memory-mcp`. Survives session restarts. Queryable across devices.
- **0G Compute:** If needed, offload heavy tasks (route optimization, trip report generation)
- **OpenClaw framing:** The agent is positioned as an OpenClaw-style agent running on 0G infrastructure. Claude is the LLM backend, 0G provides storage and compute.

### Arc Integration — The Autonomous Agent Layer (Track 3: Agentic Nanopayments)

Arc handles everything the agent does without human involvement:

- **Nanopayments for pre-approved spending:** Agent streams gas-free USDC payments for parking ($3), tolls ($5), fares ($8), small food purchases ($12) — anything under the auto-spend limit. No wallet popup, no gas cost, no UX friction. This is economically impossible on Ethereum (gas > payment) but trivial on Arc.
- **Nanopayments for data APIs (x402):** Agent pays $0.001-$0.01 per API call for gas prices, weather, restaurant data — the agent buys its own intelligence from the treasury.
- **Treasury contract on Arc testnet:** USDC is native gas token — one token for everything. Sub-second finality means dashboard updates instantly.
- **Agent identity (ERC-8004):** Verifiable on-chain identity for the AI agent — reputation and trust.

Arc does NOT handle: wallet connection, user authentication, or human-approved payments. Those go through WalletConnect.

### WalletConnect Integration — The Human UX Layer

WalletConnect handles everything a human touches:

- **Auth:** Reown AppKit for wallet-based login (replaces API keys) — this IS how you log in
- **Deposits:** WalletConnect is how users fund the car's wallet — connect wallet, deposit USDC from any chain
- **Approvals:** WalletConnect Pay for human-approved spend flows — hotel bookings, big restaurant bills, anything over the auto-spend limit that needs a group vote
- **Dashboard:** Spending/budgeting UX where users see where their money went
- **Multi-chain:** Reown AppKit supports EVM + Solana — friends aren't excluded by chain choice

WalletConnect does NOT handle: autonomous agent micro-transactions (parking, tolls, fares). Those go through Arc nanopayments — no wallet popup, no human in the loop.

---

## 3-Minute Demo Flow

**Narrative: "What if your car had a wallet?"**

1. **Hook (15s):** "Your car has cameras, microphones, and AI. But it can't pay for anything. We're giving it a wallet."

2. **Wallet Login (20s):** Show 3 friends each connecting wallet via WalletConnect QR scan — no passwords, no accounts. The wallet IS your identity.

3. **Funding the car (20s):** Each friend deposits $200 USDC into the group pool on Arc. Pool shows $600 balance. "The car now has $600 to spend."

4. **Autonomous nanopayments — the car just pays (30s):** Agent: "Toll ahead — $4.50." Show Arc nanopayment: gas-free, instant, no popup, no approval. Then: "Parking at the restaurant — $6." Another nanopayment streams automatically. Dashboard updates live. "The car handles parking, tolls, and fares on its own — no apps, no tapping."

5. **The drive + food (30s):** Agent speaks: "There's a great BBQ place 2 miles off your route — 4.6 stars, $14 average." User says "Yeah, go ahead." Agent: "Ordered 3 pulled pork combos — $38.50 from the pool." Nanopayment on Arc. Dashboard updates. "Under the auto-limit, so the car just paid."

6. **Budget awareness (15s):** "How's our budget?" Agent: "Spent $127 of $600. Food: $72 of $200. Gas: $55 of $150. Parking & tolls: $18 of $50. You're on track."

7. **Group approval via WalletConnect (20s):** Agent: "Found a hotel for tonight — $220. This exceeds your $100 limit. Sent a vote." Show 2 of 3 approving on their phones via WalletConnect. "Big decisions need human approval. Small stuff, the car handles."

8. **Settlement (15s):** Trip ends → auto-settle → $253 returned proportionally. Full breakdown on-chain.

9. **Closing (15s):** "Give your car a wallet. RoadTrip Co-Pilot — built on Arc, WalletConnect, 0G, and Claude."

---

## Technical Decisions

### Reused from claude-superapp (already deployed, working)

| Component | What | Port |
|-----------|------|------|
| Voice VM (GPU) | Whisper STT + Kokoro TTS | GPU VM, internal IP |
| voice-channel | MCP bridge: HTTP ↔ Claude Code session | :9000 |
| Session manager | tmux lifecycle for Claude Code sessions | :9001 |
| Orchestrator (base) | FastAPI voice pipeline | :8080 |

### Modified from claude-superapp

| Component | Changes |
|-----------|---------|
| Orchestrator | Replace Bearer auth with WalletConnect/SIWE. Add trip endpoints. Add MCP server launch. |
| Claude Code session | New CLAUDE.md persona. Load MCP servers for maps, blockchain, treasury, 0G. |

### Built new

| Component | Tech |
|-----------|------|
| Smart contracts | Solidity on Arc testnet. GroupTreasury.sol. |
| Web frontend | React/Next.js. Reown AppKit for wallet. Voice UI via browser mic. |
| Trip Treasury MCP | TypeScript MCP server wrapping treasury contract |
| Trip Memory MCP | TypeScript MCP server wrapping 0G Storage SDK |
| WalletConnect Pay integration | Human-facing deposit + approval UX via Reown AppKit + Pay SDK |
| Arc Nanopayments integration | x402/nanopayments for agent autonomous micro-transactions |

### Chain: Arc Testnet

- EVM-compatible — standard Solidity, standard tooling (Hardhat/Foundry)
- USDC is native gas token — gas-free nanopayments make $0.50 parking payments viable
- Sub-second finality — great for live demo
- Circle developer tools: Nanopayments, x402, Programmable Wallets, Gateway

---

## Out of Scope (for hackathon)

- Android Auto / CarPlay native integration
- Offline mode
- EV/charging intelligence
- Entertainment/playlist curation
- Post-trip memory NFTs / POAPs
- DAO governance / token incentives
- Parametric insurance (Chainlink)
- World ID verification (removed — overkill for MVP)
- Multi-day itinerary auto-planning
- AR overlays
- Physical crypto card integration

---

## Success Criteria

1. Working demo where voice commands trigger real on-chain USDC payments from a group pool on Arc
2. Wallet-based auth + deposits via WalletConnect (no passwords, no API keys)
3. Agent autonomously streams nanopayments on Arc for parking, fares, tolls (no human approval)
4. Large spends trigger group approval via WalletConnect (human UX for big decisions)
5. Agent has MCP tools for places search, treasury management, and 0G storage
6. Real-time treasury dashboard showing balance, splits, and spending categories
7. Judges can understand "give your car a wallet" in under 30 seconds
8. Submissions accepted for Arc (Track 3 primary + Track 1 secondary), WalletConnect (2 tracks), 0G, and optionally Ledger
