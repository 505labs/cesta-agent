# Crypto-to-Merchant Payment Research — RoadTrip Co-Pilot

**Date:** 2026-04-03
**Purpose:** Research how the AI agent can pay at ANY real-world merchant (gas stations, restaurants, hotels) using the group USDC treasury — without requiring merchant crypto adoption
**Status:** Research complete

---

## The Core Problem

WalletConnect Pay only works where merchants have adopted it (Ingenico terminals, specific PSPs). A random gas station in Cannes won't have it. We need a way for the car's AI agent to spend USDC at **any** Visa/Mastercard terminal in the world.

## The Answer: Virtual Cards as the Bridge

The **only** production-ready way to pay at any physical merchant without merchant adoption is to put a virtual Visa/Mastercard between the USDC treasury and the POS terminal. The merchant sees a normal card payment. The crypto-to-fiat conversion happens server-side at the moment of card authorization.

```
Group USDC Treasury (on-chain)
       ↓  AI agent triggers spend
Card Issuing API (converts USDC → fiat at authorization)
       ↓
Virtual Visa/Mastercard (pushed to Apple Pay / Google Pay)
       ↓
User taps phone at any POS terminal
       ↓
Merchant gets fiat. Treasury gets debited USDC. On-chain receipt emitted.
```

No merchant changes. No crypto awareness needed on their end. 150M+ Visa merchant locations worldwide.

---

## The Dream UX

```
You're driving. Gas is low.

Agent: "Gas station in 0.5 miles. $42 estimated. Want me to set up payment?"

You: "Yeah, do it"

Agent: → Creates a task-scoped virtual card via card issuing API
       → Loads it with $50 from the USDC treasury (converted to EUR at spot)
       → Pushes to your Apple Pay

Agent: "Payment ready on your phone. Just tap when you're at the pump."

You tap your phone at the POS. Normal Visa transaction.

Agent: "Paid €42.30 for gas. €7.70 returned to treasury.
        Trip total: €127 of €600. Gas budget: €89 of €200."
```

The merchant never knew crypto was involved. The user never left the car app. The AI agent handled everything.

---

## Tier 1: Purpose-Built for AI Agents

These services have native AI agent integration (MCP servers, agent SDKs) — directly compatible with our Claude-powered architecture.

### 1. UQPAY FlashCard

**What it is:** Enterprise-grade card issuing for AI agents with a native MCP server. Launched March 2026.

**Why it's the top pick:**
- **Native MCP server** for Claude, GPT, and Gemini agents
- Issues **task-scoped cards**: create a virtual card per expense, set a spend limit, auto-invalidate after use
- Visa, Mastercard, and UnionPay principal member
- The AI agent can: create card → set $45 limit → user taps at gas station → card auto-destructs after single use
- Europe supported

**Integration model:** MCP server → Claude agent calls `create_card` tool → card number returned → pushed to Apple Pay → user taps → settlement in USDC

**Best for:** Per-transaction card issuance with automatic cleanup. Most secure model — each card is single-use.

