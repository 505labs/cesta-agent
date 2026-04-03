# Arc Blockchain Integration Strategy

**Date:** 2026-04-03
**Project:** RoadTrip Co-Pilot
**Event:** ETHGlobal Cannes 2026

---

## What Is Arc?

Arc is Circle's purpose-built Layer-1 blockchain for stablecoin-native finance. It's EVM-compatible, uses **USDC as the native gas token** (not a volatile crypto), and provides **deterministic sub-second finality** via the Malachite BFT consensus engine (Tendermint-class, built by Informal Systems, acquired by Circle).

Arc positions itself as "The Economic OS for the internet" — a programmable trust layer where capital, humans, and machines coordinate. It launched its public testnet October 28, 2025 (150M+ transactions in first 90 days, ~1.5M wallets, ~0.5s average settlement). Mainnet beta is planned for Q2 2026.

**Institutional testnet participants include** BlackRock, Goldman Sachs, Visa, Mastercard, HSBC, Deutsche Bank, **Anthropic**, and 100+ others.

### Why Arc Matters for This Project

Arc isn't just "another EVM chain." Three properties make it uniquely suited for an autonomous AI agent managing group funds:

1. **USDC is the native gas token.** No volatile token management. Fees are ~$0.01/tx denominated in dollars. The treasury holds USDC, the agent spends USDC, gas costs USDC — one token for everything.

2. **Deterministic sub-second finality.** When the agent pays for gas or food, the transaction is final instantly. No waiting for confirmations, no reorg risk. Critical for a live demo where the agent says "I just paid" and the dashboard updates in real-time.

3. **Deep Circle platform integration.** Arc natively integrates with CCTP (cross-chain transfers), Gateway (unified USDC balance), Nanopayments (gas-free microtransactions), Programmable Wallets (MPC key management), and StableFX (on-chain FX). These aren't third-party bolt-ons — they're first-party infrastructure.

---

## Arc Prize Tracks at ETHGlobal Cannes 2026

Arc is offering **$15,000 in USDC** across four tracks. Three are directly relevant to our project:

### Track 1: Best Smart Contracts with Advanced Stablecoin Logic — $3,000

> Build and deploy smart contracts that demonstrate advanced programmable logic using USDC or EURC — conditional flows, onchain automation, or multi-step settlement mechanisms.

**What they want to see:**
- Conditional escrow with on-chain dispute + automatic release
- Programmable payroll / vesting in USDC or EURC
- Cross-chain conditional transfers (escrow on source, release on destination via Circle Forwarder)

**How we qualify:** Our GroupTreasury contract is exactly this — a conditional USDC escrow with programmable spending rules (per-tx caps, daily caps, category budgets), agent-authorized spending, group voting for large expenses, and automatic proportional settlement at trip end.

### Track 2: Best Chain Abstracted USDC Apps Using Arc as Liquidity Hub — $3,000

> Build chain-abstracted USDC apps that treat multiple blockchains as one liquidity surface, using Arc to move USDC wherever needed.

**What they want to see:**
- Cross-chain payments, credit, or treasury systems
- Applications not locked to a single chain
- Seamless UX despite cross-chain complexity

**How we qualify:** Friends deposit USDC from whatever chain they hold it on (Ethereum, Base, Arbitrum, etc.). CCTP V2 bridges it to the Arc treasury in 8-20 seconds. The depositor doesn't need to know about Arc — they just deposit USDC and it arrives.

### Track 3: Best Agentic Economy with Nanopayments — $6,000 (1st: $4K, 2nd: $2K)

> Build applications that enable autonomous AI agents to transact using nanopayments on Arc. Agents making gas-free micropayments for API calls, data access, compute resources, or services without human intervention.

**What they want to see:**
- AI agents paying for API calls, LLM inference, or data access per-use
- Autonomous agents trading services or compute resources
- Multi-agent systems with payment-based coordination
- Agent marketplaces with gas-free microtransactions
- Pay-per-query knowledge bases or RAG systems accessed by agents

