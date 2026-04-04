## 1. Quick Test All Sponsors

Run everything from the repo root:

```bash
(cd contracts && forge test -vvv) && (cd mcp-servers/x402-mock && bun test) && (cd mcp-servers/trip-memory && bun test) && (cd mcp-servers/0g-compute && bun test) && (cd orchestrator && (source .venv/bin/activate 2>/dev/null || source venv/bin/activate) && pytest tests/ -v) && (cd web && npx playwright test)
```

Passing means every command exits `0`, Foundry stays green, Bun tests stay green, `pytest` stays green, and Playwright finishes without critical JS errors.

## 2. Arc Integration Testing

### Contracts

```bash
cd contracts && forge test -vvv
```

What to look for:

- `76` Foundry tests pass.
- `GroupTreasury` paths stay green for `createTrip`, `deposit`, `spend`, `nanopayment`, budgets, voting, and settlement.
- No unexpected reverts in spend-limit, daily-cap, or category-budget logic.

### x402 Mock

```bash
cd mcp-servers/x402-mock && bun test
```

Manual smoke test:

```bash
cd mcp-servers/x402-mock && bun start
curl http://localhost:4402/health
curl -i http://localhost:4402/gas-prices
curl http://localhost:4402/stats
```

What to look for:

- `/health` returns `status: ok` and `protocol: x402-mock`.
- Unpaid `/gas-prices` returns `402 Payment Required`.
- The `402` body includes `price`, `token`, `network`, and `recipient`.
- After paid flows, `/stats` shows non-zero `paymentCount` and endpoint totals.

### Treasury MCP

Start local Arc dependencies first:

```bash
cd contracts && anvil
```

In another terminal, seed a local treasury and mock USDC:

```bash
cd contracts && forge script script/IntegrationTest.s.sol:IntegrationTest --rpc-url http://127.0.0.1:8545 --broadcast
```

Start the x402 server:

```bash
cd mcp-servers/x402-mock && bun start
```

Start the agent in `agent/` with the treasury MCP loaded through `.mcp.json`:

```bash
cd agent
export RPC_URL=http://127.0.0.1:8545
export TREASURY_ADDRESS=<Treasury address printed by IntegrationTest>
export AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export CHAIN_ID=31337
export X402_SERVER_URL=http://localhost:4402
export TRIP_MEMORY_DIR=./trip-data
export OG_STORAGE_ENABLED=false
export OG_COMPUTE_ENABLED=false
claude
```

Paste these into Claude:

```text
Use treasury_balance for trip 0.
Use x402_data_request for trip 0 and endpoint "gas-prices".
Use pay_toll for trip 0, toll_amount_usd 2.60, route_description "A8 Nice -> Cannes".
Use book_hotel for trip 0, hotel_name "Hotel de Cannes Riviera", price_usd 95.
Use group_vote_request for trip 0, recipient "0x0000000000000000000000000000000000000405", amount_usd 150, category "lodging", description "Hotel approval test", threshold 2.
```

What to look for:

- `treasury_balance` returns JSON with `remaining_usd`, `nanopayment_total_usd`, `daily_spending_usd`, and member deposits.
- `x402_data_request` returns `success: true`, `payment_required: true`, and a nested `payment.tx_hash`.
- `pay_toll` returns `success: true` and a `toll_receipt`.
- `book_hotel` returns `success: true`, a `booking` object, and a `payment.tx_hash`.
- `group_vote_request` returns a `vote_id`; `group_vote_status` should show `pending` or `ready_to_execute`.

Note: the seeded `trip 0` from `IntegrationTest.s.sol` has a `$100` spend limit, so keep `book_hotel` at `<= 100` unless you create a new higher-limit trip.

### Full Arc Integration Script

```bash
cd contracts && anvil
cd contracts && forge script script/IntegrationTest.s.sol:IntegrationTest --rpc-url http://127.0.0.1:8545 --broadcast
```

What to look for in the script output:

- `Treasury:` and `USDC:` addresses.
- `Trip ID: 0`.
- `Deposited: $600`.
- `Nanopayments: 3 data API calls ($0.01 total)`.
- `Nanopayments: toll $4.50, parking $6.00`.
- `Spend: $38.50 food`.
- Final marker: `=== INTEGRATION TEST PASSED ===`.

## 3. 0G Integration Testing

