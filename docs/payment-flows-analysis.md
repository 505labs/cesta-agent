# Payment Flows Analysis — How Money Actually Moves

**Date:** 2026-04-03
**Project:** RoadTrip Co-Pilot
**Purpose:** Map every concrete payment scenario to the right technology layer

---

## The Reality Check

A road trip involves paying gas stations, restaurants, hotels, toll booths, and parking garages. **None of these accept crypto.** They accept Visa and Mastercard.

- **x402/Nanopayments** is for machine-to-machine API payments and gas-free micro-transactions. Perfect for agent-to-service payments.
- **Direct USDC transfer on Arc** works for any recipient with a USDC wallet. Sub-second finality, near-zero gas.
- **Physical merchants** don't accept crypto. For real-world POS, the bridge is a virtual card (TODO: Stripe-like spend tokens, Slash MCP, or similar). The agent creates a disposable Visa/Mastercard funded from the USDC treasury. The user taps at a POS terminal. The merchant gets fiat.

**All payments flow through Arc:**

| Direction | Technology | Who Initiates | What Happens |
|-----------|-----------|---------------|--------------|
| **Money IN** (user → car wallet) | Reown AppKit + Arc | Human | User connects wallet, deposits USDC into Arc treasury |
| **Money MANAGED** (treasury rules) | Arc (GroupTreasury.sol) | Smart contract | Enforces budgets, caps, voting, receipts |
| **Money OUT — autonomous** (parking, tolls, fares) | Arc Nanopayments | Agent (no human) | Agent streams gas-free payments for pre-approved categories |
| **Money OUT — approved** (hotel, big meals) | Arc (treasury contract) | Agent after in-app approval | Members tap approve in app, then agent executes on Arc |
| **Money THINKS** (agent buys data) | Arc x402/Nanopayments | Agent (no human) | Agent pays per-API-call for intelligence |
| **Money OUT — real world** (physical POS) | Virtual Card (TODO) | Agent creates, human taps | Agent funds disposable card from treasury, user taps at merchant |

---

## The Five Concrete Payment Flows

### Flow 1: User Funds the Treasury

**Scenario:** Alice, Bob, and Carol are going on a road trip from Cannes. Each wants to chip in $200 USDC.

**Step by step:**

```
Alice opens web app
  → Reown AppKit modal → connects MetaMask (USDC on Ethereum)
  → SIWE signature → authenticated as 0xAlice
  → Clicks "Deposit $200"
  → CCTP V2 burns USDC on Ethereum
  → 8-20 seconds later, USDC minted on Arc
  → V2 Hook auto-calls GroupTreasury.deposit(tripId, 0xAlice, 200)
  → Dashboard shows: "Alice deposited $200. Pool: $200/$600"

Bob opens web app
  → Reown AppKit modal → connects Phantom (USDC on Solana)
  → Multi-chain: AppKit handles Solana → bridges to Arc
  → Dashboard shows: "Bob deposited $200. Pool: $400/$600"

Carol opens web app
  → Reown AppKit modal → "Pay with Exchange" → Coinbase account
  → No self-custodial wallet needed, deposits from exchange directly
  → Dashboard shows: "Carol deposited $200. Pool: $600/$600"
```

**Who does what:**
- **Reown AppKit (infra):** Wallet connection modal, multi-chain support (EVM + Solana), SIWE auth
- **Arc (CCTP V2 + Hooks):** Cross-chain bridging, auto-deposit into treasury contract
- **Arc (GroupTreasury.sol):** Records deposit, updates balances, emits events
- **Arc (Circle Paymaster):** Sponsors gas so user's full $200 goes into treasury

---

### Flow 2: Agent Pays for Data (Machine-to-Machine)

**Scenario:** While driving, the agent continuously gathers intelligence — gas prices, restaurant ratings, weather forecasts, route optimization — to make good recommendations.

**Step by step:**

