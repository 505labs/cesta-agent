# RoadTrip Co-Pilot — Design Spec

**Date:** 2026-04-03
**Event:** ETHGlobal Cannes 2026 (April 3-5)
**Status:** Approved

---

## Overview

RoadTrip Co-Pilot is a voice-first AI agent for group road trips. Friends pool USDC into a shared on-chain treasury. An OpenClaw-powered AI agent (Claude brain) manages the trip: finds stops, recommends options, and autonomously spends from the pool. Human-verified via World ID. All trip data persisted on 0G Storage.

### Core Value Proposition

No road trip app today bridges pre-trip planning and in-motion driving. Users juggle 5-7 apps (Google Maps, Waze, GasBuddy, Roadtrippers, Yelp, TripIt, Venmo). RoadTrip Co-Pilot collapses all of this into a single voice-first AI agent that plans, books, pays, and splits — autonomously.

The crypto layer solves the group money problem: shared treasury with transparent spending, automatic splitting, and on-chain receipts. No more "who owes who" after the trip.

---

## Target Sponsors

| Tier | Sponsor | Track | Prize | Role |
|------|---------|-------|-------|------|
| 1 | **Arc** | Agentic Economy with Nanopayments | $6K | Agent pays for trip expenses via USDC nanopayments |
| 1 | **Arc** | Smart Contracts with Advanced Stablecoin Logic | $3K | Group escrow contract with conditional spending rules |
| 1 | **World** | Best use of Agent Kit | $8K | Human-verified AI agent identity on every transaction |
| 1 | **0G** | Best OpenClaw Agent on 0G | $6K | Agent framework + trip data on 0G Storage |
| 2 | **WalletConnect** | Best Use of WalletConnect Pay | $4K | Wallet connection for deposits + spending UX |
| 2 | **Ledger** | AI Agents x Ledger | $6K | Hardware approval for high-value group spends |
| | | **Total potential** | **$33K** | |

### Deliverables per Sponsor

- **Arc:** Functional MVP, architecture diagram, video demo, GitHub repo
- **World:** Public GitHub repo, demo video (<=3 min), functional demo (no hard-coded values)
- **0G:** Project name/description, contract deployment addresses, public GitHub repo with README, demo video (<=3 min)
- **WalletConnect:** Public GitHub repo, demo video
- **Ledger:** Contact Ledger developers for specific requirements

---

## Feature 1: Group Trip Treasury

### What It Is

A shared on-chain smart contract where friends pool USDC for a road trip. The contract enforces spending rules, tracks every expense by category and person, and automatically settles when the trip ends.

### User Flow

**1. Trip Creation**

The trip organizer creates a trip in the app, setting:
- Trip name
- Estimated total budget
- Number of members
- Spending categories: gas, food, lodging, activities
- Per-transaction auto-spend limit (e.g., $100 — agent can spend up to this without group approval)
- Daily spending cap (optional)

**2. Inviting Friends**

The organizer shares an invite link. Each friend:
- Connects their wallet via WalletConnect
- Verifies their identity via World ID
- Deposits their USDC share into the pool

All members see the pool fill up in real-time. Only World ID-verified members can join.

**3. During the Trip**

- Pool balance is always visible in the app
- Every agent spend appears as a line item: what, where, when, amount, category
- Running per-person consumption is tracked: "Alice: $127, Bob: $94, Carol: $156"
- Category budget burn shown: "Food: $210 / $400, Gas: $89 / $200"

**4. Trip End / Settlement**

- Organizer or any member triggers "end trip"
- Leftover USDC is returned proportionally to depositors
- Full spending breakdown exported (per person, per category)
- On-chain receipt history remains permanently queryable

### Smart Contract Logic

- **Deposits:** USDC only (simplicity over flexibility)
- **Spending rules:** Per-transaction cap, daily cap, category budgets — all configurable at trip creation
- **Authorization:** Only the AI agent can initiate spends, and the agent must carry World ID proof that verified humans authorized it
- **Group voting:** Spends exceeding the auto-limit trigger a vote. Configurable threshold (e.g., majority, unanimous)
- **Emergency withdrawal:** Any member can pull their remaining proportional share at any time
- **On-chain receipts:** Every transaction emits events with: amount, recipient, category, timestamp, description
- **Trip data persistence:** Itinerary, spending history, member preferences stored on 0G Storage

