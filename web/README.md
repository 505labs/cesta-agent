# RoadTrip Co-Pilot -- Web Frontend

Next.js web app with WalletConnect login, trip management, treasury dashboard, and voice interface.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and other values
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com) |
| `NEXT_PUBLIC_ORCHESTRATOR_URL` | Backend URL (default: `http://localhost:8080`) |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | Deployed GroupTreasury contract address |
| `NEXT_PUBLIC_USDC_ADDRESS` | USDC token address on the target chain |
| `NEXT_PUBLIC_CHAIN_RPC_URL` | Chain RPC URL (default: `http://127.0.0.1:8545` for local Anvil) |

## Architecture

```
src/
  app/
    layout.tsx          # Root layout with WagmiProvider + AppKit
    page.tsx            # Landing page / connect wallet / trip list
    trip/[id]/page.tsx  # Trip dashboard (treasury + voice + spending)
  components/
    ConnectButton.tsx   # Reown AppKit connect button
    CreateTrip.tsx      # Trip creation form (on-chain)
    TreasuryDashboard.tsx  # Balance, deposits, members, deposit form
    SpendingFeed.tsx    # Transaction history by category
    VoiceInterface.tsx  # Push-to-talk mic + text chat fallback
  lib/
    wagmi.ts            # Wagmi + custom Anvil chain config
    appkit.tsx          # Reown AppKit provider setup
    treasury.ts         # Contract read/write hooks (wagmi)
    api.ts              # Orchestrator REST client
  abi/
    GroupTreasury.json  # Contract ABI
```

## Features

- **Wallet Auth:** Connect via WalletConnect / Reown AppKit (no passwords)
- **Trip Creation:** Create trips on-chain with agent address and spend limit
- **Treasury Dashboard:** Live pool balance, per-member deposits, spending progress
- **Voice Interface:** Push-to-talk mic (MediaRecorder -> orchestrator -> WAV playback)
- **Text Chat:** Fallback text input that calls the orchestrator text endpoint
- **Spending Feed:** Transaction history with category breakdown (food, gas, lodging, activities)
- **Deposit Flow:** ERC20 approve + deposit into the group treasury

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Reown AppKit + WalletConnect
- wagmi + viem (contract interaction)
- TanStack React Query