```
Agent needs gas prices along the route
  → HTTP GET https://api.gasprice.example/route?from=cannes&to=nice
  → Server responds: 402 Payment Required
    {
      "x402": {
        "price": "$0.003",
        "token": "USDC",
        "network": "arc-testnet",
        "recipient": "0xGasPriceAPI"
      }
    }
  → Agent signs EIP-3009 authorization (off-chain, zero gas)
  → Agent retries with X-PAYMENT header containing signed auth
  → Server verifies, returns gas prices immediately
  → Circle Gateway batches this with 1000s of other nanopayments
  → Periodic on-chain settlement on Arc
  
  Agent: "Gas is cheapest at the Shell on exit 42 — €1.45/L.
          The Total next door is €1.52. Want me to route there?"
```

**Who does what:**
- **Arc (x402 / Circle Nanopayments):** The payment protocol and settlement layer. Agent signs EIP-3009 auths, Gateway batches and settles on Arc.
- **Arc (Circle Programmable Wallets):** MPC-secured signing for the agent. The agent calls Circle's API to sign the authorization — no raw private key in memory.
- **Arc (GroupTreasury.sol):** Budget tracking. These nanopayments come from the "services" category. Dashboard shows: "Agent spent $0.34 on data services today."

**WalletConnect role here:** None. This is entirely machine-to-machine. No human wallet interaction. This is Arc's domain.

**Why this matters for Arc Track 3 ($6K):** The agent is a first-class economic actor. It pays for its own intelligence, autonomously, using nanopayments. Every API call is an auditable expense from the group pool.

---

### Flow 3: User Pays at a Gas Station (In-Person, NFC)

**Scenario:** The car needs fuel. The agent has found the cheapest station. Now someone needs to actually pay at the pump.

**Step by step:**

```
Agent: "We're at the Shell station. Gas will be about €45.
        I'll create a fuel card for whoever's filling up."

User: "I'll do it."

Agent calls card issuing API (via MCP):
  → Creates disposable virtual Visa card
  → Spending limit: €50 (auto-approve, under per-tx cap)
  → MCC restriction: fuel stations only (MCC 5541/5542)
  → TTL: 30 minutes
  → Funded from GroupTreasury: €50 USDC → fiat via card issuer

Card details sent to user's phone:
  → Auto-added to Apple Pay / Google Pay
  → OR: card number displayed for manual entry

User taps phone at POS terminal:
  → Standard Visa NFC authorization
  → Card issuer approves against funded balance
  → Merchant receives EUR through normal Visa settlement
  → Merchant has no idea crypto was involved

Post-payment:
  → Card issuer reports actual charge: €43.20
  → Remaining €6.80 returned to treasury
  → Card invalidated (single-use)
  → GroupTreasury emits event:
    Spend(category="gas", amount=43.20, currency="EUR", member="Alice",
           merchant="Shell Cannes Est", timestamp=1743700000)
  → Dashboard updates: "Gas: €143 / €300 budget"
```

**Who does what:**
- **Virtual Card Issuer (e.g., Slash via MCP, or Crossmint API):** Creates the disposable card, funds it, handles the Visa authorization, converts USDC→fiat at POS. This is the off-ramp layer.
- **Arc (GroupTreasury.sol):** Deducts from the pool, tracks the spend by category and member, emits receipt event.
- **Arc (Circle Programmable Wallets):** Agent signs the treasury deduction.
- **Arc (StableFX):** If the treasury holds USDC but the card needs EUR, StableFX converts USDC → EURC atomically on-chain before funding the card.

**WalletConnect role here:** Indirect but present:
- The user's wallet (connected via AppKit) is their identity — the agent knows Alice is filling up because her wallet address is associated with her trip membership.
- If the card spend exceeds the auto-approve limit, the approval notification goes through the app where Smart Sessions (ERC-7715) govern what the agent can do.
- WalletConnect Pay could be relevant if a merchant eventually integrates WC Pay terminals (Ingenico partnership), but for the hackathon, the card rail is the realistic path.

---

