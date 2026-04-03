# WalletConnect Integration Strategy — RoadTrip Co-Pilot

**Date:** 2026-04-03
**Purpose:** Maximize WalletConnect bounty eligibility ($5K total: $4K WC Pay + $1K Reown SDK)
**Status:** Research complete, integration options proposed

---

## Executive Summary

The current spec already includes Reown AppKit for wallet auth and mentions WalletConnect Pay for payments. This document argues for **significantly deeper integration** that makes WalletConnect infrastructure the nervous system of the entire payment experience — not just a wallet connect button and a payment API call.

The key insight: WalletConnect's ecosystem now includes three powerful pieces that map perfectly to our AI agent road trip use case:

1. **Reown AppKit** — wallet connection, authentication, Smart Sessions, Smart Accounts
2. **WalletConnect Pay** — merchant-grade payment infrastructure with ecommerce checkout
3. **WalletConnect Agent SDK** — purpose-built for autonomous AI agents making wallet operations

Together, these enable: *"Users grant permissions → AI agent autonomously pays merchants via WalletConnect Pay → auto-bridging handles cross-chain complexity → all without the user touching their phone."*

---

## Track 1: Best App Built with Reown SDK ($1,000)

### Requirements

- Must use Reown AppKit
- Must connect across **at least 2 distinct chain ecosystems** (e.g., EVM + Solana) OR use Reown Authentication
- Working demo, public repo, explanatory video

### Current Plan (Spec v2)

The spec uses Reown AppKit for wallet-based login (replacing API keys/passwords). This is correct but minimal — it's essentially just a "Connect Wallet" button with SIWE.

### Recommended Deepened Integration

#### 1. Multi-Chain Wallet Connection (Mandatory for Bounty)

The bounty requires **2 distinct chain ecosystems**. Our spec only mentions EVM (Arc). We need to add Solana or Bitcoin support.

**Proposal:** Allow trip members to connect wallets from **both EVM and Solana** ecosystems via Reown AppKit's multi-chain modal. A user with USDC on Solana can join the trip just as easily as one with USDC on Ethereum.

```
Trip member connects via Reown AppKit →
  AppKit detects: EVM wallet (MetaMask) + Solana wallet (Phantom) →
  Shows unified balance across chains →
  Deposits route through appropriate bridge to Arc treasury
```

This is not just checking a box — it genuinely improves the UX. Road trip friends use different wallets and chains. AppKit's multi-chain support means nobody is excluded.

**Implementation:** Reown AppKit natively supports EVM + Solana + Bitcoin in a single modal. The `@reown/appkit` package handles chain detection and switching. We configure the modal with both EVM chains (Arc, Base, Ethereum) and Solana.

#### 2. Smart Sessions (ERC-7715) — AI Agent Permission Delegation

This is the **most impactful Reown feature for our use case** and the strongest argument for the bounty.

**What Smart Sessions do:** Users grant time-limited, scoped permissions to an application to execute transactions on their behalf — without requiring approval for each one. Leverages ERC-7715 (`wallet_grantPermissions`).

**Why this is perfect for RoadTrip Co-Pilot:**

Currently the spec has the AI agent holding its own agent wallet that spends from the treasury contract. Smart Sessions flip this: instead of a separate agent wallet, **each user grants the agent a Smart Session with specific permissions**.

```
User Flow:
1. User connects wallet via Reown AppKit
2. User joins trip and deposits USDC
3. User grants Smart Session to the trip agent:
   - Permission: spend up to $X per transaction
   - Permission: spend up to $Y per day
   - Permission: only for specific contract calls (treasury.spend())
   - Duration: trip duration (e.g., 3 days)
4. AI agent executes treasury spends within these permissions
5. No wallet popup for each payment — the agent just acts
```

**Why judges will love this:**
- It's the exact use case Smart Sessions was designed for (the Reown blog literally lists "subscriptions", "in-game purchases", and "automated transactions" as examples)
- It replaces a clunky agent-wallet pattern with a more secure, user-controlled model
- It demonstrates understanding of Reown's newest feature (ERC-7715)
- Reown co-authored the ERC-7715 standard — they want to see it used

