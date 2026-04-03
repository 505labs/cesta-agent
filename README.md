# RoadTrip Co-Pilot

**"Give your car a wallet."**

Your car has eyes, ears, and a brain — but no wallet. It can't pay for gas, tolls, or food. RoadTrip Co-Pilot fixes that. Friends pool USDC into a shared on-chain treasury, and a voice-first AI agent manages the trip: finds stops, recommends options, and pays from the pool — autonomously.

Built for [ETHGlobal Cannes 2026](https://ethglobal.com/events/cannes2026).

## Architecture

```
 +------------------+        +------------------+
 |    Web App       |        | Android Auto App |
 |   (Next.js)      |        |    (Kotlin)      |
 |  WalletConnect   |        |   Voice I/O      |
 +--------+---------+        +--------+---------+
          |                           |
          +----------+   +------------+
                     |   |
               +-----v---v------+         +------------------+
               |  Orchestrator  |-------->|   Voice VM (GPU) |
               |  (FastAPI)     |         |   Whisper STT    |
               |  :8080         |<--------|   Kokoro TTS     |
               +-------+--------+         +------------------+
                       |
              +--------v---------+
              |  voice-channel   |
              |  (MCP :9000)     |
              +--------+---------+
                       |
              +--------v---------+
              |  Claude Code     |         +------------------+
              |  Session (tmux)  |-------->| GroupTreasury.sol|
              |                  |         | (Arc / Anvil)    |
              |  MCP Servers:    |         +------------------+
              |  - google-maps   |
              |  - treasury -----+---------+
              |  - trip-memory   |
              |  - weather       |
              +------------------+
```

Both the **web app** and the **Android Auto app** talk to the same orchestrator and share the same AI agent. The only difference is the client UI.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for detailed architecture diagrams, data flows, component descriptions, and testing guide.

## Components

| Directory | What | Tech | Tests |
|-----------|------|------|-------|
| `contracts/` | GroupTreasury smart contract | Solidity, Foundry | 14/14 pass |
| `mcp-servers/` | Custom MCP servers (treasury, memory) | TypeScript, Bun | Smoke tested |
| `orchestrator/` | Backend API + voice pipeline | Python, FastAPI | 15/15 pass |
| `web/` | Frontend dashboard + voice UI | Next.js, Reown AppKit | Builds OK |
| `agent/` | Claude Code persona + MCP config | CLAUDE.md, .mcp.json | — |

## Quick Start

```bash
# Terminal 1: Local blockchain
cd contracts && anvil

# Terminal 2: Deploy contract
cd contracts && forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 --broadcast

# Terminal 3: Orchestrator
cd orchestrator && source .venv/bin/activate && uvicorn main:app --port 8080

# Terminal 4: Web frontend
cd web && npm run dev

# Terminal 5: Agent (optional — needs voice-channel from claude-superapp)
cd agent && claude --dangerously-load-development-channels server:../voice-channel
```

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