### Flow 4: Agent Books a Hotel Online

**Scenario:** It's getting late. The agent finds a hotel and books it.

**Step by step:**

```
Agent: "There's a 4-star hotel in Nice, €180/night, 4.6 stars.
        That's over your €100 auto-limit. Sending a vote."

Agent calls group_vote_request:
  → Push notification to Alice, Bob, Carol via web app
  → Alice approves ✓  Bob approves ✓  (2/3 = majority)
  → Vote passes

Agent creates disposable virtual card:
  → Spending limit: €200 (hotel + taxes)
  → MCC restriction: lodging (MCC 7011)
  → TTL: 2 hours (booking window)
  → Funded: €200 USDC from treasury

Agent books hotel via online checkout:
  → Option A: Headless checkout API (Crossmint) — agent fills form programmatically
  → Option B: Agent uses card number at Booking.com checkout
  → Option C: If hotel accepts crypto → direct USDC payment (rare but possible)

Card charged: €186.50 (room + tax)
  → Remaining €13.50 returned to treasury
  → Card invalidated
  → On-chain receipt emitted
  → Dashboard: "Lodging: €186.50 / €400 budget"

Agent: "Booked! Hotel & Spa Nice, check-in after 3pm.
        €186.50 from the pool. Sending confirmation to everyone."
```

**Who does what:**
- **Virtual Card Issuer (TODO):** Creates card for online booking, handles the charge.
- **Arc (GroupTreasury.sol):** Group voting mechanism, budget tracking, receipt emission.
- **Arc (x402):** If the agent needs to check hotel availability via a paid API, nanopayments cover it.
- **In-app approval:** Members tap "Approve" in the web app (authenticated via Reown AppKit wallet). Backend records votes; once threshold met, agent executes spend on Arc.

---

### Flow 5: Automatic Toll Payment

**Scenario:** The car passes through a toll on the autoroute (French highway).

**Step by step:**

```
Two approaches:

APPROACH A — Pre-funded toll card:
  Agent pre-creates a card linked to a toll account (Vinci Autoroutes):
    → Card loaded with €30 from treasury
    → MCC restricted: tolls only (MCC 4784)
    → As tolls are charged, balance deducts
    → Agent monitors and tops up if needed

APPROACH B — Per-toll disposable card:
  Agent detects upcoming toll via GPS + route data:
    → Creates micro-card: €8 limit, 5-minute TTL
    → User taps at toll booth
    → Card invalidated after charge

Both approaches:
  → Treasury tracks toll expenses in "transport" category
  → On-chain receipt per toll
  → Agent: "Toll was €6.80. Transport budget: €45 / €150."
```

**Who does what:**
- **Virtual Card Issuer:** Card creation, toll-specific MCC restriction.
- **Arc (GroupTreasury.sol):** Budget tracking, receipt emission.
- **Arc (x402):** Agent pays for route/toll data APIs to know costs in advance.

---

## Revised Technology Layer Map

