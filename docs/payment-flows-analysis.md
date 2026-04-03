# Payment Flows Analysis — How Money Actually Moves

**Date:** 2026-04-03
**Project:** RoadTrip Co-Pilot
**Purpose:** Map every concrete payment scenario to the right technology layer

---

## The Reality Check

A road trip involves paying gas stations, restaurants, hotels, toll booths, and parking garages. **None of these accept crypto.** They accept Visa and Mastercard.

- **WalletConnect Pay** requires merchants to integrate WC Pay QR codes. It's a PSP-level integration. Gas stations don't have it. Restaurants don't have it. The Ingenico terminal partnership is nascent.
- **x402/Nanopayments** is for machine-to-machine API payments. You can't pay for a burger with an HTTP 402 header.
- **Direct USDC transfer** requires the merchant to have a USDC wallet. They don't.

**The bridge is a virtual card.** The agent creates a disposable Visa/Mastercard funded from the USDC treasury. The user taps at a POS terminal. The merchant gets fiat. They never know crypto was involved.

This reframes the entire architecture around **who initiates the payment**:

| Direction | Technology | Who Initiates | What Happens |
|-----------|-----------|---------------|--------------|
| **Money IN** (user → car wallet) | WalletConnect (Reown AppKit) | Human | User connects wallet, deposits USDC — funding the car's wallet |
| **Money MANAGED** (treasury rules) | Arc (GroupTreasury.sol) | Smart contract | Enforces budgets, caps, voting, receipts |
| **Money OUT — autonomous** (parking, tolls, fares) | Arc Nanopayments | Agent (no human) | Agent streams gas-free payments for pre-approved categories |
| **Money OUT — approved** (hotel, big meals) | WalletConnect Pay | Human approves | Group votes via WC, then agent executes |
| **Money THINKS** (agent buys data) | Arc x402/Nanopayments | Agent (no human) | Agent pays per-API-call for intelligence |
| **Money OUT — real world** (physical POS) | Virtual Card (Visa/MC) | Agent creates, human taps | Agent funds disposable card, user taps at merchant |

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
- **WalletConnect (Reown AppKit):** Wallet connection modal, multi-chain support (EVM + Solana), SIWE auth, "Pay with Exchange" for Coinbase/Binance users, in-app swaps if user has non-USDC tokens
- **Arc (CCTP V2 + Hooks):** Cross-chain bridging, auto-deposit into treasury contract
- **Arc (GroupTreasury.sol):** Records deposit, updates balances, emits events
- **Arc (Circle Paymaster):** Sponsors gas so user's full $200 goes into treasury

**WalletConnect depth here:** This isn't just a "Connect Wallet" button. It's multi-chain wallet detection, exchange account funding, token swaps, and gasless onboarding — the full AppKit feature stack.

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
- **Virtual Card Issuer:** Creates card for online booking, handles the charge.
- **Arc (GroupTreasury.sol):** Group voting mechanism, budget tracking, receipt emission.
- **Arc (x402):** If the agent needs to check hotel availability via a paid API, nanopayments cover it.
- **WalletConnect (AppKit):** The approval notification UX — members vote via the web app where they're authenticated by their connected wallet. Smart Sessions define what amount triggers a vote vs auto-approve.

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
│  WalletConnect (Reown AppKit):                                   │
│    • Wallet connection (multi-chain: EVM + Solana)               │
│    • SIWE authentication (wallet = identity)                     │
│    • Pay with Exchange (Coinbase/Binance direct)                 │
│    • In-app swaps (DAI→USDC, ETH→USDC)                         │
│    • Smart Sessions: grant agent scoped permissions (ERC-7715)   │
│    • Smart Accounts: gasless onboarding for new users            │
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
│    • Group voting for over-limit spends                          │
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
│  MONEY OUT — How funds reach real-world merchants                 │
│                                                                   │
│  Virtual Card Layer (Slash MCP / Crossmint / UQPAY FlashCard):  │
│    • Agent creates disposable Visa/MC per purchase               │
│    • Scoped: spending limit, MCC restriction, TTL                │
│    • Funded from treasury USDC (issuer handles USDC→fiat)        │
│    • User adds to Apple Pay / Google Pay → NFC tap at POS        │
│    • Card invalidated after use                                  │
│    • Merchant receives fiat through normal Visa/MC rails         │
│    • Merchant never knows crypto was involved                    │
│                                                                   │
│  WalletConnect Pay (secondary, crypto-native merchants only):    │
│    • If a merchant has WC Pay terminal → QR/tap crypto payment   │
│    • Ingenico partnership: future-facing, not widespread yet     │
│    • Best for: crypto-native shops, hackathon demo scenarios     │
│                                                                   │
│  Direct USDC (rare):                                             │
│    • If merchant accepts USDC → direct treasury transfer on Arc  │
│    • On-chain receipt, no card intermediary needed                │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  APPROVAL & UX — How humans stay in control                       │
│                                                                   │
│  WalletConnect (Reown AppKit + Smart Sessions):                  │
│    • Dashboard: real-time spending, budgets, category breakdowns │
│    • Approval UX: vote on large purchases via connected wallet   │
│    • Smart Sessions: define what agent can auto-approve           │
│    • Notifications: push alerts for votes, large spends          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Are WalletConnect and Arc Complementary? (Revised Answer)