**How we qualify:** This is the **highest-value track** and the most natural fit. Our AI agent autonomously spends USDC for trip services. With nanopayments, the agent can pay per-API-call for real-time data (gas prices, restaurant ratings, weather, route optimization) using the x402 protocol — no API keys, just pay-per-use.

### Track 4: Best Prediction Markets — $3,000

Not relevant to our project.

---

## Meaningful Integration Points

The sections below describe how each Arc technology fits into RoadTrip Co-Pilot — not at a surface level, but as a core part of the architecture that would be worse without it.

### 1. Nanopayments + x402 Protocol — Agent Pays for Its Own Intelligence

**What it is:** Circle Nanopayments enable gas-free USDC transfers as small as $0.000001. They use the x402 protocol, which revives HTTP status code 402 ("Payment Required") as a native internet payment standard. Payments are signed off-chain (EIP-3009) and settled on-chain in batches by Circle Gateway.

**The x402 flow:**
1. AI agent sends HTTP request to a paid API endpoint (e.g., gas price API)
2. Server responds with **HTTP 402** containing payment requirements (price, USDC address, network)
3. Agent signs a payment authorization (EIP-3009 / EIP-712 typed data)
4. Agent retries request with signed payment in `X-PAYMENT` header
5. Server verifies signature, serves data immediately
6. Gateway batches thousands of authorizations, settles on-chain periodically

**Why this matters for our project:**

Today, AI agents consume APIs using developer-purchased API keys. The developer pays a flat monthly fee, whether the agent uses the API once or a million times. This is the wrong economic model for an autonomous agent.

With x402 + nanopayments, **the agent pays for its own intelligence from the group treasury, per-use:**

| Service | Cost per Call | Purpose |
|---------|--------------|---------|
| Gas price API | $0.001 | Find cheapest fuel on route |
| Restaurant/POI data | $0.005 | Recommendations along the route |
| Weather forecast | $0.002 | Proactive weather alerts |
| Route optimization | $0.01 | Real-time rerouting |
| Hotel availability | $0.01 | Lodging search and booking |

These nanopayments come out of the group treasury's "services" budget. The agent isn't just spending money on gas and food — it's spending money to *think better*. Every API call that helps the agent make better recommendations is an on-chain, auditable expense that the group can see: "Agent spent $0.34 on data services today."

**This is the core story for Track 3.** The agent is a participant in the agentic economy — it earns trust through good recommendations and pays for the data it needs to make them.

**Implementation:**
- Agent wallet deposits USDC into Circle Gateway Wallet contract (one-time on-chain tx)
- For each API call, agent signs EIP-3009 authorization off-chain (zero gas)
- Paid API servers use `paymentMiddleware` from `@x402/express`:
  ```typescript
  app.use(paymentMiddleware(recipientWallet.address, {
    "GET /gas-prices": { price: "$0.001", network: "arc-testnet" },
    "GET /restaurants": { price: "$0.005", network: "arc-testnet" },
  }, { url: "https://x402.org/facilitator" }));
  ```
- Agent sees the 402, signs the payment, retries — gets data
- Gateway settles all nanopayments in periodic batches on Arc

**Resources:**
- Nanopayments docs: https://developers.circle.com/gateway/nanopayments
- x402 protocol: https://www.x402.org/

---

### 2. ERC-8004 Agent Identity — Give the Agent a Verifiable On-Chain Identity

**What it is:** Arc has a native standard (ERC-8004) for registering AI agents on-chain with NFT-based identity, reputation tracking, and credential verification. This is unique to Arc — no other chain has this.

**Arc ERC-8004 contracts (testnet):**
- `IdentityRegistry`: `0x8004A818BFB912233c491871b3d84c89A494BD9e` — mints NFT identity for agents
- `ReputationRegistry`: `0x8004B663056A597Dffe9eCcC1965A193B7388713` — tracks agent reputation
- `ValidationRegistry`: `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` — KYC and credential verification

**Why this matters for our project:**