**Compatibility note:** Smart Sessions currently work on Ethereum Sepolia and Base Sepolia. If Arc testnet supports EIP-7702 (Pectra), we can use it there too. If not, we can demonstrate Smart Sessions on Base Sepolia as the user-facing permission layer, with the actual treasury on Arc.

#### 3. One-Click Auth (SIWX)

Replace the multi-step wallet connect → SIWE sign → session token flow with Reown's One-Click Auth, which collapses wallet connection and authentication into a single user action.

**Implementation:** One-Click Auth is built into AppKit — it combines the WalletConnect pairing with SIWE signing in one modal step. No extra code, just configuration.

#### 4. Smart Accounts for Gasless Trip Onboarding

Use Reown AppKit's Smart Account support to give trip members gasless onboarding. New users who don't have ETH for gas can still join the trip — the app sponsors their first transaction.

**Why this matters:** Road trip friends who are crypto-curious but don't have gas tokens can still participate. The app pays for their first deposit transaction, funded by the trip organizer or app sponsor.

#### 5. In-App Swaps + Onramp

Embed Reown AppKit's swap and onramp features directly in the trip funding flow:
- User connects wallet but has DAI instead of USDC → in-app swap to USDC before depositing (powered by 1inch, 0.85% fee)
- User has no crypto at all → onramp to buy USDC with credit card (powered by Coinbase), then deposit

This creates a complete funnel: **fiat → USDC → group treasury**, all within the app via Reown AppKit.

#### 6. Pay with Exchange (High Impact, Low Effort)

Reown AppKit has a "Pay with Exchange" feature — users can pay directly from their **Binance or Coinbase** exchange accounts without:
- Withdrawing to a self-custodial wallet first
- App-switching
- Sharing any exchange credentials

**Why this is killer for road trips:** The friend who says "I have USDC on Coinbase but no MetaMask" can still join the trip. They deposit from Coinbase directly via AppKit.

This is an enterprise feature that Reown is actively promoting. Using it shows deep AppKit knowledge and aligns with their Shopify Ventures investor thesis (lower friction → more commerce).

### Summary: Reown SDK Bounty Argument

| Requirement | How We Exceed It |
|-------------|-----------------|
| Use Reown AppKit | Auth, Smart Sessions, Smart Accounts, Swaps, Onramp — deep integration |
| 2+ chain ecosystems | EVM (Arc/Base/ETH) + Solana, unified in one modal |
| OR Reown Authentication | One-Click Auth / SIWX multi-chain authentication |
| Real-world use case | AI agent for group road trips — voice-first, autonomous spending |
| Excellent UX | No passwords, no gas management, one-click everything |

---

## Track 2: Best Use of WalletConnect Pay ($4,000)

### Requirements

- Must use WalletConnect API
- Working demo, public repo, video explaining functionality
- Three focus areas: Recurring Payments, Tap-to-Pay, Open Track

### Current Plan (Spec v2)

The spec mentions "WalletConnect Pay for agent-initiated payment flows" and using the Agent SDK. This is directionally correct but underspecified.

### Recommended Deepened Integration

#### Option A: Agent-Driven Payment Orchestration (Open Track — Recommended)

**The pitch:** The AI agent IS a WalletConnect Pay merchant. It creates payment requests, processes them via the Agent SDK, and settles on-chain — all autonomously.

**Architecture:**

```
Voice command: "Pay for gas"
         ↓
Claude AI Agent (with MCP tools)
         ↓
WalletConnect Agent SDK (@walletconnect/pay-cli)
   → Creates WalletConnect Pay payment
   → Fetches payment options based on user's wallet
   → Signs and submits via agent-mode (auto-execute)
   → Auto-bridges if funds are on wrong chain
         ↓
Payment settles on Arc (USDC)
         ↓
Treasury contract records expense
         ↓
Dashboard updates in real-time
```

**Key technical components:**