### Sponsor Mapping

- **Arc (Stablecoin Logic):** The escrow contract with conditional USDC spending — conditional escrow, programmable settlement
- **WalletConnect (Pay):** Wallet connection for deposits, spending/budgeting UX
- **World (Agent Kit):** Identity gate — only World ID-verified members can join and authorize the agent

---

## Feature 2: Voice AI Agent with Autonomous Spending

### What It Is

An OpenClaw-powered AI agent with Claude as the reasoning engine. It runs as a persistent background agent with modular skills. Users talk to it — it finds stops, recommends options, and pays from the group pool via Arc nanopayments. World ID proves every transaction is human-authorized.

### Agent Architecture (OpenClaw on 0G)

The co-pilot is an OpenClaw agent instance with the following custom skills:

| Skill | Purpose | External Dependency |
|-------|---------|---------------------|
| `places-search` | Search for restaurants, gas stations, hotels, attractions near the route | Google Places API |
| `route-planner` | Compute optimal routes, ETAs, suggest detours | Google Routes API |
| `weather-check` | Get real-time weather along the route | Google Weather API |
| `treasury-spend` | Initiate a USDC payment from the group pool | Arc nanopayment rail |
| `treasury-balance` | Check pool balance, per-person spend, category budgets | Group treasury contract |
| `trip-memory` | Store/retrieve trip data, conversation history, preferences | 0G Storage |
| `group-vote` | When spend exceeds limit, request group approval | Push notifications / in-app |

### User Flow

**1. Passive Monitoring**

While driving, the agent monitors the route silently. It knows:
- Current GPS location and heading
- Remaining route and ETA
- Group preferences (dietary restrictions, budget sensitivity, pet-friendly needs)
- Treasury balance and budget status
- Weather conditions ahead

It stays quiet unless it has something genuinely useful.

**2. Proactive Suggestions**

The agent speaks up when it detects an opportunity or need:
- "You're 20 minutes from a rest stop. There's a highly-rated diner 2 miles off the highway — burgers, $12 average. Want me to add it?"
- "Gas is $3.20 here but $2.89 at the next exit in 15 minutes."
- "You've been driving for 2 hours. There's a scenic overlook in 10 minutes — good stretch break."
- "Rain starting in 45 minutes on your route. Might want to plan an indoor stop."

**3. Voice Commands**

Users speak naturally:
- "Find us somewhere to eat that's under $15 per person"
- "Where's the cheapest gas in the next 30 minutes?"
- "Book us a campsite for tonight"
- "How much have we spent on food today?"
- "What's our pool balance?"

Agent searches, presents 2-3 options with ratings and prices (read aloud), waits for selection.

**4. Autonomous Spending (under limit)**

For pre-approved categories under the auto-spend limit, the agent transacts without asking:
- "I topped up the toll pass — $4.50 from the pool."
- "Ordered 3 coffees for pickup at the next Starbucks — $14.20. Ready in 8 minutes."

Each spend is logged with full details on-chain.

**5. Group Approval Flow (over limit)**

For larger purchases:
- "I found a hotel for tonight — $189 for two rooms at the Hampton Inn. This exceeds the $100 auto-spend limit."
- "I've sent a vote to the group. 2 of 3 approvals needed."
- Members approve via their phones (push notification + in-app action)
- "Approved. Booking now." → Payment via Arc → On-chain receipt

### 0G Integration

- **Agent framework:** OpenClaw instance running on 0G infrastructure
- **0G Storage:** Trip conversation history, user preferences, itinerary state, and agent memory persisted to 0G Storage. Survives restarts, accessible across devices. All trip data is decentralized and permanent.
- **0G Compute:** Available for secondary tasks — trip summary generation, spending report compilation, route optimization

### World ID Integration