### Storage

Unit tests:

```bash
cd mcp-servers/trip-memory && bun test
```

Round-trip upload/download:

```bash
export PK=<funded 0G private key>
cd mcp-servers/trip-memory
AGENT_PRIVATE_KEY=$PK OG_STORAGE_ENABLED=true bun -e '
import { ZeroGStorage } from "./storage-0g.ts";
const s = new ZeroGStorage({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  kvNodeUrl: "",
  flowContractAddress: "",
});
await s.initialize();
const res = await s.kvSet(1, "test", { hello: "world" });
console.log("Uploaded:", res.rootHash);
const data = await s.kvGet(1, "test");
console.log("Downloaded:", JSON.stringify(data));
process.exit(0);
'
```

What to look for:

- Unit tests pass.
- The round-trip prints `Uploaded: 0x...` and `Downloaded: {"hello":"world"}`.
- If the wallet is unfunded, you will see the 0G balance warning; uploads will not work until the key is funded.

### Compute

Unit tests:

```bash
cd mcp-servers/0g-compute && bun test
```

Provider setup and test inference:

```bash
export PK=<funded 0G private key>
cd mcp-servers/0g-compute && AGENT_PRIVATE_KEY=$PK bun setup.ts --test
```

What to look for:

- Unit tests pass.
- The setup script prints available providers.
- The test inference prints a model response.
- The verify step prints `TEE Verified: true` and a `Chat ID`.

Note: the setup script expects at least `3 0G` in the wallet.

### Contracts

Local contract tests:

```bash
cd contracts && forge test -vvv --match-path test/AgentNFT.t.sol
cd contracts && forge test -vvv --match-path test/AgentReputation.t.sol
cd contracts && forge test -vvv --match-path test/TripRegistry.t.sol
```

Live contract reads on Galileo:

```bash
export RPC=https://evmrpc-testnet.0g.ai
cast call 0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba "getAgent(uint256)" 0 --rpc-url $RPC
cast call 0xaf421c7fad3a550a7da7478b05df9f6b0611c14a "getAgentStats(uint256)" 0 --rpc-url $RPC
cast call 0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5 "getTrip(uint256)" 0 --rpc-url $RPC
```

What to look for:

- Local tests pass for all three contracts.
- `getAgent(0)` returns the iNFT metadata tuple.
- `getAgentStats(0)` returns rating/trip counters.
- `getTrip(0)` returns registered trip data from `TripRegistry`.

### Frontend Components

Set the 0G addresses and flags in the web env, then start the UI:

```bash
cat > web/.env.local <<'EOF'
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080
NEXT_PUBLIC_TREASURY_ADDRESS=<your_treasury_address>
NEXT_PUBLIC_USDC_ADDRESS=<your_usdc_address>
NEXT_PUBLIC_CHAIN_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_AGENT_NFT_ADDRESS=0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba
NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS=0xaf421c7fad3a550a7da7478b05df9f6b0611c14a
NEXT_PUBLIC_TRIP_REGISTRY_ADDRESS=0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5
NEXT_PUBLIC_OG_STORAGE_MODE=0g
NEXT_PUBLIC_OG_COMPUTE_MODE=0g
NEXT_PUBLIC_OG_HAS_KEY=1
EOF
cd web && npm run dev
```

Open `http://localhost:3000/trip/0`.

What to look for:

- The right column shows `Agent Identity`.
- The card shows `0G #0` and pulls on-chain metadata/rating if the 0G addresses are set.
- The `0G Infrastructure` card shows `Storage: 0G Network`, `Compute (TEE): Sealed Inference`, and `Chain: Galileo Testnet`.

Note: `ZeroGStatus` is env-driven UI. Use the storage, compute, and `cast` commands above as the real verification.

## 4. Reown/WalletConnect Testing

### Auth Flow

Start backend and frontend:

```bash
cd orchestrator && (source .venv/bin/activate 2>/dev/null || source venv/bin/activate) && uvicorn main:app --reload --port 8080
cd web && npm run dev
```

Backend nonce smoke test:

```bash
curl http://localhost:8080/v1/auth/nonce
```

Manual wallet auth:

- Open `http://localhost:3000`.
- Click the Reown `Connect Wallet` button.
- Connect an EVM wallet for the live auth path. The modal can show Solana wallets too, but SIWE is EVM-based here.
- Sign the SIWE message.
- Open `/trip/0` after signing.

