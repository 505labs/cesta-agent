# Reown AppKit Integration — RoadTrip Co-Pilot

**Date:** 2026-04-03 (revised 2026-04-04)
**Purpose:** Wallet connection + authentication infrastructure via Reown AppKit
**Status:** Integrated. WalletConnect Pay removed — all payments go through Arc.

---

## What Changed (2026-04-04)

**WalletConnect Pay has been removed from the project.** The WC Pay integration overlapped with Arc nanopayments (both are agent payment rails), and WC Pay doesn't support Arc as a settlement chain. This created a dual-chain problem with no clean resolution.

**What we keep:** Reown AppKit for wallet connection and SIWE authentication. This is infrastructure — it's how users connect their wallets and log in. It doesn't handle payments.

**What we removed:**
- WalletConnect Pay SDK (`@walletconnect/pay`, `@walletconnect/pay-cli`)
- WalletConnect Agent SDK (`@walletconnect/cli-sdk`) for payment execution
- The `walletconnect-agent-mcp` server concept
- Smart Sessions (ERC-7715) — these were a WC-specific feature for delegating spending permissions. The treasury contract's per-tx caps serve the same purpose more simply.
- x402 via WalletConnect — x402 is now purely through Arc/Circle nanopayments
- WC Pay merchant dashboard, WCPay ID
- All three WC Pay bounty focus areas (Recurring Payments, Tap-to-Pay, Open Track)

**Sponsor status:** WalletConnect Reown SDK ($1K) is an incidental submission, not a focus. The $4K WC Pay track is dropped.

---

## Reown AppKit — What We Use

Reown AppKit is the wallet connection and authentication library. It provides:

### 1. Multi-Chain Wallet Connection

Reown AppKit's modal supports EVM + Solana in a single interface. Users connect whatever wallet they have — MetaMask, Phantom, Coinbase Wallet, etc.

```
Trip member opens app →
  Reown AppKit modal appears →
  Detects available wallets →
  User connects (QR scan, browser extension, or mobile) →
  Wallet address becomes their identity
```

**Configuration:**
```typescript
import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";

// EVM chains: Arc testnet + Sepolia (for testing)
// Solana: mainnet + devnet
const appKit = createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID,
  // ...
});
```

### 2. SIWE Authentication (Wallet = Identity)

Sign-In with Ethereum replaces passwords/API keys. The wallet signature proves ownership.

```
User connects wallet →
  App requests SIWE signature →
  User signs in wallet →
  Backend verifies signature, issues session token →
  All API calls use Bearer token tied to wallet address
```

No accounts, no passwords, no email verification. The wallet IS the identity.

### 3. ConnectButton Component

Drop-in UI component for wallet connection/disconnection:

```tsx
import { useAppKit } from "@reown/appkit/react";

export function ConnectButton() {
  const { open } = useAppKit();
  return <button onClick={() => open()}>Connect Wallet</button>;
}
```

---

## What Reown AppKit Does NOT Do

- **Payments.** All payments go through Arc (nanopayments for micro-tx, treasury contract for larger).
- **Cross-chain bridging.** CCTP V2 handles USDC bridging to Arc. AppKit just connects the wallet.
- **Agent transactions.** The agent uses Circle Programmable Wallets (MPC), not any WalletConnect SDK.
- **Group approval.** Approval is in-app (tap to approve), not a WalletConnect Pay flow.

---

## NPM Packages (Kept)

- `@reown/appkit` — main AppKit SDK
- `@reown/appkit-adapter-wagmi` — EVM adapter
- `@reown/appkit-adapter-solana` — Solana adapter (if multi-chain needed)

## NPM Packages (Removed)

- ~~`@walletconnect/cli-sdk`~~ — agent wallet operations (replaced by Circle Programmable Wallets)
- ~~`@walletconnect/pay-cli`~~ — agent payment operations (replaced by Arc nanopayments)
- ~~`@walletconnect/pay`~~ — standalone Pay SDK
- ~~`@reown/walletkit`~~ — WalletKit with Pay
- ~~`@reown/appkit-siwx`~~ — only needed if doing cross-chain SIWX beyond basic SIWE

---

## Reown SDK Bounty ($1K) — Incidental Submission

This is not a focus, but we qualify naturally:

| Requirement | How We Meet It |
|-------------|---------------|
| Use Reown AppKit | Yes — wallet connection + auth |
| 2+ chain ecosystems OR Reown Auth | Yes — EVM + Solana if configured, or just SIWE auth |
| Working demo | Yes |
| Public GitHub repo | Yes |

The $1K is a nice bonus but not worth optimizing for. Our effort goes to Arc ($9K) and 0G ($6K).

---

## Key Resources

- [Reown AppKit Docs](https://docs.reown.com/appkit/overview)
- [AppKit Web Examples](https://github.com/reown-com/appkit-web-examples)
- [WalletConnect Cloud Dashboard](https://cloud.walletconnect.com/) — get Project ID