**Source:** [UQPAY FlashCard PR](https://www.prnewswire.com/apac/news-releases/uqpay-launches-enterprise-grade-card-issuing-capabilities-for-ai-agents-302728705.html)

---

### 2. Wirex Agents

**What it is:** MCP server specifically for AI agents to issue cards, open virtual accounts, and execute autonomous stablecoin transactions. Launched March 2026.

**Key features:**
- MCP server integrates directly with Claude Code and other agent frameworks
- Visa + Mastercard principal member, 130 countries including Europe
- Non-custodial — funds stay in user control
- Can issue virtual cards, execute stablecoin transactions, and manage accounts programmatically
- Visa Direct push-to-card for instant funding
- Supports USDC + EURC on Stellar, Algorand, and more via BaaS

**Best for:** Full agent-controlled financial operations beyond just card issuance.

**Sources:**
- [Wirex Agents PR](https://www.prnewswire.com/news-releases/wirex-launches-wirex-agents-to-enable-ai-driven-stablecoin-cards-and-autonomous-micropayments-302702579.html)
- [Wirex Developer API](https://www.wirexapp.com/developers)
- [Wirex + Stellar Settlement](https://www.prnewswire.com/news-releases/wirex-and-stellar-go-live-with-dual-stablecoin-visa-settlement-in-usdc-and-eurc-for-7-million-users-302618287.html)

---

### 3. Crossmint

**What it is:** AI agent Visa/Mastercard virtual cards with spend guardrails. Designed for autonomous agent spending.

**Key features:**
- USDC on Base
- Spend guardrails configurable per card (amount limits, merchant categories, time limits)
- Settles in merchant's Stripe dashboard
- Purpose-built for AI agent commerce

**Best for:** Simple agent-to-merchant payments with Stripe settlement.

**Source:** [Crossmint AI Agent Cards](https://blockeden.xyz/blog/2026/03/16/crossmint-ai-agent-virtual-cards-autonomous-payments-kya-stripe-for-agents/)

---

## Tier 2: Developer-First APIs (Fastest Hackathon Integration)

These have strong developer APIs and proven track records. Not agent-native, but straightforward to wrap in MCP tools.

### 4. Holyheld SDK

**What it is:** npm package (`@holyheld/sdk`) that connects to any WalletConnect-compatible wallet and off-ramps USDC to Mastercard / Apple Pay.

**Why it's compelling:**
- **Direct WalletConnect synergy** — connects to the same wallets our users already use
- ~30 minute integration time
- France explicitly supported, 0% FX inside EEA
- 20+ chains: Ethereum, Arbitrum, Optimism, Base, Polygon, Solana, Avalanche, BNB, zkSync, Gnosis, Starknet, and more
- USDC is the only supported off-ramp token (perfect — that's what our treasury holds)
- Virtual card instant after KYC
- Gasless transactions supported
- Backed by Toyota Ventures

**Fee structure:**
- Card tiers: Classic €29, Limited €99, Metal €199 (one-time)
- Inside EEA: 0% FX
- Outside EEA: 2.5% + €1
- Up to 1% USDC cashback (Metal tier)

**Integration:**
```bash
npm install @holyheld/sdk
```

**Limitation:** SDK is off-ramp focused, not purpose-built for autonomous agent card issuance. Would need wrapping in MCP tools.

**Sources:**
- [Holyheld SDK](https://holyheld.com/sdk)
- [npm: @holyheld/sdk](https://www.npmjs.com/package/@holyheld/sdk)
- [Holyheld Fees](https://holyheld.com/legal/fees)

---

### 5. Kulipa

**What it is:** API-first card issuing infrastructure for crypto wallets. Paris-based startup.

**Why it's compelling:**
- **Paris-based** — strong narrative at ETHGlobal Cannes
- **EU EMI licensed** — regulated card issuer in Europe
- Mastercard partner
- Instant virtual card issuance + Apple Pay / Google Pay push provisioning
- USDC-native: supports USDC, wUSDC, Paxos on any EVM chain, L2s, Solana
- 120,000+ cards already issued, 20 customers including Flutterwave and Solflare
- Raised $9.2M total ($6.2M seed in April 2026)

**Integration:** REST API at `kulipa.readme.io/reference/intro-to-cards`

**Fee structure:** Processing fee + interchange (partner pricing, not public).

**Best for:** Production-grade card issuing with strong EU regulatory coverage. The "responsible" choice.

**Sources:**
- [Kulipa](https://www.kulipa.xyz/)
- [Kulipa API Docs](https://kulipa.readme.io/reference/intro-to-cards)
- [Kulipa $6.2M Raise](https://www.theblock.co/post/396063/stablecoin-card-kulipa-seed-round)
- [Kulipa + Mastercard](https://www.theblock.co/post/304287/crypto-payment-kulipa-mastercard-argent-debit-card)

---

### 6. Gnosis Pay

**What it is:** Self-custodial Visa debit card that spends directly from a Gnosis Safe smart contract.

**Why it's compelling:**
- **Most Web3-native model** — the Visa card IS backed by a smart contract (Safe)
- Hackathon-grade SDK: `gnosispay/account-kit` on GitHub
- 0% FX conversion, no monthly fees, only gas (~<€0.01 on Gnosis Chain)
- France supported (32 EU countries)
- Supports multisig, modules, and programmatic control on the Safe
- The Safe can be controlled by an AI agent via the Safe SDK

**Limitation:** EU spending requires EURe (Euro stablecoin), not raw USDC. Need to bridge USDC → Gnosis Chain → swap to EURe first. USDCe direct spending only available in non-EU markets.

**Fee structure:**
- ~€30 card issuance
- 0% FX, 0% conversion
- Only Gnosis Chain gas fees

**Integration:**
```bash
# Gnosis Pay account-kit SDK
git clone https://github.com/gnosispay/account-kit
```

**Sources:**
- [Gnosis Pay Docs](https://docs.gnosispay.com)
- [Hackers Guide to Gnosis Pay](https://www.gnosis.io/blog/a-hackers-guide-to-gnosis-pay)
- [Gnosis Pay GitHub](https://github.com/gnosispay)

---

### 7. Rain

**What it is:** Full B2B API for launching stablecoin-powered Visa cards. The most well-funded player.

**Key features:**
- Visa Principal Member — issues cards directly, no bank partner dependency
- 200+ partners, 150+ countries
- USDC on Ethereum, Solana, Stellar, Base, Arbitrum, Optimism, Avalanche
- Real-time crypto-to-fiat conversion at card authorization
- Instant programmatic virtual card issuance
- $250M Series C at $1.95B valuation (January 2026)

**Limitation:** Enterprise B2B pricing (requires sales conversation). May be overkill for hackathon.

**Sources:**
- [Rain Cards](https://www.rain.xyz/cards)
- [Rain $250M Series C](https://www.ledgerinsights.com/stablecoin-card-firm-rain-raises-250m-at-1-95b/)

---

### 8. Bridge (by Stripe)

**What it is:** Stablecoin infrastructure acquired by Stripe. Now powering Visa stablecoin cards in 100+ countries.

**Key features:**
- Visa + Bridge stablecoin-linked cards rolling out to 100+ countries
- Bridge API handles: receive → store → convert → issue → spend
- Stripe Issuing can generate programmatic virtual cards
- USDC on Ethereum, Solana, Polygon, Base
- Push provisioning to Apple Pay and Google Pay
- 175M Visa merchant locations
- Bridge received OCC national trust bank charter (Feb 2026)

**Limitation:** Currently live in 18 countries (Latin America first). Europe expansion underway but not confirmed for France yet.

**Fee structure:** 1.5% for stablecoin payments.

**Sources:**
- [Bridge Stablecoin Cards](https://www.bridge.xyz/product/cards)
- [Visa + Bridge 100 Countries](https://www.coindesk.com/business/2026/03/03/visa-and-bridge-plan-stablecoin-linked-card-expansion-to-over-100-countries)

---

## Tier 3: Additional Card Providers

### 9. Baanx

- Powers 6 of top 10 self-custodial wallets (MetaMask, Exodus, etc.)
- Smart contract pulls USDC from wallet at card authorization
- UK + EU EMI licensed
- Production API at `docs.baanx.com`
- Acquired for ~$175M (Nov 2025)

**Source:** [Baanx API Docs](https://docs.baanx.com/)

### 10. Immersve

- Mastercard Principal Member (unique — most are Visa)
- Deepest on-chain architecture: smart contracts hold USDC, spending withdrawn at transaction time
- USDC on Algorand, Arbitrum, Base, Ethereum, Polygon
- No card issuance fee
- Europe coverage unconfirmed

**Source:** [Immersve Docs](https://docs.immersve.com/)

### 11. MetaMask Card (Consumer)

- Powered by Baanx/Monavate
- USDC/USDT on Solana, Base, Linea
- Apple Pay / Google Pay
- EEA + UK + Canada
- No developer API — consumer product only

### 12. Bleap (Consumer)

- Mastercard on Arbitrum (EURe/stablecoins)
- 0% FX, up to 20% USDC cashback
- EEA/Switzerland including France
- No developer API — consumer product only

---

## Tier 4: Off-Ramp APIs (For End-of-Trip Settlement, Not POS)

These convert USDC to fiat bank transfers. Not instant enough for POS, but useful for returning unused treasury funds to participants.

| Service | Fee | Speed | Output | Europe/France | AI Agent API |
|---------|-----|-------|--------|---------------|-------------|
| **Coinbase CDP** | **0% for USDC** | US instant; EU 1-3d | Bank (SEPA) | Yes | Yes |
| **Transak** | 1% | Minutes | Bank (60+ countries) | Yes (115 countries) | Yes |
| **MoonPay** | ~1-2% (0% via Balance) | Near-instant (Balance) | Bank, PayPal, Venmo | Yes (SEPA) | Yes (MoonPay Agents) |
| **Ramp Network** | ~0.5-2% | Variable | Bank, card payout | Yes (150 countries) | Yes |
| **Circle Mint** | 0% redemption | Minutes (wire) | Bank (SEPA/SWIFT) | Yes | Yes (Circle Skills MCP) |
| **Alchemy Pay** | Varies | Instant (Visa/MC payout) | Bank, Visa/MC instant | Yes (173 countries) | Yes |
| **Bridge/Stripe** | 1.5% | Minutes | Bank, Visa card | Yes (100+ countries) | Yes |
| **Lightspark** | Enterprise | Seconds | Instant bank rails (65 countries) | Yes | Yes |

### Notable: MoonPay Agents
MoonPay launched **MoonPay Agents** (Feb 2026) — a non-custodial CLI giving AI agents 54 crypto-specific tools including full off-ramp to fiat. x402 compatible. Could be useful for treasury management.

**Source:** [MoonPay Agents PR](https://www.prnewswire.com/news-releases/moonpay-launches-moonpay-agents-the-onramp-for-the-agent-economy-302695744.html)

### Notable: Circle Skills
Circle launched **Circle Skills** — an open-source MCP-compatible skill pack (`npx skills add circlefin/skills`) that lets AI agents call Circle APIs (USDC, Programmable Wallets) directly from Claude Code.

**Source:** [Circle Skills](https://blockeden.xyz/blog/2026/03/15/circle-skills-open-source-ai-developer-tools-stablecoin-usdc-cursor-claude-code/)

---

## Tier 5: x402 Protocol (For API-Accessed Services)

**What it is:** HTTP-native payment protocol. When a server returns HTTP 402 "Payment Required," the client pays in USDC and retries with payment proof in the header.

**Scale (April 2026):** 119M transactions on Base, 35M on Solana. ~$600M annualized. Zero protocol fees.

**Foundation:** Coinbase + Linux Foundation launched the X402 Foundation on April 2, 2026. Founding coalition: Stripe, Cloudflare, AWS, Google, Microsoft, Visa, Mastercard.

**AI agent support:** Native. LangChain, CrewAI, AutoGPT, and Claude MCP all ship x402 adapters.

**For RoadTrip Co-Pilot:** Perfect for API-accessed services the agent calls — parking APIs, toll APIs, booking APIs, premium data APIs (gas prices, weather, restaurant reservations). NOT for physical POS terminals.

**Example:**
```
Agent calls parking reservation API →
API returns 402 Payment Required: 5 USDC on Base →
Agent signs payment from treasury → attaches proof to header → retries →
Parking reserved. USDC debited. On-chain receipt.
```

**Sources:**
- [x402 Protocol](https://www.x402.org/)
- [x402 GitHub (Coinbase)](https://github.com/coinbase/x402)
- [Cloudflare x402 Support](https://blog.cloudflare.com/x402/)
- [Circle: Autonomous Payments with x402](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402)

---

## WalletConnect Pay (For Merchants That Support It)

For completeness — WalletConnect Pay works at Ingenico terminals and PSPs that have opted in.

**Ingenico partnership:** 40M+ Android POS terminals in 120+ countries got a software update in January 2026. Stablecoin payments via QR scan: USDC/EURC on Ethereum, Polygon, Base, Arbitrum. Rolled out in Europe first (Ingenico is a French company).

**For RoadTrip Co-Pilot:** The hybrid approach — use WC Pay where available, fall back to virtual card where not.

**Sources:**
- [Ingenico + WalletConnect Pay](https://www.prnewswire.com/news-releases/ingenico-launches-digital-currency-solution-enabling-stablecoin-payments-at-physical-checkouts-in-partnership-with-walletconnect-pay-302661216.html)
- [40M Terminals](https://invezz.com/news/2026/01/13/ingenico-walletconnect-bring-native-stablecoin-checkout-to-40m-terminals/)

---

## Comparison Matrix: Card Issuers for AI Agent Treasury Spending

| Provider | MCP/Agent Native | Dev API | Virtual Cards | Apple Pay Push | USDC Chains | France/EU | Fees | KYC Required |
|----------|-----------------|---------|---------------|---------------|-------------|-----------|------|-------------|
| **UQPAY FlashCard** | Yes (MCP server) | Yes | Yes (task-scoped) | Yes | Multiple | Yes | Not public | Yes |
| **Wirex Agents** | Yes (MCP server) | Yes | Yes | Yes | Stellar, Algorand+ | Yes (130 countries) | Custom B2B | Yes |
| **Crossmint** | Agent-focused | Yes | Yes | Unknown | Base (USDC) | Yes | Not public | Yes |
| **Holyheld** | No (SDK) | Yes (npm) | Yes | Yes (Apple Pay) | 20+ chains | Yes (France) | €29-199 card; 0% EEA FX | Yes |
| **Kulipa** | No | Yes (REST) | Yes | Yes | Multi-chain | Yes (EU EMI) | Not public | Yes |
| **Gnosis Pay** | No (Safe SDK) | Yes (beta) | Yes | Unknown | Gnosis Chain | Yes (France) | 0% FX, €30 card | Yes |
| **Rain** | No | Yes (B2B) | Yes | Yes | Multi-chain | Yes (150 countries) | Custom B2B | Yes |
| **Bridge/Stripe** | No | Yes | Yes | Yes | ETH/SOL/Base/Poly | Expanding (18 live) | 1.5% | Yes |
| **Baanx** | No | Yes | Yes | Unknown | ETH, Solana | Yes (EU EMI) | Custom B2B | Yes |
| **Immersve** | No | Yes | Yes | Yes | ARB/Base/ETH/Poly | Unclear | No card fee | Yes |

---

## Recommended Architecture for RoadTrip Co-Pilot

### Primary: Hybrid Payment System

```
┌────────────────────────────────────────────────────┐
│                 AI AGENT PAYMENT LOGIC              │
│                                                     │
│  Agent detects payment context:                     │
│                                                     │
│  1. WalletConnect Pay merchant detected?            │
│     → Direct WC Pay flow (QR scan, USDC, on-chain) │
│                                                     │
│  2. API/HTTP service?                               │
│     → x402 protocol (USDC, on-chain, instant)       │
│                                                     │
│  3. Any other merchant (gas, food, hotel)?           │
│     → Virtual card flow:                             │
│       a. Create task-scoped virtual Visa/MC          │
│       b. Load with USDC from treasury               │
│       c. Push to user's Apple Pay                    │
│       d. User taps at POS                            │
│       e. Card auto-invalidates after use             │
│       f. Treasury debited, receipt on-chain          │
│                                                     │
│  4. End of trip settlement?                          │
│     → Off-ramp remaining USDC to bank (Coinbase 0%) │
│                                                     │
└────────────────────────────────────────────────────┘
```

### Card Issuer Recommendation for Hackathon

**Primary pick: UQPAY FlashCard**
- MCP server = drops directly into our Claude agent architecture
- Task-scoped cards = per-expense issuance with auto-cleanup
- Visa/MC principal = works everywhere

**Backup pick: Holyheld SDK**
- npm package = fast integration
- WalletConnect-compatible = synergy with our existing stack
- France supported with 0% FX
- 30-minute integration claim

**Narrative pick: Kulipa**
- Paris-based at a Cannes hackathon
- EU-regulated
- Mastercard issuing

### MCP Server Design for Card Payments

```
Custom MCP Server: payment-card-mcp
  ├── card_create       — issue a task-scoped virtual card
  │                       (params: amount, currency, merchant_category, expiry)
  ├── card_fund         — load USDC from treasury into card
  ├── card_status       — check if card has been used / amount spent
  ├── card_invalidate   — destroy card after use
  ├── card_provision    — push card to user's Apple Pay / Google Pay
  └── card_history      — list all cards issued for this trip
```

---

## Key Considerations

### KYC Requirement
All card issuers require KYC for the cardholder. For a hackathon demo, options include:
- Use the provider's sandbox/test mode
- Pre-KYC team members before the demo
- Simulate the card flow in the demo while showing real on-chain treasury debits

### Hackathon Feasibility
- UQPAY and Wirex MCP servers may require API key approval (contact during hackathon)
- Holyheld SDK is on npm and may be fastest to get running
- Gnosis Pay has a "hackers guide" blog post specifically for hackathon builders
- Most providers have sandbox/testnet modes

### WalletConnect Bounty Compatibility
The virtual card approach **complements** WalletConnect Pay, not replaces it:
- WalletConnect Pay = direct crypto payment where merchants support it
- Virtual card = fallback for everywhere else
- Both use the same USDC treasury and on-chain receipt system
- The WC Pay bounty judges will appreciate seeing a realistic hybrid approach

---

## Sources

### Card Issuers
- [UQPAY FlashCard](https://www.prnewswire.com/apac/news-releases/uqpay-launches-enterprise-grade-card-issuing-capabilities-for-ai-agents-302728705.html)
- [Wirex Agents](https://www.prnewswire.com/news-releases/wirex-launches-wirex-agents-to-enable-ai-driven-stablecoin-cards-and-autonomous-micropayments-302702579.html)
- [Crossmint AI Cards](https://blockeden.xyz/blog/2026/03/16/crossmint-ai-agent-virtual-cards-autonomous-payments-kya-stripe-for-agents/)
- [Holyheld SDK](https://holyheld.com/sdk)
- [Kulipa](https://www.kulipa.xyz/)
- [Kulipa API](https://kulipa.readme.io/reference/intro-to-cards)
- [Gnosis Pay Docs](https://docs.gnosispay.com)
- [Gnosis Pay Hackers Guide](https://www.gnosis.io/blog/a-hackers-guide-to-gnosis-pay)
- [Rain Cards](https://www.rain.xyz/cards)
- [Bridge/Stripe Cards](https://www.bridge.xyz/product/cards)
- [Baanx API](https://docs.baanx.com/)
- [Immersve Docs](https://docs.immersve.com/)

### Off-Ramp APIs
- [Coinbase CDP Off-Ramp](https://docs.cdp.coinbase.com/onramp-&-offramp/offramp-apis/offramp-overview)
- [Coinbase 0% USDC](https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc)
- [MoonPay Agents](https://www.prnewswire.com/news-releases/moonpay-launches-moonpay-agents-the-onramp-for-the-agent-economy-302695744.html)
- [Transak Docs](https://docs.transak.com/docs/transak-off-ramp)
- [Circle Skills MCP](https://blockeden.xyz/blog/2026/03/15/circle-skills-open-source-ai-developer-tools-stablecoin-usdc-cursor-claude-code/)
- [Circle Autonomous Payments + x402](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402)

### Protocols
- [x402 Protocol](https://www.x402.org/)
- [x402 GitHub](https://github.com/coinbase/x402)
- [Cloudflare x402](https://blog.cloudflare.com/x402/)
- [WalletConnect Pay + Ingenico](https://www.prnewswire.com/news-releases/ingenico-launches-digital-currency-solution-enabling-stablecoin-payments-at-physical-checkouts-in-partnership-with-walletconnect-pay-302661216.html)

### Market Context
- [Visa + Bridge 100 Countries](https://www.coindesk.com/business/2026/03/03/visa-and-bridge-plan-stablecoin-linked-card-expansion-to-over-100-countries)
- [Stablecoin Cards 2026](https://insights4vc.substack.com/p/the-state-of-stablecoin-cards)
- [Apple NFC Opening for USDC](https://cointelegraph.com/news/usdc-embrace-tap-and-go-payments-apple-opens-up-nfc)
- [Mesh + Apple Pay](https://www.prnewswire.com/news-releases/stablecoin-payments-are-now-available-on-apple-pay-through-mesh-302443024.html)