What to look for:

- The AppKit modal opens from the `appkit-button`.
- The backend nonce endpoint returns `200`.
- After signing, the app stops showing the unauthenticated connect prompt.
- A session token is created and the trip page loads instead of the `Connect your wallet` gate.

### E2E Tests

Auth-focused UI checks:

```bash
cd web && npx playwright test e2e/auth.spec.ts
```

Full web E2E sweep:

```bash
cd web && npx playwright test
```

What to look for:

- The auth spec passes.
- The home page renders the Reown connect button and hero content.
- `/trip/0` shows the expected connect prompt when unauthenticated.
- No critical JS errors are reported by the browser tests.

## 5. Full E2E Demo Test

This is the fastest local rehearsal path. It uses Anvil for Arc, the local x402 server, the real 0G contracts/services, and the repo’s agent config.

### Terminal 1: Anvil

```bash
cd contracts && anvil
```

### Terminal 2: Seed Local Treasury + Mock USDC

```bash
cd contracts && forge script script/IntegrationTest.s.sol:IntegrationTest --rpc-url http://127.0.0.1:8545 --broadcast
```

Save the printed `Treasury:` and `USDC:` addresses. This script also seeds `trip 0` and gives Anvil account `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` mock USDC.

### Terminal 3: x402 Server

```bash
cd mcp-servers/x402-mock && bun start
```

### Terminal 4: Orchestrator

Repo-only text/demo backend:

```bash
cd orchestrator && (source .venv/bin/activate 2>/dev/null || source venv/bin/activate) && uvicorn main:app --reload --port 8080
```

If you want the exact voice path, run it with the external voice dependencies wired in:

```bash
cd orchestrator && (source .venv/bin/activate 2>/dev/null || source venv/bin/activate) && VOICE_CHANNEL_URL=http://localhost:9000 VOICE_VM_INTERNAL_IP=127.0.0.1 TTS_SERVICE_URL=http://localhost:8000 uvicorn main:app --reload --port 8080
```

Note: the exact `/v1/voice/converse` path depends on external `voice-channel` plus Whisper/Kokoro services. They are referenced by the repo, but they are not shipped inside this repo.

### Terminal 5: Web

```bash
cat > web/.env.local <<'EOF'
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>
NEXT_PUBLIC_ORCHESTRATOR_URL=http://localhost:8080
NEXT_PUBLIC_TREASURY_ADDRESS=<Treasury address from Terminal 2>
NEXT_PUBLIC_USDC_ADDRESS=<USDC address from Terminal 2>
NEXT_PUBLIC_CHAIN_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_AGENT_NFT_ADDRESS=0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba
NEXT_PUBLIC_AGENT_REPUTATION_ADDRESS=0xaf421c7fad3a550a7da7478b05df9f6b0611c14a
NEXT_PUBLIC_TRIP_REGISTRY_ADDRESS=0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5
NEXT_PUBLIC_OG_STORAGE_MODE=0g
NEXT_PUBLIC_OG_COMPUTE_MODE=0g
NEXT_PUBLIC_OG_HAS_KEY=1
EOF
cd web && npm run dev
```

### Terminal 6: Agent

Use the Anvil agent key. If you want 0G Storage and 0G Compute live, fund this same key on 0G Galileo too.

```bash
cd agent
export GOOGLE_MAPS_API_KEY=<your_google_maps_key>
export RPC_URL=http://127.0.0.1:8545
export TREASURY_ADDRESS=<Treasury address from Terminal 2>
export AGENT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export CHAIN_ID=31337
export X402_SERVER_URL=http://localhost:4402
export TRIP_MEMORY_DIR=./trip-data
export OG_STORAGE_ENABLED=true
export OG_RPC_URL=https://evmrpc-testnet.0g.ai
export OG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
export OG_COMPUTE_ENABLED=true
claude --dangerously-load-development-channels server:../voice-channel
```

If you do not have the external `../voice-channel` checkout, start plain Claude in `agent/` and use the Arc/0G prompts manually:

```bash
cd agent && claude
```

### Browser Run