**Yes — the split is clean and based on who initiates the payment.**

### WalletConnect = The Human UX Layer

WalletConnect handles every moment where a human needs to be involved:

1. **Funding the car's wallet** — The wallet connection experience IS how you deposit money. Multi-chain support means friends aren't excluded by chain. "Pay with Exchange" means the Coinbase-only friend can still join.

2. **Defining what the agent can auto-spend** — Smart Sessions (ERC-7715) let users set the rules: "spend up to $15 per transaction on parking and tolls, up to $500 per day total, for 3 days." This defines the boundary between WalletConnect territory (needs approval) and Arc nanopayments territory (auto-approved).

3. **Approving big purchases** — When the agent wants to book a $220 hotel, the group votes via WalletConnect-connected wallets. This is the human approval UX.

4. **Dashboard UX** — Spending/budgeting interface where humans monitor what the car spent.

### Arc Nanopayments = The Autonomous Agent Layer

Arc handles everything the agent does without asking a human:

1. **Pre-approved micro-spending** — Parking ($3-8), tolls ($4-6), fares ($5-10), small food ($8-15). The user said "parking and fares are fine" at trip setup → agent streams gas-free nanopayments for these. No wallet popup, no UX friction.
2. **Data API payments** — Agent pays $0.001-$0.01 per API call for gas prices, weather, restaurant data via x402. The agent buys its own intelligence from the treasury.
3. **Treasury as source of truth** — All spending rules, balances, receipts, and settlement logic live on-chain on Arc.
4. **Agent identity** — ERC-8004 gives the agent verifiable on-chain identity and reputation.

### The Virtual Card Layer (New)

This is the missing piece that makes the whole thing work for real-world spending:

1. **Agent creates disposable cards** programmatically via MCP or API.
2. **Cards are scoped** — spending limit, merchant category, time-to-live. The agent can't overspend because the card won't authorize beyond its limit.
3. **Cards are funded from treasury USDC** — the card issuer handles the USDC→fiat conversion.
4. **User taps at any merchant** — Apple Pay / Google Pay NFC. Works everywhere Visa/MC is accepted.
5. **Card is invalidated after use** — no reusable credentials, no fraud surface.

### No Technology Contradicts Another

| Concern | Resolution |
|---------|------------|
| "WC Pay and x402 both handle payments" | WC Pay = human checkout UX. x402 = machine API payments. Different actors, different amounts. |
| "Circle Wallets and WC Agent SDK both sign for the agent" | Circle Wallets is the canonical signer (MPC security). WC Agent SDK is optional for cross-chain bridging where WC Pay is needed. |
| "Virtual cards bypass both WC Pay and Arc" | No — the treasury on Arc is the source of funds. The card is just the off-ramp. Every card spend is a treasury deduction with on-chain receipts on Arc. |
| "WC Pay isn't useful if merchants don't accept it" | WC Pay is the forward-looking play (Ingenico terminals rolling out). For the hackathon, demo a crypto-native merchant scenario. For real-world spending, cards. |

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

## Sponsor Prize Mapping (Updated)

### Arc ($9K across 2 relevant tracks)

| Track | Prize | Priority | What We Show |
|-------|-------|----------|-------------|
| **Agentic Nanopayments** | **$6K** | **Primary** | **Agent streams autonomous gas-free payments for parking, tolls, fares + x402 data APIs. Clean split: human → WC, agent → Arc.** |
| Stablecoin Logic | $3K | Secondary | GroupTreasury: conditional escrow, budgets, voting, auto-settlement, on-chain receipts |
| ~~Chain Abstracted~~ | ~~$3K~~ | Deprioritized | Overlaps with WalletConnect's cross-chain capabilities. Skip to keep the split clean. |

### WalletConnect ($5K across 2 tracks)

| Track | Prize | What We Show |
|-------|-------|-------------|
| Reown SDK | $1K | Multi-chain AppKit (EVM + Solana), Smart Sessions (define auto-spend rules), wallet-based auth |
| **WC Pay** | **$4K** | **Human UX: deposit into car wallet, group approval for big spends, spending/budgeting dashboard** |

### Virtual Card Layer (No direct sponsor prize, but strengthens all submissions)

The card layer isn't a sponsor track, but it makes the demo real. Judges can see an actual NFC tap at a real terminal. That's more memorable than a testnet transaction hash.