```
┌─────────────────────────────────────────────────────────────────┐
│  MONEY IN — How funds enter the treasury                         │
│                                                                   │
│  Reown AppKit (wallet connection infra):                         │
│    • Wallet connection (multi-chain: EVM + Solana)               │
│    • SIWE authentication (wallet = identity)                     │
│                                                                   │
│  Arc (CCTP V2 + Gateway):                                        │
│    • Cross-chain USDC bridging (any chain → Arc, 8-20s)         │
│    • V2 Hooks auto-deposit into treasury on arrival              │
│    • Circle Paymaster sponsors gas for deposits                  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  MONEY MANAGED — Treasury rules and accounting                    │
│                                                                   │
│  Arc (GroupTreasury.sol on Arc testnet):                         │
│    • Per-tx caps, daily caps, category budgets                   │
│    • Agent authorization (Circle Programmable Wallet = signer)   │
│    • In-app group voting for over-limit spends                   │
│    • Proportional settlement at trip end                         │
│    • On-chain receipt events for every spend                     │
│    • ERC-8183 escrow pattern for trip lifecycle                  │
│    • ERC-8004 agent identity + reputation                        │
│                                                                   │
│  Arc (StableFX):                                                 │
│    • USDC ↔ EURC atomic conversion for cross-border spending     │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  MONEY THINKS — Agent buys intelligence                           │
│                                                                   │
│  Arc (x402 / Circle Nanopayments):                               │
│    • Gas price APIs: $0.003/call                                 │
│    • Restaurant/POI data: $0.005/call                            │
│    • Weather forecasts: $0.002/call                              │
│    • Route optimization: $0.01/call                              │
│    • Settled in batches on Arc via Gateway (zero gas per call)   │
│                                                                   │
│  Arc (Circle Programmable Wallets):                              │
│    • MPC-secured agent signer for all autonomous actions         │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  MONEY OUT — How funds reach recipients                           │
│                                                                   │
│  Arc (direct on-chain):                                          │
│    • Agent calls treasury.spend() for any payment                │
│    • Under auto-limit: agent executes immediately                │
│    • Over auto-limit: in-app approval first, then agent executes │
│    • On-chain receipt with category, description, amount         │
│                                                                   │
│  Virtual Card Layer (TODO — Slash MCP / Stripe / similar):       │
│    • For physical merchant POS (gas stations, restaurants)        │
│    • Agent creates disposable Visa/MC funded from treasury       │
│    • User taps at terminal, merchant gets fiat                   │
│                                                                   │
│  Direct USDC (crypto-native recipients):                         │
│    • If recipient accepts USDC → direct treasury transfer on Arc │
│    • On-chain receipt, no card intermediary needed                │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  APPROVAL & UX — How humans stay in control                       │
│                                                                   │
│  In-App Approval System:                                         │
│    • Dashboard: real-time spending, budgets, category breakdowns │
│    • Approval UX: tap to approve large purchases in the web app  │
│    • Spending limits: per-tx cap defines auto-approve boundary   │
│    • Notifications: push alerts for votes, large spends          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Simplified Payment Architecture

**Arc is the single payment layer.** No dual payment rails, no split architecture.

### How It Works

1. **Under auto-limit (agent just pays):** Agent calls `treasury.spend()` on Arc. For micro-transactions (parking, tolls, data APIs), uses nanopayments (gas-free, batched via Gateway). For medium transactions (gas fill-ups, restaurant bills), direct on-chain tx. Sub-second finality, ~$0.01 gas.

2. **Over auto-limit (humans approve first):** Agent sends approval request → members tap "Approve" in the web app → backend records votes → once 2-of-3 met → agent calls `treasury.spend()` on Arc. Same settlement, just with a human gate.

3. **Data APIs (machine-to-machine):** Agent pays per-query via x402 protocol. Gas-free nanopayments from the treasury's "services" budget.

4. **Physical merchants (TODO):** Virtual card layer (Slash MCP, Stripe spend tokens, or similar) creates disposable Visa/MC funded from treasury USDC. User taps at POS. Merchant gets fiat. This is a future integration — not blocking the hackathon demo.

### Why This Is Simpler

- **One chain, one treasury, one payment flow.** No bridging between WC-supported chains and Arc.
- **No competing SDKs.** Circle Programmable Wallets is the only signer. No WC Agent SDK confusion.
- **The auto-limit boundary is enforced by the smart contract**, not by which SDK you happen to route through.

---

## Virtual Card Options for the Hackathon

Ranked by hackathon feasibility:

### 1. Slash for Agents (Recommended)

- **MCP server** at `mcp.slash.com` — drops into our MCP architecture directly
- Agent calls Slash MCP to create card, set limits, fund from stablecoin
- Unlimited virtual/physical cards, spending controls, 2% cashback
- Stablecoin on/off ramps built in
- Already used by 5,000+ businesses
- **Integration effort:** Add one JSON block to MCP config

### 2. Crossmint Agentic Payments

- Full API: wallets + virtual cards + headless checkout in one
- Dual-key wallet: owner key sets rules, agent key (in TEE) executes
- Spending rules in smart contracts — cannot be bypassed
- USDC across 50+ chains
- Good for the "agent books a hotel online" flow
- **Integration effort:** REST API calls from trip-treasury MCP

### 3. UQPAY FlashCard

- Most conceptually aligned (task-scoped disposable cards for agents)
- Native MCP server available
- x402 protocol support in their stablecoin platform
- **Risk:** Brand new (March 2026), API docs not fully public yet
- **Integration effort:** MCP server, similar to Slash

### 4. Holyheld SDK

- 30-minute integration for any app with on-chain wallets
- All chains supported natively
- Virtual + physical cards, Apple Pay
- Explicitly markets to AI agents
- **Integration effort:** SDK integration in frontend

---

## Revised Demo Flow (3 Minutes)

**"Give your car a wallet — and a credit card."**

1. **Hook (15s):** "Your car has AI, but it can't pay for anything. We're giving it a wallet AND a card."

2. **Funding (25s):** Three friends connect via WalletConnect — one from MetaMask (Ethereum), one from Phantom (Solana), one from Coinbase directly. Each deposits $200 USDC. Pool: $600. "Three wallets, three chains, one treasury."

3. **Agent intelligence (15s):** Agent: "Checking gas prices along your route..." Show nanopayments: 5 API calls, $0.015 total. "The agent spends fractions of a cent to find you the best options."

4. **The car pays (30s):** Agent: "Found a great restaurant — €38 for three people. Creating a dining card." Show disposable card created: €50 limit, restaurant MCC only, 30-minute TTL. User taps phone at POS. Transaction complete. Card destroyed. Dashboard updates. "No app switching. No splitting the bill. The car paid."

5. **Cross-border FX (15s):** Agent: "We've crossed into Italy. Converting treasury to euros." StableFX: USDC → EURC on-chain, atomic. "Multi-currency, automatic."

6. **Group approval (20s):** Agent: "Found a hotel — €180. That's over your limit. Voting now." Two of three approve via wallet signature. Agent creates lodging card, books online. "Trustless group consensus."

7. **Budget check (10s):** "How are we doing?" Agent: "Spent €287 of €600. Gas: €89/€200. Food: €72/€150. On track."

8. **Settlement (15s):** Trip ends. €313 returned proportionally. Full breakdown on-chain. Every receipt queryable on Arc.

9. **Close (15s):** "Give your car a wallet. Built on Arc, WalletConnect, 0G, and Claude."

---

## Sponsor Prize Mapping

### Arc ($9K across 2 relevant tracks) — PRIMARY

| Track | Prize | Priority | What We Show |
|-------|-------|----------|-------------|
| **Agentic Nanopayments** | **$6K** | **Primary** | **Agent streams autonomous gas-free payments for ALL trip expenses + x402 data APIs. Single payment layer.** |
| Stablecoin Logic | $3K | Secondary | GroupTreasury: conditional escrow, budgets, voting, auto-settlement, on-chain receipts |

### 0G ($6K) — PRIMARY

| Track | Prize | What We Show |
|-------|-------|-------------|
| Best OpenClaw Agent | $6K | Claude Code as agent framework, 0G Storage for trip data persistence |

### Ledger ($6K) — STRETCH

| Track | Prize | What We Show |
|-------|-------|-------------|
| AI Agents x Ledger | $6K | Hardware approval for high-value treasury spends (Ledger as trust layer) |

### Reown SDK ($1K) — INCIDENTAL

| Track | Prize | What We Show |
|-------|-------|-------------|
| Reown SDK | $1K | Wallet connection + SIWE auth (infrastructure, not a focus) |

### Virtual Card Layer (TODO — no direct sponsor prize)

Future integration for physical merchant POS. Not blocking the hackathon demo — the demo shows on-chain payments directly.