Our AI agent handles real money on behalf of a group of friends. Trust is the core issue — why should anyone let an AI spend from their shared pool? ERC-8004 gives the agent a **verifiable, on-chain identity** that:

- **Is registered and immutable.** The agent has a minted NFT identity on Arc with metadata describing its capabilities, version, and operator.
- **Has a reputation score.** After each trip, members can rate the agent's performance. These scores accumulate on-chain via the ReputationRegistry. Future users can check the agent's track record before trusting it with their money.
- **Has verifiable credentials.** The ValidationRegistry can attest that the agent has been audited, that its spending logic matches its claimed behavior, or that it meets specific safety standards.

**For the demo narrative:** "This isn't just any AI — it has an on-chain identity. You can verify who built it, check its reputation from past trips, and see that its spending behavior has been audited. Give your car a wallet, and give that wallet an identity."

**Implementation:**
1. Upload agent metadata to IPFS (name, version, capabilities, operator)
2. Call `IdentityRegistry.register(metadataURI)` → get agent NFT ID
3. After each trip, members submit reputation scores via `ReputationRegistry`
4. Agent's identity NFT is referenced in the GroupTreasury contract as the authorized spender

---

### 3. ERC-8183 Jobs Protocol — Native Escrow for Trip Settlement

**What it is:** Arc has a built-in standard (ERC-8183) for job marketplaces with escrow. It defines three roles: Client (creates and funds), Provider (executes and submits work), and Evaluator (reviews and releases funds). The contract holds USDC in escrow until work is evaluated.

**Arc ERC-8183 contract (testnet):** `0x0747EEf0706327138c69792bF28Cd525089e4583`

**Why this matters for our project:**

Our trip settlement pattern maps directly to the ERC-8183 job model:

| ERC-8183 Role | Road Trip Equivalent |
|---------------|---------------------|
| **Client** | The group (collectively funds the trip) |
| **Provider** | The AI agent (executes the trip, manages spending) |
| **Evaluator** | Trip organizer or majority vote (approves final settlement) |
| **Job States** | Open → Funded → In Progress → Submitted → Completed |

Instead of writing a fully custom escrow contract from scratch, we can build our GroupTreasury as an extension of ERC-8183, inheriting its battle-tested escrow mechanics and adding our trip-specific logic (category budgets, per-tx caps, proportional settlement). This gives judges a clear signal: "We didn't reinvent escrow — we extended Arc's native standard."

**What we add on top of ERC-8183:**
- Multi-depositor support (multiple clients funding one job)
- Category-based budget tracking (gas, food, lodging, activities)
- Per-transaction spending caps with auto-approve below threshold
- Group voting for expenses above the auto-limit
- Proportional refund on trip completion
- Event-based receipt system for every spend

---

### 4. Circle Programmable Wallets — MPC-Secured Agent Wallet

**What it is:** Circle's Wallets-as-a-Service with MPC (Multi-Party Computation) key management. Developer-Controlled Wallets let an application manage wallets programmatically — create, fund, sign, and transact via API without ever handling raw private keys.

**Why this matters for our project:**

In our current design, the agent wallet is a raw private key loaded into the Claude Code session. This is a security risk — if the session is compromised, the key is exposed, and the entire treasury is at risk.

Circle Programmable Wallets fix this:

- **No private key exposure.** MPC splits the key across multiple parties. No single point of failure.
- **API-driven transactions.** The agent calls Circle's API to sign and submit transactions. The key never exists in memory in the Claude Code session.
- **Built-in gas sponsorship.** Circle's Gas Station can sponsor gas so the agent wallet doesn't need to manage gas separately (though on Arc, gas is USDC anyway).
- **Wallet sets.** Create a WalletSet for the trip, with individual wallets for each participant and one for the agent. Clean lifecycle management.

**Implementation:**
```typescript
const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

// Create agent wallet on Arc
const agentWallet = await circleClient.createWallets({
  blockchains: ["ARC-TESTNET"],
  count: 1,
  walletSetId: tripWalletSet.id,
  accountType: "SCA", // Smart Contract Account
});
```

