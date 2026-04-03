# RoadTrip Co-Pilot

**"Give your car a wallet."**

Your car has eyes, ears, and a brain — but no wallet. It can't pay for gas, tolls, or food. RoadTrip Co-Pilot fixes that. Friends pool USDC into a shared on-chain treasury, and a voice-first AI agent manages the trip: finds stops, recommends options, and pays from the pool — autonomously.

Built for [ETHGlobal Cannes 2026](https://ethglobal.com/events/cannes2026).

## Architecture

```
Web App (voice + dashboard)
        |
  [orchestrator :8080]  <-- FastAPI, SIWE wallet auth, trip mgmt
     |         |
[Voice VM]  [voice-channel :9000]  <-- MCP bridge to Claude Code
 STT/TTS         |
            [Claude Code session]
              with MCP servers:
              +-- google-maps (places, directions)
              +-- treasury (smart contract)
              +-- trip-memory (0G storage)
              +-- weather
                      |
               [GroupTreasury.sol on Arc]
```

## Components

| Directory | What | Tech |
|-----------|------|------|
| `contracts/` | GroupTreasury smart contract | Solidity, Foundry |
| `mcp-servers/` | Custom MCP servers (treasury, memory) | TypeScript, Bun |
| `orchestrator/` | Backend API + voice pipeline | Python, FastAPI |
| `web/` | Frontend dashboard + voice UI | Next.js, Reown AppKit |
| `agent/` | Claude Code persona + MCP config | CLAUDE.md, .mcp.json |

## Quick Start

Each component has its own README with setup instructions. The general flow:

1. **Deploy contracts:** `cd contracts && forge test && forge script script/Deploy.s.sol`
2. **Start orchestrator:** `cd orchestrator && pip install -r requirements.txt && uvicorn main:app --port 8080`
3. **Start frontend:** `cd web && npm install && npm run dev`
4. **Start agent:** `cd agent && claude --dangerously-load-development-channels server:../voice-channel`

## Sponsor Tracks

| Sponsor | Track | Integration |
|---------|-------|-------------|
| **Arc** | Agentic Nanopayments ($6K) | AI agent pays for trip expenses via USDC |
| **Arc** | Stablecoin Logic ($3K) | Group escrow contract with programmable rules |
| **Arc** | Chain Abstracted USDC ($3K) | Treasury on Arc, cross-chain deposits via CCTP |
| **WalletConnect** | Pay ($4K) | Agent-initiated payments, spending UX |
| **WalletConnect** | Reown SDK ($1K) | Wallet-based auth replacing passwords |
| **0G** | OpenClaw Agent ($6K) | Agent framework + trip data on 0G Storage |

## How It Works

1. **Connect wallet** — No passwords. Your wallet is your identity (WalletConnect/Reown AppKit).
2. **Create a trip** — Set a name, budget, and spending limits.
3. **Friends deposit** — Everyone pools USDC into the shared treasury on Arc.
4. **Talk to the co-pilot** — "Find us somewhere to eat under $15." The AI searches, suggests, and pays.
5. **Settle up** — Trip ends, leftovers returned proportionally. On-chain receipts for everything.

## Team

Built by [snojj25](https://github.com/snojj25) at ETHGlobal Cannes 2026.