- Every group member verifies via World ID before joining the trip
- The AI agent carries cryptographic proof that World ID-verified humans authorized it
- Every agent-initiated transaction includes this proof
- Merchants/services receiving payments can verify: "this spend was authorized by N verified humans, not a rogue bot"
- This is the trust layer that makes autonomous agent spending viable for real-world commerce

### Arc Integration

- Every payment is a USDC nanopayment through Arc's payment rail
- Micro-transactions (tolls, coffee, snacks) are economically viable via Arc's nanopayment infrastructure
- Larger transactions (hotels, gas fill-ups) use the same rail with higher amounts
- All transactions settle on-chain with full receipt data

---

## 3-Minute Demo Flow

This is the scripted demo for judges:

1. **Setup (30s):** Show 3 friends each connecting wallet via WalletConnect, verifying World ID, and depositing $200 USDC each into the group trip pool. Pool shows $600 balance.

2. **Agent activation (15s):** Start the trip. The OpenClaw agent activates, shows the planned route, confirms preferences ("I know you prefer scenic routes, budget-friendly food, and pet-friendly stops").

3. **Proactive suggestion (30s):** Agent speaks: "You're 25 minutes from a great BBQ place — 4.6 stars, $14 average. Only 1 mile off your route. Want me to check it out?" User responds by voice: "Yeah, sounds good."

4. **Autonomous payment (30s):** Agent: "Ordered 3 pulled pork combos for pickup — $38.50 from the pool." Show the on-chain transaction: Arc nanopayment, USDC deducted, receipt logged. Treasury dashboard updates in real-time.

5. **Budget check (15s):** "How are we doing on budget?" Agent: "You've spent $127 of $600. Food: $72 of $200 budget. Gas: $55 of $150. You're on track."

6. **Group vote (30s):** Agent: "I found a great Airbnb for tonight — $220. This exceeds your $100 auto-limit. Sending vote to the group." Show 2 of 3 members approving on their phones. "Approved — booking now." On-chain payment.

7. **Settlement (15s):** Trip ends. Show auto-settlement: remaining $253 returned proportionally. Full spending report: per-person breakdown, category totals, all on-chain.

8. **Closing (15s):** Recap the tech stack: OpenClaw agent on 0G, Arc nanopayments, World ID verification, WalletConnect. "Group road trips, powered by crypto — no one has to chase Venmo requests again."

---

## Technical Decisions (High-Level)

These are directional — exact implementation details will be determined during planning.

- **Agent framework:** OpenClaw with Claude as LLM backend
- **Blockchain:** Determined by Arc's supported chains (likely EVM-compatible L2)
- **Smart contracts:** Solidity for the group treasury
- **Voice I/O:** Gemini Live API or browser-based Web Speech API (evaluate during build)
- **Location/Places data:** Google Maps Platform APIs (Places, Routes, Weather)
- **Storage:** 0G Storage for trip data and agent state
- **Wallet connection:** WalletConnect / Reown AppKit
- **Identity:** World ID 4.0 via Agent Kit
- **Frontend:** Web app (mobile-responsive) — no native mobile for hackathon scope
- **Backend:** Node.js or Python service hosting the OpenClaw agent

---

## Out of Scope (for hackathon)

These are features from the original idea doc that are explicitly deferred:

- Android Auto / CarPlay integration (requires app store approval process)
- Offline mode
- EV/charging intelligence
- Entertainment/playlist curation
- Packing list assistant
- Post-trip memory NFTs / POAPs
- DAO governance / token incentives
- Parametric insurance (Chainlink CRE)
- Multi-day itinerary auto-planning
- AR overlays
- Biometric mood detection
- Physical crypto card integration (Gnosis Pay / Holyheld)

---

## Success Criteria

1. Working demo where voice commands trigger real on-chain USDC payments from a group pool
2. World ID verification gates group membership and agent authorization
3. OpenClaw agent running on 0G with persistent trip memory
4. Real-time treasury dashboard showing balance, splits, and spending categories
5. Judges can understand the product and its value in under 3 minutes
6. Submissions accepted for Arc (both tracks), World, 0G, and optionally WalletConnect/Ledger