The trip-treasury MCP server wraps this — the agent calls `treasury_spend` and the MCP server uses the Circle Wallets API to sign and submit the transaction, never exposing the key.

**Resources:**
- Circle Wallets docs: https://developers.circle.com/wallets

---

### 5. CCTP V2 Fast Transfers + Hooks — Chain-Abstracted Deposits

**What it is:** CCTP V2 is Circle's permissionless protocol for native USDC transfers across blockchains. It burns USDC on the source chain and mints it on the destination chain — no wrapped tokens, no liquidity pools. V2 adds Fast Transfers (8-20 seconds vs 15-19 minutes) and Hooks for post-transfer automation.

**Key Arc CCTP contracts (testnet):**
- `TokenMessengerV2`: `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA`
- `MessageTransmitterV2`: `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275`
- Arc Testnet CCTP Domain: `26`

**Why this matters for our project:**

Friends hold USDC on different chains — Alice on Ethereum, Bob on Base, Carol on Arbitrum. Without CCTP, they'd each need to manually bridge to Arc through a third-party bridge (Wormhole, LayerZero, etc.) with varying trust assumptions and wait times.

With CCTP V2:
- Each friend initiates a deposit from their chain
- USDC is burned on the source chain, minted on Arc in 8-20 seconds
- **V2 Hooks** can automatically deposit the arriving USDC into the GroupTreasury contract — no second transaction needed

**The Hook pattern:**
```
User deposits on Ethereum →
  CCTP burns on Ethereum →
    Circle attestation (8-20s) →
      USDC minted on Arc →
        Hook automatically calls GroupTreasury.deposit(tripId, user) →
          Treasury updated, dashboard reflects new balance
```

This is a single user action ("Deposit $200") that triggers the entire cross-chain flow automatically. The user doesn't know or care that USDC moved from Ethereum to Arc.

**Bridge Kit SDK:**
```bash
npm install @circle-fin/bridge-kit @circle-fin/adapter-circle-wallets
```

**Resources:**
- USDC docs: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Bridge Kit docs: https://developers.circle.com/bridge-kit

---

### 6. StableFX — On-Chain FX for Cross-Border Trips

**What it is:** Arc's built-in FX engine with institutional-grade RFQ (Request for Quote) and atomic Payment-versus-Payment (PvP) settlement. Supports conversion between USDC, EURC, USYC, and Circle Partner Stablecoins.

**Arc FxEscrow contract (testnet):** `0x867650F5eAe8df91445971f14d89fd84F0C9a9f8`

**Why this matters for our project:**

ETHGlobal Cannes is in France. A road trip from Cannes could cross into Italy, Monaco, or Spain. Different countries may prefer EUR-denominated payments.

With StableFX:
- The treasury holds USDC
- When the agent needs to pay a European merchant that quotes in EUR, it converts USDC → EURC atomically on-chain
- The conversion is PvP (both legs settle or neither does) — no slippage risk, no partial fills
- The receipt shows: "Paid €35.00 (EURC) for lunch — converted from $38.15 (USDC) at 1.09 FX rate"

**For the demo:** "Your car doesn't just have a wallet — it has a multi-currency wallet. Driving from France to Italy? The agent converts dollars to euros on-chain, atomically, in under a second."

**EURC on Arc testnet:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

---

### 7. Circle Paymaster — Sponsored Gas for Users

**What it is:** Circle's Paymaster lets applications sponsor gas fees so end users never need to hold native tokens or worry about gas. Works with both ERC-4337 smart accounts and EIP-7702-enabled EOAs.

**Why this matters for our project:**