1. **WalletConnect Agent SDK** (`@walletconnect/cli-sdk` + `@walletconnect/pay-cli`):
   - The AI agent uses the programmatic API (`withWallet()` pattern) to connect and transact
   - In agent-mode, it auto-executes without user prompts for pre-approved amounts
   - Auto-bridging handles cross-chain complexity (e.g., user's USDC is on Polygon but payment settles on Arc)

2. **WalletConnect Pay as payment rail:**
   - Instead of raw smart contract calls, the agent creates WalletConnect Pay payments
   - This gives us: compliance screening, payment state management, merchant receipts
   - The trip organizer registers as a "merchant" in WalletConnect Pay dashboard
   - Each trip expense is a formal WalletConnect Pay transaction with receipt

3. **Spending/Budgeting UX (bounty explicitly asks for this):**
   - The treasury dashboard IS a spending/budgeting app powered by WalletConnect Pay
   - Real-time payment tracking via WalletConnect Pay payment states
   - Category-based budgets enforced through the smart contract but initiated via WC Pay
   - Per-person spending breakdown with WC Pay transaction history

**Why this is the strongest angle for the bounty:**
- The bounty says "creative, innovative payment experiences" — an AI agent that autonomously pays for road trip expenses via WalletConnect Pay is exactly that
- It demonstrates the Agent SDK's capabilities (which WalletConnect specifically built and wants to see used)
- The spending/budgeting dashboard directly addresses the bounty's mention of "spending or budgeting"
- It's a real-world use case, not a toy demo

#### Option B: Tap-to-Pay for In-Person Trip Expenses

**The pitch:** When the car arrives at a gas station or restaurant, the AI agent generates a WalletConnect Pay payment link. The user taps their phone (NFC) or scans a QR code to confirm the payment — mimicking the tap-to-pay experience.

**Flow:**

```
AI Agent: "We're at Shell station. Gas will be ~$45. Shall I pay?"
User: "Yeah, go ahead"
Agent generates WalletConnect Pay payment link →
  Payment link displayed as QR on car dashboard screen
  OR sent via push notification to user's phone
User taps/scans to approve →
  WalletConnect Pay processes payment →
  Treasury deducted, receipt on-chain
```

**Why this works:**
- The bounty explicitly asks for tap-to-pay experiences "matching or exceeding Apple Pay usability"
- The road trip context makes in-person payments natural (gas, food, lodging, tolls)
- WalletConnect Pay's Phase 2 roadmap includes NFC tap-to-pay — we'd be demonstrating the vision
- Even if full NFC isn't available yet, the QR-based payment link flow IS available and works like tap-to-pay semantically

**Technical approach:**
- Use WalletConnect Pay's ecommerce checkout flow to create payment requests
- Generate payment links/QR codes that wallets can scan
- The user's wallet (via WalletKit integration) processes the payment with one tap
- For the demo, we can use WalletConnect Pay's test merchant dashboard

#### Option C: Recurring Trip Subscription Payments

**The pitch:** Set up recurring payment authorizations for predictable trip costs — hotel stays, parking subscriptions, toll passes.

**Flow:**

```
Trip Creation:
  "3-day road trip, estimated $200/day"
  → Agent sets up recurring daily authorization of $200 via WalletConnect Pay
  → Each day, the agent can auto-deduct up to $200 without re-approval

During Trip:
  Day 1: Agent spends $180 (gas $45, food $85, parking $50)
  Day 2: Agent spends $195 (gas $40, food $75, hotel $80)
  Day 3: Agent spends $160 (gas $35, food $65, activities $60)
  → Each deduction is a WalletConnect Pay recurring charge
```

**Why this works:**
- The bounty explicitly lists "Recurring Payments" as a focus area
- "subscription-based cryptocurrency flows" maps to daily trip budgets
- Combined with Smart Sessions, the agent has both the permission (Smart Session) and the payment rail (WC Pay recurring) to auto-pay

**Technical approach:**
- WalletConnect Pay's Phase 2 includes recurring payment authorizations
- If not yet live, we implement the pattern: Smart Session grants permission → Agent creates daily WC Pay charges → treasury contract enforces limits
- The recurring pattern is: authorize once, charge daily, settle on-chain

### Recommended: Combine A + B for Maximum Impact

The strongest submission combines:
- **Option A** (agent-driven orchestration) as the core architecture
- **Option B** (tap-to-pay UX) for in-person payments during the trip
- Elements of **Option C** (recurring authorization) for daily budget management

This covers all three bounty focus areas in one coherent product.

---

## WalletConnect Agent SDK — Deep Integration

The `@walletconnect/agent-sdk` is the most underused piece in the current spec. It's a **monorepo of CLI tools and TypeScript libraries** purpose-built for AI agents.

### Packages We Should Use

| Package | Purpose in Our App |
|---------|-------------------|
| `@walletconnect/cli-sdk` | Agent wallet connection, signing, cross-chain bridge |
| `@walletconnect/pay-cli` | Agent creates and completes WC Pay payments |

### Key Capabilities

1. **Programmatic wallet operations:**
   ```typescript
   import { withWallet } from "@walletconnect/cli-sdk";
   
   // Agent connects and transacts programmatically
   await withWallet(config, async (wallet, { accounts }) => {
     const txHash = await wallet.request({
       chainId: "eip155:1",
       request: {
         method: "eth_sendTransaction",
         params: [{ from: accounts[0], to: treasuryAddress, value: amount }]
       }
     });
   });
   ```

2. **Auto-bridging in agent mode:**
   - When the agent sends a transaction and funds are on the wrong chain, the SDK auto-detects and auto-bridges via LI.FI
   - No user interaction needed — perfect for an autonomous trip agent
   - Example: User deposited USDC on Polygon, but the restaurant payment needs to settle on Arc → agent SDK handles the bridge

3. **WalletConnect Pay CLI (experimental):**
   - `walletconnect-pay create` — create a payment from the agent
   - `walletconnect-pay checkout` — complete a payment via connected wallet
   - Environment: `WC_PAY_WALLET_API_KEY`, `WC_PAY_MERCHANT_ID`

4. **Agent-mode behavior:**
   - In non-TTY (pipe/agent) mode, the SDK auto-executes instead of prompting
   - JSON output mode (`--json`) for structured parsing by the AI agent
   - This means: Claude agent calls the SDK → SDK auto-executes → returns JSON result → agent parses and responds

### MCP Server Wrapping the Agent SDK

We should build a custom MCP server that wraps the WalletConnect Agent SDK, exposing tools to the Claude agent:

```
Custom MCP Server: walletconnect-agent-mcp
  ├── wc_connect       — connect the agent's wallet
  ├── wc_pay_create    — create a WC Pay payment
  ├── wc_pay_checkout  — complete a WC Pay payment
  ├── wc_bridge        — bridge tokens cross-chain
  ├── wc_balance       — check agent wallet balance
  └── wc_sign          — sign a message/transaction
```

This replaces the generic `evm-mcp-server` for payment operations and makes every payment flow through WalletConnect infrastructure.

---

## x402 HTTP Payments — Bonus Integration

WalletConnect Pay Phase 1 includes **x402 support** — the HTTP 402 Payment Required protocol for machine-to-machine payments. This is directly relevant to our AI agent.

**How x402 works:**
1. Agent makes HTTP request to a paid API/service
2. Server responds with `402 Payment Required` + payment spec (token, amount, address, chain)
3. Agent signs payment, attaches proof to request header, retries
4. Server verifies on-chain settlement, delivers the resource

**Application to RoadTrip Co-Pilot:**
- The AI agent could pay for premium APIs via x402 (weather data, real-time gas prices, restaurant reservations)
- Each API payment comes from the group treasury via WalletConnect Pay
- This demonstrates WalletConnect Pay's vision of "agent-to-agent programmability"

**Demo example:**
```
Agent: "Checking real-time gas prices along your route..."
→ Agent calls gas price API
→ API returns 402 Payment Required: 0.01 USDC
→ Agent pays via WalletConnect Pay (x402 flow)
→ API returns gas prices
→ Agent: "Gas is cheapest at the Chevron on Exit 42 — $2.89/gal"
```

This is a stretch goal but would strongly differentiate the submission.

---

## Architecture: How It All Fits Together

```
┌─────────────────────────────────────────────────────┐
│                    USER LAYER                        │
│                                                      │
│  Web App (React/Next.js)                            │
│  ├── Reown AppKit Modal (multi-chain: EVM + Solana) │
│  ├── One-Click Auth (SIWX)                          │
│  ├── Smart Session Grant UI                         │
│  ├── In-App Swaps (via AppKit)                      │
│  ├── Onramp (fiat → USDC via AppKit)               │
│  └── Trip Dashboard (spending/budgets)              │
│                                                      │
├─────────────────────────────────────────────────────┤
│                   AGENT LAYER                        │
│                                                      │
│  Claude AI Agent (voice-first)                      │
│  ├── walletconnect-agent-mcp (wraps Agent SDK)      │
│  │   ├── @walletconnect/cli-sdk (wallet ops)        │
│  │   ├── @walletconnect/pay-cli (payments)          │
│  │   └── Auto-bridge (LI.FI cross-chain)            │
│  ├── trip-treasury-mcp (smart contract)             │
│  ├── mcp-google-map (places/directions)             │
│  └── trip-memory-mcp (0G Storage)                   │
│                                                      │
├─────────────────────────────────────────────────────┤
│                  PAYMENT LAYER                       │
│                                                      │
│  WalletConnect Pay                                  │
│  ├── Payment creation (agent-initiated)             │
│  ├── Payment options (multi-chain, auto-select)     │
│  ├── Payment confirmation (tap/QR/auto)             │
│  ├── Recurring authorizations (daily budget)        │
│  └── x402 (HTTP machine-to-machine payments)        │
│                                                      │
├─────────────────────────────────────────────────────┤
│                SETTLEMENT LAYER                      │
│                                                      │
│  Arc Testnet                                        │
│  ├── GroupTreasury.sol (USDC escrow)               │
│  ├── Smart Session permissions (ERC-7715)           │
│  └── On-chain receipts + event logs                 │
│                                                      │
│  Cross-Chain (via WC Agent SDK auto-bridge)         │
│  ├── Deposits from any chain → Arc                  │
│  └── LI.FI bridging integrated into agent flow      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Differentiation: What Makes This Special for WalletConnect Judges

### 1. Agent-Native, Not Bolt-On

Most hackathon projects use WalletConnect as a "connect wallet" button. Ours uses the Agent SDK as the primary payment execution layer — the AI agent IS a WalletConnect client.

### 2. Full Stack WalletConnect

We use **every major WalletConnect product**:
- Reown AppKit (auth, multi-chain, smart sessions, swaps, onramp)
- WalletConnect Pay (payment creation, merchant flow, recurring)
- WalletConnect Agent SDK (autonomous agent operations)
- x402 (machine-to-machine payments)

No other hackathon project will touch all of these.

### 3. Real-World Use Case with Emotional Appeal

"Give your car a wallet" + group road trip + voice AI = memorable, relatable, demoable. Judges remember projects that make them feel something.

### 4. Covers All Three Bounty Focus Areas

- **Recurring Payments:** Daily trip budget authorizations
- **Tap-to-Pay:** QR/NFC payment at gas stations and restaurants
- **Open Track:** AI agent as autonomous WalletConnect Pay merchant/spender

---

## Implementation Priority

For the 48-hour hackathon, here's the recommended build order:

### Must-Have (Core Demo)

1. **Reown AppKit integration** — wallet connect modal with EVM + Solana chains
2. **One-Click Auth / SIWE** — wallet-based login replacing passwords
3. **WalletConnect Agent SDK** — agent wallet connection and payment execution
4. **WalletConnect Pay payment flow** — create payment → agent processes → receipt
5. **Treasury dashboard** — real-time spending/budget tracking (the "budgeting" UX)

### Should-Have (Strengthens Both Bounties)

6. **Smart Sessions** — user grants agent permission to spend within limits
7. **Auto-bridge** — agent SDK handles cross-chain deposits automatically
8. **Tap-to-pay UX** — QR code payment at simulated point-of-sale

### Nice-to-Have (Stretch Goals)

9. **In-app swaps** — convert non-USDC tokens before depositing
10. **Onramp** — fiat to USDC directly in app
11. **x402 payments** — agent pays for premium APIs from treasury
12. **Smart Accounts** — gasless onboarding for crypto-new trip members

---

## What Judges Actually Want — Intel from Past Events + Team Signals

### WalletCon Cannes (March 31, 2026 — 3 days ago)

WalletConnect held **WalletCon** in Cannes on March 31 — their own flagship event immediately before ETHGlobal. Key takeaways:

- **Live POS demo** of WalletConnect Pay on Ingenico terminals with QR scan → USDC payment
- Panel: "The Payments Stack: From Wallet to Merchant" with CEO Jess Houlgrave
- Strong signal: **payments is their #1 priority for 2026**
- The "Year Ahead 2026" blog post explicitly states: *"In 2026, WalletConnect expands decisively into payments."*

### Past ETHGlobal Prize Criteria (Singapore 2024, Brussels 2024)

> **"$5,000 to the 3 most creative and innovative projects building with AppKit."**
> Eligibility: Any DeFi app, social app, or consumer-focused app using AppKit.
> **Bonus consideration**: Projects using layered features — Email/Social Login, Swaps, On-Ramp — beyond just the wallet connection modal.

Past winners:
- **Effortl3ssAI** (Singapore) — dual login (Web3 wallet + Web2 social auth), prompt-to-onchain action
- **Merlion's Bloom** (Singapore) — social/gaming, seamless sign-in
- **DAMP** (DoraHacks) — gas sponsorship via Paymasters for frictionless UX

**Pattern:** Best UX for onboarding + real utility + at least 2-3 AppKit features stacked together.

### Reown's Strategic Direction (Why This Matters)

- **$13M Series B** with **Shopify Ventures** and Kraken Ventures as strategic investors → commerce/checkout is priority
- **Payments Summit 2025**: Nearly 50% of users abandon payments because the process is too complex
- **Internal hackathon focuses**: Smart Sessions, gas sponsorship, chain abstraction
- **Ingenico partnership**: millions of Android POS terminals now accept USDC via WC Pay

**Bottom line for judges:** They want to see projects that (1) reduce real-world payment friction, (2) use multiple AppKit features together, (3) demonstrate the agentic/programmable payment vision, and (4) have polished consumer-grade UX.

---

## WalletConnect Pay — Detailed Technical Reference

### The wallet_pay Standard (CAIP-358)

WalletConnect Pay is built on **CAIP-358** — an open standard for chain-agnostic payment requests. The standard sends all payment options in one request; the wallet picks the best option from the user's balances without asking the user to choose a network or token.

### Actual SDK API (for Implementation)

**WalletKit SDK (recommended for wallets):**
```typescript
import { WalletKit } from "@reown/walletkit";

const walletkit = await WalletKit.init({
  core,
  metadata: { ... },
  payConfig: { appId: "<WCP_ID>" }  // from dashboard.walletconnect.com
});

// Detect payment link
walletkit.pay.isPaymentLink(uri);  // true for pay.walletconnect.com links

// Get payment options (what can the user pay with?)
const options = await walletkit.pay.getPaymentOptions({
  paymentLink,
  accounts: ["eip155:1:0x...", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:..."],
  includePaymentInfo: true
});

// Get signing actions for selected option
const actions = await walletkit.pay.getRequiredPaymentActions({
  paymentId,
  optionId
});

// Sign all actions, then confirm
await walletkit.pay.confirmPayment({
  paymentId,
  optionId,
  signatures  // must match action order
});
```

**Standalone SDK (for non-WalletKit wallets):**
```typescript
import { WalletConnectPay } from "@walletconnect/pay";
const client = new WalletConnectPay({ appId: "your-wcp-id" });
// Same 4-step flow: getPaymentOptions → getRequiredPaymentActions → sign → confirmPayment
```

**API-First (no SDK, direct HTTP):**
- Requires API key from WalletConnect team
- Gateway endpoints: `POST /v1/gateway/payment/{id}/options`, `/fetch`, `/confirm`
- Supports long-polling via `maxPollMs` parameter

### Payment States
`SUCCEEDED | PROCESSING | FAILED | EXPIRED | REQUIRES_ACTION | CANCELLED`

### Hackathon-Critical: Agent SDK Proxy Mode

The `@walletconnect/agent-sdk` pay-cli has a **proxy mode** that works **without API keys** — it proxies through the WC Pay frontend. This is likely the fastest path to a working demo without merchant KYB onboarding.

```bash
# No API key needed in proxy mode
walletconnect-pay create   # create payment
walletconnect-pay checkout # complete via connected wallet
```

### wallet_pay v2 Roadmap (Coming)
- Authorizations (pre-auth, like hotel card holds)
- Recurring billing / subscriptions
- Loyalty integration + cashback
- Agent-to-agent programmable flows
- x402 protocol integration
- NFC tap-to-pay for POS
- QR compatibility with Pix, Mercado Pago, Toast

---

## Key Resources

### Documentation
- [Reown AppKit Docs](https://docs.reown.com/appkit/overview)
- [WalletConnect Pay Docs](https://docs.walletconnect.com/)
- [WalletConnect Agent SDK](https://github.com/WalletConnect/agent-sdk)
- [Smart Sessions (ERC-7715)](https://reown.com/blog/what-are-smart-sessions)
- [Pectra + Smart Accounts](https://reown.com/blog/pectra-is-here-what-it-unlocks-for-onchain-builders)
- [WC Pay Whitepaper (PDF)](https://payments.walletconnect.com/)
- [WC Pay Roadmap Blog](https://walletconnect.com/blog/how-walletconnect-will-become-the-standard-for-onchain-payments)
- [WalletConnect Year Ahead 2026](https://walletconnect.com/blog/walletconnect-year-ahead-2026)
- [CAIP-358 Spec (wallet_pay standard)](https://chainagnostic.org/CAIPs/caip-358)
- [API-First Integration Guide](https://docs.walletconnect.com/payments/wallets/api-first)

### Dashboards
- [WalletConnect Dashboard](https://cloud.walletconnect.com/) — get Project ID, WCPay ID, API keys
- [WC Pay Merchant Dashboard](https://dashboard.walletconnect.com/) — set up test merchant
- [AppKit Lab Playground](https://lab.reown.com/) — test AppKit features live

### Code Examples
- [AppKit Web Examples](https://github.com/reown-com/appkit-web-examples)
- [Agent SDK Examples](https://github.com/WalletConnect/agent-sdk)
- [AppKit React Native Examples](https://github.com/reown-com/react-native-examples)
- [Expo Wallet (RN + WC Pay)](https://github.com/reown-com/react-native-examples/tree/main/wallets/expo-wallet)

### NPM Packages
- `@reown/appkit` — main AppKit SDK
- `@reown/appkit-adapter-wagmi` — EVM adapter
- `@reown/appkit-adapter-solana` — Solana adapter
- `@reown/appkit-siwx` — multi-chain auth
- `@walletconnect/cli-sdk` — agent wallet operations
- `@walletconnect/pay-cli` — agent payment operations
- `@walletconnect/pay` — standalone Pay SDK
- `@reown/walletkit` — WalletKit with Pay built in

---

## Bounty Submission Checklist

### Track 1: Best App Built with Reown SDK ($1,000)

- [ ] Reown AppKit integrated for wallet connection
- [ ] Multi-chain: EVM + Solana (2 distinct ecosystems)
- [ ] Reown Authentication (One-Click Auth / SIWX)
- [ ] Smart Sessions for agent permission delegation
- [ ] Working demo with video
- [ ] Public GitHub repo

### Track 2: Best Use of WalletConnect Pay ($4,000)

- [ ] WalletConnect Pay API used for payment creation
- [ ] Agent SDK for autonomous payment execution
- [ ] Spending/budgeting dashboard UX
- [ ] Tap-to-pay or QR payment flow for in-person expenses
- [ ] Recurring authorization pattern for daily budgets
- [ ] Working demo with video
- [ ] Public GitHub repo
- [ ] WCPay ID obtained from dashboard