1. Import Anvil account `0` into MetaMask.
2. Connect MetaMask to `http://127.0.0.1:8545` with chain ID `31337`.
3. Open `http://localhost:3000`.
4. Connect wallet and sign the SIWE message.
5. Create a new trip with agent address `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` and spend limit `300`.
6. After the create transaction, open `http://localhost:3000/trip/1` manually. `trip 0` is already occupied by the seed script.
7. Deposit USDC into `trip 1`.
8. If voice infra is running, say: `Book us a hotel in Cannes for tonight`, `We are approaching the toll on A8`, and `How is our budget?`
9. If you are using Claude manually, paste those same prompts into Claude and keep the browser on `/trip/1` for the treasury/spending UI.
10. Check `curl http://localhost:4402/stats` after the run.

What to look for:

- Wallet connect + SIWE succeed.
- `/trip/1` shows pool balance, member deposit, spending feed, `Agent Identity`, and `0G Infrastructure`.
- The x402 server stats show paid `/book-hotel` and `/pay-toll` calls.
- The spending feed shows `lodging` and `tolls`, and tolls carry the `nanopayment` badge.
- The Arc nanopayment card shows non-zero autonomous spend.

## 6. Demo Presentation Guide

Spend most of the three minutes on Arc Track 3. Use Reown in the first `15s`, show 0G during hotel evaluation and receipt storage, and treat Reown as the auth/connect layer, not the payment layer.

| Track | What to highlight | What judges see | What to say | Bounty mapping |
|---|---|---|---|---|
| Arc — Track 3: Best Agentic Economy with Nanopayments | The agent autonomously buys data, books services, and pays tolls from a shared USDC pool. | Reown connect, treasury funded on Arc, `book_hotel` and `pay_toll`, x402 stats, `nanopayment` badges, Arc nanopayment total. | `The agent pays for its own intelligence and roadside services. Every micro-payment is auditable and cheap enough to be practical on Arc.` | `x402_data_request`, `pay_toll`, `book_hotel`, `nanopayment_spend`, Arc USDC treasury, x402 endpoints. |
| Arc — Track 1: Best Smart Contracts with Stablecoin Logic | The treasury is programmable, not just a wallet. | Pool balance, spend limit, category budgets, daily spending, and the vote path in tests or MCP output. | `This is a programmable USDC treasury with caps, category budgets, voting, and settlement. The agent can spend, but only inside the rules.` | `GroupTreasury.sol`, `deposit`, `spend`, `requestVote`, category budgets, daily cap, settlement, on-chain receipts. |
| 0G — Best OpenClaw Agent | 0G is the agent’s memory, verified reasoning layer, and on-chain identity. | `Agent Identity`, `0G Infrastructure`, `TEE Verified: true` from compute setup, stored booking/receipt flow, live Galileo contract reads. | `We used 0G for verifiable evaluation, durable trip memory, and on-chain agent identity. The agent is not just chatting; it has memory and proof.` | `verified_evaluate`, `save_trip_data`, `save_trip_file`, `AgentNFT`, `AgentReputation`, `TripRegistry`. |
| 0G — Wildcard | The app is genuinely dual-chain: Arc for money, 0G for intelligence. | One hotel/toll flow touches Arc payments plus 0G compute/storage/identity in the same user action. | `Arc handles finance. 0G handles memory, verification, and identity. The product needs both.` | Cross-chain architecture, 0G compute + storage + chain, Arc payment execution in one end-to-end flow. |
| WalletConnect — Reown SDK | Fast wallet connection and SIWE auth with a clean user entry point. | The AppKit modal opens, wallet connects, SIWE signs, dashboard unlocks. | `Reown gives us the wallet UX and session auth. The same wallet that authenticates is the wallet that funds the trip.` | `appkit-button`, Reown AppKit, EVM adapter, visible Solana adapters in the modal, `AuthContext` + SIWE session flow. |

For judges, keep these backup proofs ready in separate tabs or terminals:

- Arc GroupTreasury on Arc Testnet: `0x8AdC5Db1e62E5553E0e0B811f3C512b0a9E140ba`
- 0G AgentNFT: `0x8adc5db1e62e5553e0e0b811f3c512b0a9e140ba`
- 0G AgentReputation: `0xaf421c7fad3a550a7da7478b05df9f6b0611c14a`
- 0G TripRegistry: `0x2e9f481d1c2f0b7f5d922e9036dd9e751e2d78d5`