Even though Arc uses USDC as gas (so there's no volatile token to acquire), users still need USDC in their wallet to pay gas for the deposit transaction. With Circle Paymaster, we can sponsor this gas cost — the user deposits $200 USDC and the full $200 goes into the treasury. No gas friction at all.

This is especially important for the demo: judges shouldn't have to think about gas. They connect wallet, deposit USDC, done.

---

## Arc Testnet Reference

| Parameter | Value |
|-----------|-------|
| Network Name | Arc Testnet |
| Chain ID | `5042002` |
| Native Currency | USDC |
| RPC | `https://rpc.testnet.arc.network` |
| WebSocket | `wss://rpc.testnet.arc.network` |
| Block Explorer | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` |
| USDC Address | `0x3600000000000000000000000000000000000000` |
| EURC Address | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| CREATE2 Factory | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |

**EVM Compatibility Notes:**
- Full EVM compatibility targeting Prague hard fork
- Standard Solidity, Foundry, Hardhat, ethers.js, viem all work
- `SELFDESTRUCT` is disallowed during deployment
- `PREV_RANDAO` always returns 0 (use oracles for randomness)
- EIP-7702 is supported (EOAs as temporary smart contract accounts)
- USDC blocklist is enforced pre-mempool, post-mempool, and at runtime

---

## Track-by-Track Submission Strategy

### Track 1: Best Smart Contracts with Advanced Stablecoin Logic ($3K)

**What to highlight:**
- GroupTreasury contract extending ERC-8183 with multi-depositor conditional escrow
- Programmable spending rules: per-tx caps, daily caps, category budgets
- Agent-authorized autonomous spending with on-chain guardrails
- Group voting mechanism for over-limit expenses
- Automatic proportional settlement at trip end
- Full on-chain receipt system with event emissions per spend

**Deliverables:** Deployed contract on Arc testnet, architecture diagram, GitHub repo, demo video.

### Track 2: Best Chain Abstracted USDC Apps ($3K)

**What to highlight:**
- Users deposit USDC from any chain (Ethereum, Base, Arbitrum, Polygon, etc.)
- CCTP V2 Fast Transfers bridge to Arc in 8-20 seconds
- V2 Hooks auto-deposit into GroupTreasury on arrival
- Bridge Kit SDK integration in the frontend for seamless deposit UX
- StableFX for USDC ↔ EURC conversion during cross-border trips
- User never needs to know which chain the treasury lives on

**Deliverables:** Deployed contract on Arc testnet, cross-chain deposit flow working, architecture diagram, GitHub repo, demo video.

### Track 3: Best Agentic Economy with Nanopayments ($6K)

**What to highlight — this is our strongest track:**
- AI agent with ERC-8004 on-chain identity and reputation
- Agent uses x402/nanopayments to pay for real-time data APIs per-query from the group treasury
- Every API call is an auditable on-chain expense (settled in batches via Gateway)
- Agent spends autonomously from treasury for trip services (gas, food, lodging)
- Circle Programmable Wallets for MPC-secured agent key management
- Multi-tier spending: nanopayments for data, regular transactions for purchases, group votes for large expenses
- Full transparency: dashboard shows every cent the agent spent and earned in value

**The pitch:** "The agent doesn't just spend money — it spends money to think. Every restaurant recommendation, every gas price comparison, every weather alert costs a fraction of a cent in nanopayments from the group pool. The agent is a first-class economic actor in the agentic economy."

**Deliverables:** Deployed contracts, x402 integration working, agent identity registered, architecture diagram, GitHub repo, demo video.

---

## Architecture: How Arc Technologies Layer Together

```
┌─────────────────────────────────────────────────────────┐
│                     WEB FRONTEND                         │
│  Reown AppKit (wallet auth) + Trip Dashboard + Voice UI  │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────▼───────────┐
        │     ORCHESTRATOR      │
        │  FastAPI + SIWE Auth  │
        └───────────┬───────────┘
                    │
        ┌───────────▼───────────┐
        │   CLAUDE CODE SESSION │
        │   (Voice AI Agent)    │
        │                       │
        │  MCP Servers:         │
        │  ├── google-maps      │
        │  ├── trip-treasury ───┼──► GroupTreasury.sol (Arc)
        │  │   (Circle Wallets  │    ├── ERC-8183 escrow base
        │  │    API for signing)│    ├── Multi-depositor
        │  ├── trip-memory ─────┼──► 0G Storage
        │  └── voice-channel    │
        └───────────┬───────────┘
                    │
    ┌───────────────┼───────────────────┐
    │               │                   │
    ▼               ▼                   ▼
┌────────┐  ┌──────────────┐  ┌──────────────────┐
│ x402   │  │ CCTP V2 +    │  │  StableFX        │
│ Nano-  │  │ Gateway      │  │  (USDC ↔ EURC)   │
│payments│  │ (cross-chain │  │  FX conversion    │
│        │  │  deposits)   │  │  for cross-border │
│ Agent  │  │              │  │  payments         │
│ pays   │  │ Hooks auto-  │  └──────────────────┘
│ for    │  │ deposit into │
│ APIs   │  │ treasury     │
└────────┘  └──────────────┘

Agent Identity: ERC-8004 (IdentityRegistry + ReputationRegistry)
Agent Wallet: Circle Programmable Wallets (MPC, no raw keys)
Gas: Circle Paymaster sponsors user gas for deposits
```

---

## Key Documentation Links

| Resource | URL |
|----------|-----|
| Arc Docs | https://docs.arc.network/arc/concepts/welcome-to-arc |
| Arc LLM-friendly Index | https://docs.arc.network/llms.txt |
| Deploy on Arc Tutorial | https://docs.arc.network/arc/tutorials/deploy-on-arc |
| Bridge USDC to Arc | https://docs.arc.network/arc/tutorials/bridge-usdc-to-arc |
| Contract Addresses | https://docs.arc.network/arc/references/contract-addresses |
| EVM Compatibility | https://docs.arc.network/arc/references/evm-compatibility |
| Gas and Fees | https://docs.arc.network/arc/references/gas-and-fees |
| Account Abstraction | https://docs.arc.network/arc/tools/account-abstraction |
| Nanopayments | https://developers.circle.com/gateway/nanopayments |
| x402 Protocol | https://www.x402.org/ |
| Circle Wallets | https://developers.circle.com/wallets |
| Circle Gateway | https://developers.circle.com/gateway |
| Bridge Kit | https://developers.circle.com/bridge-kit |
| USDC Addresses | https://developers.circle.com/stablecoins/usdc-contract-addresses |
| EURC Addresses | https://developers.circle.com/stablecoins/eurc-contract-addresses |
| Faucet | https://faucet.circle.com |
| Block Explorer | https://testnet.arcscan.app |
| Circle Developer Portal | https://www.circle.com/developer |
| Circle Skills (AI tools) | `npx skills add circlefin/skills` |

---

## What Makes This Integration Deep, Not Surface-Level

1. **Nanopayments aren't bolted on — they're the agent's economic model.** The agent pays for its own intelligence per-query. This isn't "we added nanopayments because it was a prize track." It's "the agent is economically self-sustaining within the group's budget."

2. **ERC-8004 isn't decoration — it's trust infrastructure.** An AI spending from a shared pool needs verifiable identity and reputation. ERC-8004 gives the agent an auditable track record that makes people willing to trust it with their money.

3. **ERC-8183 isn't copying a standard — it's the right escrow primitive.** A road trip IS a job: funded by clients, executed by a provider, evaluated at completion. Using Arc's native standard instead of rolling custom escrow shows architectural maturity.

4. **CCTP V2 Hooks aren't a nice-to-have — they're the UX.** Without hooks, depositing from Ethereum is two transactions (bridge + deposit). With hooks, it's one action. This is the difference between "chain-abstracted" on paper and chain-abstracted in practice.

5. **StableFX isn't hypothetical — it's the road trip reality.** ETHGlobal is in Cannes, France. A road trip from Cannes crosses country borders. Multi-currency is the natural state of a European road trip, and Arc is the only chain with a native FX engine.

6. **Circle Programmable Wallets aren't optional — they're security.** A raw private key in a Claude Code session is a liability. MPC-secured wallets are how you actually give an AI agent economic autonomy without creating a security nightmare.
