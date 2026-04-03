# 0G Integration Strategy — RoadTrip Co-Pilot

**Date:** 2026-04-03
**Purpose:** Maximize 0G bounty eligibility ($15K total: $6K OpenClaw Agent + $6K DeFi + $3K Wildcard)
**Primary Target:** Best OpenClaw Agent on 0G ($6K) — using Claude Code as "alternative Claw agent"
**Status:** Research complete, integration architecture proposed

---

## Executive Summary

0G (Zero Gravity) is a modular AI-native Layer-1 blockchain that provides four infrastructure layers: Chain, Storage, Compute, and Data Availability. For RoadTrip Co-Pilot, 0G isn't just another sponsor checkbox — it provides the **persistent brain and verifiable nervous system** for our AI agent.

The critical insight: the "Best OpenClaw Agent" bounty explicitly says **"OpenClaw or alternative Claw agents."** We don't need to use OpenClaw. Claude Code IS our agent framework — a persistent, tool-using AI agent running in a tmux session with MCP servers. This maps directly to 0G's agent vision, and we argue it's a *stronger* agent architecture than OpenClaw for our use case because Claude's reasoning capabilities far exceed what a routing-layer framework like OpenClaw provides.

**What 0G gives us that nothing else does:**

| 0G Component | What It Replaces | Why It's Better |
|--------------|-----------------|-----------------|
| 0G Storage | Filesystem / database | Decentralized, permanent, survives infra failures, content-addressed |
| 0G KV Store | Redis / PostgreSQL | Decentralized key-value with stream-based versioning |
| 0G Compute | Direct API calls | Verifiable inference via TEE sealed execution, privacy guarantees |
| 0G Chain | N/A (complementary to Arc) | Agent identity via iNFTs, on-chain reputation |
| iNFT (ERC-7857) | No equivalent | Agent as ownable, tradeable, composable on-chain asset |

---

## What Is 0G?

0G is the first decentralized AI operating system — a modular L1 that orchestrates hardware (storage, compute) and software (data, models) for AI workloads at scale. Live on mainnet (Aristotle, September 2025) with 100+ partners.

### Core Components

**0G Chain** — High-speed EVM-compatible L1. Chain ID: 16602 (Galileo testnet), 16661 (mainnet). Up to 2,500 TPS per shard with sub-second finality. Supports Cancun-Deneb opcodes. Native token: 0G.

**0G Storage** — Decentralized storage optimized for AI data (models, datasets, agent state). 10-100x cheaper than alternatives. Files split across hundreds of nodes with Merkle-tree-based content addressing. Two modes: Turbo (faster, higher fees) and Standard (slower, cheaper). Supports both file storage and KV (key-value) store.

**0G Compute Network** — Decentralized AI inference with TEE-based Sealed Inference. Every inference call executes inside hardware-isolated enclaves (Intel TDX + NVIDIA H100/H200 in TEE mode). Responses are cryptographically signed. OpenAI-compatible API. Models available on testnet: qwen-2.5-7b-instruct, qwen-image-edit-2511. Mainnet: GLM-5-FP8, deepseek-chat-v3-0324, gpt-oss-120b, qwen3-vl-30b, whisper-large-v3, z-image.

**0G DA (Data Availability)** — Infinitely scalable DA layer. 50,000x faster than Ethereum DA. Supports AI rollups, gaming chains, high-frequency trading.

**iNFTs (ERC-7857)** — Intelligent NFTs for AI agents. Unlike ERC-721 (which just points to metadata), iNFTs contain the actual encrypted AI agent. Ownership transfers include the intelligence itself — model weights, memory, behavioral traits — encrypted and re-encrypted for each new owner via TEE oracles.

---

## 0G Prize Tracks at ETHGlobal Cannes 2026

0G is offering **$15,000** across three tracks:

### Track 1: Best OpenClaw Agent on 0G — $6,000 (1st: $3K, 2nd: $2K, 3rd: $1K)

> Build applications integrating OpenClaw (open-source AI agent framework) **or alternative Claw agents** with 0G's decentralized infrastructure. Projects should leverage 0G Compute for inference, Storage for persistent memory, Chain for on-chain actions/payments, and iNFTs (ERC-7857) for agent ownership/composability.

**What they want to see:**
- "Digital Twin" agents using 0G Compute for private inference and Storage for memory/RAG
- Multi-agent swarms coordinating via Compute and settling on-chain
- Agent reputation & KYA (Know Your Agent) systems with on-chain history tied to iNFT identity
- Sandboxed execution with TEE safety rails and automatic royalty splits
- Interactive AI companions with persistent 0G Storage memory

**This is our primary target.** We qualify on every dimension:
- Claude Code IS our "alternative Claw agent" — a persistent AI agent with tool use
- 0G Storage provides persistent trip memory
- 0G Compute provides verifiable inference for spending decisions
- iNFT gives the agent tokenized identity and reputation
- 0G Chain records agent actions and reputation on-chain

### Track 2: Best DeFi App on 0G — $6,000 (1st: $3K, 2nd: $2K, 3rd: $1K)

> AI-native DeFi experiences that are autonomous, verifiable, and economically self-sustaining.

**Not our primary target** but we have a secondary angle: the agent autonomously manages a USDC treasury with spending rules — this IS autonomous DeFi. The treasury contract could be deployed on 0G Chain as a secondary deployment (Arc is primary).

### Track 3: Wildcard on 0G — $3,000 (up to 2 teams at $1.5K each)

> Build anything creative showcasing 0G's AI-native L1 that doesn't fit into OpenClaw or DeFi categories.

**Potential secondary submission** — our project spans AI agents + payments + group coordination, which is genuinely novel and doesn't fit neatly into either OpenClaw-only or DeFi-only categories.

### Qualification Requirements (All Tracks)

- Project name and short description
- Contract deployment addresses (on 0G Chain)
- Public GitHub repo with README and setup instructions
- Demo video (<=3 minutes) and live demo link
- Explanation of protocol features/SDKs used
- Team member names and contact info (Telegram & X)

---

## Why Claude Code as "Alternative Claw Agent" Is a Stronger Framing Than Using OpenClaw

OpenClaw is a general-purpose personal AI assistant framework — a Gateway that routes messages from 22+ channels (WhatsApp, Telegram, Slack, etc.) to LLM-powered agents with tools ("Skills"). It's designed for single-user, self-hosted personal assistant use cases.

Our architecture uses Claude Code — Anthropic's agentic coding tool — as a persistent AI agent running in a tmux session. This is fundamentally different and, we argue, *better* for our use case:

| Dimension | OpenClaw | Claude Code Agent |
|-----------|----------|-------------------|
| **Agent Intelligence** | Routes to LLM providers, basic tool dispatch | Claude Opus/Sonnet with deep reasoning, tool use, multi-step planning |
| **Tool System** | "Skills" — generic plugin system | MCP (Model Context Protocol) servers — typed, composable, ecosystem-standard |
| **Persistence** | Session-based, Gateway manages state | tmux session with persistent context, CLAUDE.md persona |
| **Voice Pipeline** | No native voice support | Full STT/TTS pipeline (Whisper + Kokoro) already built |
| **Domain Fit** | Personal assistant across messaging channels | Purpose-built for complex multi-tool workflows (maps, payments, storage) |
| **Blockchain Integration** | No native support | MCP servers for EVM, treasury management, 0G Storage |

**The key argument for judges:** "We used Claude Code as our agent framework because it provides superior reasoning, native MCP tool integration, and a proven voice pipeline. OpenClaw is designed for chat routing — our agent needs to reason about budgets, compare gas prices, navigate routes, and make autonomous spending decisions. Claude Code is the right tool for the job."

The bounty says "alternative Claw agents" — this is our alternative. It's not a cop-out; it's a deliberate architectural choice that results in a more capable agent.

---

## Meaningful Integration Points

### 1. 0G Storage — The Agent's Long-Term Memory

**What it is:** Decentralized, content-addressed storage with both file and key-value interfaces. Data persists permanently across the 0G network, identified by Merkle root hashes.

**Why this is meaningful, not bolted on:**

Without persistent memory, our AI agent is goldfish-brained. Every time the Claude Code session restarts (which happens — tmux sessions die, VMs reboot, hackathon demos crash), the agent loses everything: user preferences, conversation history, itinerary state, spending context.

0G Storage solves this structurally:

**File Storage — Trip Artifacts:**
- Trip photos uploaded by members -> stored on 0G, referenced by root hash
- Complete conversation transcripts -> searchable trip journal
- Generated trip reports -> permanent, shareable, verifiable artifacts
- Receipts and spending summaries -> auditable history

**KV Store — Structured Trip State (This is the killer feature):**

0G's KV store provides a decentralized key-value database with stream-based versioning. Each trip gets a KV stream, and the agent reads/writes structured data:

```
Stream: trip:{tripId}
  preferences      -> {"dietary": ["vegetarian"], "budget": "moderate", "music": ["rock"]}
  itinerary        -> {"stops": [...], "eta": "2h15m", "nextStop": "gas_station_xyz"}
  members          -> {"alice": {"deposited": 200, "spent": 127}, "bob": {...}}
  conversation     -> [{"role": "user", "content": "find lunch"}, ...]
  spending:latest  -> {"total": 340, "categories": {"food": 150, "gas": 120, "lodging": 70}}
  receipt:{txHash} -> {"amount": 38.50, "merchant": "BBQ Place", "category": "food"}
  agent:state      -> {"lastLocation": [43.5, 7.0], "mode": "driving", "alertsActive": true}
```

**Why KV over a traditional database:**
- **Survives everything.** Server crashes, session restarts, even infrastructure changes. The data is on the 0G network, not on our server.
- **Cross-device access.** A trip member opens the app on their phone — the agent loads the same state from 0G Storage that was written from the car's voice interface.
- **Verifiable.** Every KV write produces a Merkle root hash and a transaction on 0G Chain. The trip history is tamper-proof.
- **No server dependency.** We don't need to run a database. 0G IS the database.

**Implementation — Trip Memory MCP Server:**

```typescript
// trip-memory-mcp/src/index.ts
import { ZgFile, Indexer, MemData, KvClient, Batcher } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';
const RPC_URL = 'https://evmrpc-testnet.0g.ai';

// MCP Tool: save_trip_data
async function saveTripData(tripId: string, key: string, value: any) {
  const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY,
    new ethers.JsonRpcProvider(RPC_URL));
  const indexer = new Indexer(INDEXER_RPC);

  const [nodes, err] = await indexer.selectNodes(1);
  const batcher = new Batcher(1, nodes, flowContract, RPC_URL);

  const streamId = `trip:${tripId}`;
  const keyBytes = new TextEncoder().encode(key);
  const valueBytes = new TextEncoder().encode(JSON.stringify(value));

  batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);
  const [tx, batchErr] = await batcher.exec();

  return { success: true, txHash: tx.txHash };
}

// MCP Tool: load_trip_data
async function loadTripData(tripId: string, key: string) {
  const kvClient = new KvClient(KV_NODE_URL);
  const streamId = `trip:${tripId}`;
  const keyBytes = new TextEncoder().encode(key);

  const value = await kvClient.getValue(streamId,
    ethers.encodeBase64(keyBytes));

  return JSON.parse(new TextDecoder().decode(value));
}

// MCP Tool: save_trip_file
async function saveTripFile(filePath: string) {
  const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY,
    new ethers.JsonRpcProvider(RPC_URL));
  const indexer = new Indexer(INDEXER_RPC);

  const file = await ZgFile.fromFilePath(filePath);
  const [tree, treeErr] = await file.merkleTree();
  const [tx, uploadErr] = await indexer.upload(file, RPC_URL, signer);
  await file.close();

  return { rootHash: tx.rootHash, txHash: tx.txHash };
}

// MCP Tool: load_trip_file
async function loadTripFile(rootHash: string, outputPath: string) {
  const indexer = new Indexer(INDEXER_RPC);
  const err = await indexer.download(rootHash, outputPath, true);
  return { success: !err, path: outputPath };
}
```

**MCP Server Tool Definitions:**

```json
{
  "tools": [
    {
      "name": "save_trip_data",
      "description": "Save structured trip data to 0G Storage KV store. Use for preferences, itinerary, spending state, conversation history.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tripId": { "type": "string" },
          "key": { "type": "string", "description": "Data key (e.g. 'preferences', 'itinerary', 'spending:latest')" },
          "value": { "type": "object", "description": "JSON-serializable data to store" }
        },
        "required": ["tripId", "key", "value"]
      }
    },
    {
      "name": "load_trip_data",
      "description": "Load structured trip data from 0G Storage KV store. Retrieves persisted state that survives session restarts.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tripId": { "type": "string" },
          "key": { "type": "string" }
        },
        "required": ["tripId", "key"]
      }
    },
    {
      "name": "save_trip_file",
      "description": "Upload a file (photo, report, receipt) to 0G decentralized storage. Returns content-addressed root hash.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "filePath": { "type": "string" }
        },
        "required": ["filePath"]
      }
    },
    {
      "name": "load_trip_file",
      "description": "Download a file from 0G storage by its root hash.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "rootHash": { "type": "string" },
          "outputPath": { "type": "string" }
        },
        "required": ["rootHash", "outputPath"]
      }
    }
  ]
}
```

**Demo narrative:** "When the agent starts a new session, the first thing it does is load the trip state from 0G Storage. It remembers where you left off, what everyone's dietary restrictions are, and how much you've spent. This isn't a database on our server — it's decentralized, permanent, and verifiable. The trip data belongs to the group, not to us."

---

### 2. 0G Compute — Verifiable Inference for Spending Decisions

**What it is:** Decentralized AI inference running inside Trusted Execution Environments (TEEs). Every response is cryptographically signed by the enclave. Intel TDX + NVIDIA H100/H200 in TEE mode. OpenAI-compatible API.

**Why this is meaningful, not bolted on:**

Our agent makes financial decisions with other people's money. The core trust problem: **how do you prove the AI actually recommended the cheapest gas station, not a sponsored one?** How do you prove the spending decisions are the output of the actual AI model, not a tampered version?

0G Sealed Inference solves this:

**Use Case 1: Verifiable Spending Recommendations**

When the agent evaluates spending options (compare gas prices, rank restaurants, assess hotel value), the evaluation query runs through 0G Compute's sealed inference. The response comes back cryptographically signed by the TEE enclave, proving:
- The specific model processed the query
- The input data was not tampered with
- The output was not modified by the node operator

This creates an **on-chain audit trail of verified AI decisions:**

```
Agent receives: "Find us somewhere to eat"
  -> Agent queries Google Maps MCP for nearby restaurants (5 options)
  -> Agent sends evaluation prompt to 0G Compute (sealed inference):
      "Given these 5 restaurants with prices, ratings, and distance,
       rank them for a group of 3 with a $15/person budget.
       One member is vegetarian."
  -> 0G Compute returns signed response: "Recommended: Green Garden Bistro"
  -> Agent stores the signed inference result to 0G Storage as receipt
  -> Agent says: "Green Garden Bistro looks perfect -- vegetarian-friendly,
     $12 average, 4.7 stars, 0.5 miles off route."
```

The signed inference receipt means anyone can verify: the agent genuinely recommended this restaurant based on the model's reasoning, not because of a hidden incentive.

**Use Case 2: Privacy-Preserving Financial Analysis**

The agent processes sensitive financial data — group spending patterns, individual budgets, running totals. With sealed inference, this financial analysis happens inside the TEE. The node operator running the GPU cannot see:
- How much each person has spent
- What the group's budget limits are
- Individual spending patterns

This is a genuine privacy improvement over sending financial queries to a centralized API.

**Use Case 3: Secondary AI for Specialized Tasks**

0G Compute provides access to models we might not otherwise use:
- **whisper-large-v3** — We could use 0G's Whisper for verifiable speech-to-text, proving the agent heard what you actually said
- **deepseek-chat-v3-0324** — Secondary model for spending analysis or itinerary optimization
- **qwen3-vl-30b** — Vision-language model for analyzing trip photos or reading menus

**Implementation — 0G Compute Integration:**

```typescript
// In the trip-treasury MCP server or a dedicated compute MCP server
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { ethers } from 'ethers';

const RPC_URL = 'https://evmrpc-testnet.0g.ai';

async function verifiedInference(prompt: string, providerAddress: string) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);

  // Get service metadata and auth headers
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
  const headers = await broker.inference.getRequestHeaders(providerAddress);

  // Make inference call -- runs inside TEE
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a trip spending advisor. Evaluate options objectively.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await response.json();

  // Verify the response was produced inside the TEE
  const chatID = response.headers.get('ZG-Res-Key') || data.id;
  if (chatID) {
    const isValid = await broker.inference.processResponse(providerAddress, chatID);
    return { result: data, verified: isValid, chatID };
  }

  return { result: data, verified: false };
}
```

**0G Compute Pricing (Testnet):**

| Model | Input Cost | Output Cost |
|-------|-----------|-------------|
| qwen-2.5-7b-instruct | 0.05 0G / 1M tokens | 0.10 0G / 1M tokens |
| qwen-image-edit-2511 | -- | 0.005 0G / image |

**0G Compute Pricing (Mainnet):**

| Model | Input Cost | Output Cost |
|-------|-----------|-------------|
| deepseek-chat-v3-0324 | 0.30 0G / 1M tokens | 1.00 0G / 1M tokens |
| whisper-large-v3 | 0.05 0G / 1M tokens | 0.11 0G / 1M tokens |
| gpt-oss-120b | 0.10 0G / 1M tokens | 0.49 0G / 1M tokens |

**Fund Management:**
- Minimum 3 0G initial deposit to create ledger
- Minimum 1 0G per provider sub-account
- Fees settled in batches, not per-request
- Rate limit: 30 requests/minute, 5 concurrent max

**Demo narrative:** "Every spending recommendation the agent makes is verifiable. When the agent says 'this is the cheapest gas station,' that recommendation was computed inside a hardware enclave and cryptographically signed. You don't have to trust us — you can verify the AI's reasoning on-chain."

---

### 3. iNFT (ERC-7857) — Give the Agent a Tokenized Identity

**What it is:** ERC-7857 extends ERC-721 to support encrypted, transferable AI agent data. Unlike a regular NFT that points to a JPEG, an iNFT contains the actual agent — its personality, memory, configuration, and behavioral traits — encrypted so only the owner can access them.

**Why this is meaningful, not bolted on:**

Our road trip agent isn't a generic chatbot. It has a specific persona (the CLAUDE.md prompt), trip-specific knowledge (preferences, history), and accumulated experience (what worked on past trips). This is valuable, transferable intelligence.

**iNFT gives the agent three properties it doesn't otherwise have:**

**1. Ownable Identity**
The trip organizer mints the agent as an iNFT on 0G Chain. The iNFT contains:
- Agent persona/system prompt (encrypted)
- Trip configuration (budget rules, member preferences)
- Accumulated trip memory (from 0G Storage references)
- Reputation data (past trip performance ratings)

The trip organizer *owns* this agent. They can reuse it for future trips, customize it, or transfer it to someone else.

**2. Composable Reputation**
After each trip, members rate the agent. These ratings are stored on-chain, tied to the iNFT. Over time, the agent builds a reputation:
- "This agent planned 12 trips, average rating 4.8/5"
- "Specializes in European road trips, knows French rest stops well"
- "Saved an average of 15% on gas by routing to cheaper stations"

Future trip organizers can choose agents based on their track record — creating an agent marketplace.

**3. Transferable Intelligence**
When an iNFT transfers, the encrypted metadata re-encrypts for the new owner via TEE oracle. The new owner gets a fully functional agent with all its accumulated knowledge, not just a token pointing to an API.

**Implementation — iNFT Minting Flow:**

The reference implementation uses the `0g-agent-nft` repository:

```bash
# Clone the 0G Agent NFT framework
git clone https://github.com/0glabs/0g-agent-nft.git
cd 0g-agent-nft
pnpm install

# Deploy contracts on 0G Galileo testnet
pnpm hardhat deploy --network zgTestnet
# Outputs: TEEVerifier, AgentNFTImpl, AgentNFTBeacon, AgentNFT addresses
```

**Agent Metadata (character.json):**

```json
{
  "name": "RoadTrip Co-Pilot",
  "modelProvider": "anthropic",
  "bio": [
    "AI road trip agent that manages group treasuries and finds the best stops",
    "Voice-first, built for in-car use with hands-free interaction"
  ],
  "lore": [
    "Created for ETHGlobal Cannes 2026",
    "Specializes in European road trips with multi-currency support"
  ],
  "knowledge": [
    "Group treasury management on Arc blockchain",
    "USDC payments and cross-chain deposits",
    "Restaurant, gas station, and lodging recommendations",
    "Budget optimization and spending category tracking"
  ],
  "style": {
    "all": ["concise", "helpful", "budget-conscious"],
    "chat": ["casual but informative", "proactive about savings opportunities"]
  },
  "topics": ["road trips", "group travel", "crypto payments", "AI agent", "voice assistant"],
  "adjectives": ["trustworthy", "efficient", "budget-savvy"]
}
```

**Agent Description (character_description.json):**

```json
{
  "type": "Road Trip Agent",
  "metadata": "Voice-first AI agent for group road trips. Manages shared USDC treasury, finds stops, recommends options, and pays autonomously. Built on Claude with MCP tools for maps, blockchain, and decentralized storage."
}
```

**Minting Process:**
1. Agent metadata is encrypted with the organizer's public key
2. Encrypted metadata is uploaded to 0G Storage (returns root hash)
3. iNFT is minted on 0G Chain, linking the token to the storage root hash
4. The AgentNFT contract records the TEE verifier for secure transfers

**Verification:**
- Storage: `https://storagescan-galileo.0g.ai/` — confirm agent data upload
- Chain: `https://chainscan-galileo.0g.ai/` — confirm iNFT mint transaction

**Demo narrative:** "This agent isn't just software — it's an on-chain asset. We minted it as an iNFT on 0G Chain. The agent's personality, its trip knowledge, and its performance history are all encrypted inside this token. After this trip, you own an agent that *knows* the French Riviera. Next summer, you can reuse it — or sell it to someone planning the same route."

---

### 4. 0G Chain — On-Chain Agent Actions and Reputation

**What it is:** EVM-compatible L1 (Chain ID: 16602 testnet). Up to 2,500 TPS, sub-second finality, Cancun-Deneb EVM support.

**How we use it:**

Our primary smart contracts (GroupTreasury) live on Arc because USDC is Arc's native gas token and the treasury manages USDC. But we deploy **agent-specific contracts on 0G Chain:**

**a) Agent Reputation Contract**
```solidity
// AgentReputation.sol -- deployed on 0G Chain
contract AgentReputation {
    struct TripRating {
        uint256 tripId;
        address rater;
        uint8 rating;       // 1-5
        string comment;
        uint256 timestamp;
    }

    // iNFT token ID -> ratings
    mapping(uint256 => TripRating[]) public ratings;
    // iNFT token ID -> aggregate score (scaled by 100)
    mapping(uint256 => uint256) public averageScore;
    mapping(uint256 => uint256) public totalTrips;

    function rateAgent(uint256 agentTokenId, uint8 rating, string calldata comment) external {
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        ratings[agentTokenId].push(TripRating({
            tripId: currentTripId,
            rater: msg.sender,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp
        }));
        _updateAverage(agentTokenId, rating);
    }
}
```

**b) Trip Registry Contract**
```solidity
// TripRegistry.sol -- deployed on 0G Chain
contract TripRegistry {
    struct Trip {
        uint256 tripId;
        uint256 agentTokenId;    // iNFT of the agent used
        address organizer;
        string storageStreamId;  // 0G Storage KV stream for trip data
        bytes32 itineraryHash;   // Root hash of itinerary on 0G Storage
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    mapping(uint256 => Trip) public trips;

    event TripCreated(uint256 indexed tripId, uint256 indexed agentTokenId, string storageStreamId);
    event TripEnded(uint256 indexed tripId, bytes32 finalReportHash);
}
```

**Why on 0G Chain (not Arc):**
- Agent identity (iNFT) lives on 0G Chain
- Agent reputation is 0G-native
- Trip registry references 0G Storage streams
- This is the "agent layer" — separate from the "finance layer" (Arc)
- Shows judges we're not just using 0G for one thing

---

### 5. 0G DA (Data Availability) — Trip Data Guarantees

**What it is:** Data availability layer ensuring data can always be accessed when needed.

**Lightweight but genuine integration:**

When the agent writes trip state to 0G Storage, the DA layer guarantees that data is available for retrieval even if specific storage nodes go offline. For a hackathon demo, this is more of an infrastructure guarantee than something we explicitly call — but we can reference it:

"Trip data persisted to 0G Storage with data availability guarantees via 0G DA. Even if nodes go down during the demo, the trip state remains accessible."

**DA Contract on Testnet:**
- DAEntrance: `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B`

---

## Architecture: How 0G Layers Together with Arc and WalletConnect

```
+------------------------------------------------------------------+
|                        USER LAYER                                 |
|  Web App (Next.js + Reown AppKit)                                |
|  -- Trip Dashboard (spending, budgets, receipts)                 |
|  -- Agent Reputation View (ratings from 0G Chain)                |
|  -- Trip Memory Browser (files from 0G Storage)                  |
|  -- Voice UI (browser mic -> orchestrator)                       |
+-----------------------+------------------------------------------+
                        |
            +-----------v-----------+
            |     ORCHESTRATOR      |
            |  FastAPI + SIWE Auth  |
            +-----------+-----------+
                        |
            +-----------v-----------+
            |   CLAUDE CODE AGENT   |  <-- "Alternative Claw Agent"
            |   (tmux session)      |
            |                       |
            |  MCP Servers:         |
            |  -- google-maps          -> Places, directions, POIs
            |  -- evm-mcp-server       -> Read blockchain state
            |  -- trip-treasury --------> GroupTreasury.sol on ARC
            |  -- trip-memory ----------> 0G Storage (KV + files)
            |  -- 0g-compute -----------> 0G Sealed Inference (TEE)
            |  -- voice-channel        -> TTS/STT pipeline
            +-----------+-----------+
                        |
    +-------------------+---------------------------+
    |                   |                           |
    v                   v                           v
+----------+   +---------------+   +---------------------------+
| ARC      |   | 0G CHAIN      |   | 0G INFRASTRUCTURE         |
| CHAIN    |   | (Galileo)     |   |                           |
|          |   |               |   | Storage:                  |
| Treasury |   | iNFT Agent    |   | -- KV Store (trip state)  |
| Contract |   | (ERC-7857)    |   | -- Files (photos,         |
| (USDC    |   |               |   |    transcripts, reports)  |
|  escrow) |   | Reputation    |   |                           |
|          |   | Contract      |   | Compute:                  |
| Agent    |   |               |   | -- Sealed Inference       |
| Spending |   | Trip Registry |   |    (TEE-verified)         |
| Receipts |   | Contract      |   | -- Spending evaluation    |
|          |   |               |   |    & privacy analysis     |
| CCTP     |   | Agent Actions |   |                           |
| Cross-   |   | Log           |   | DA:                       |
| chain    |   |               |   | -- Availability           |
| deposits |   |               |   |    guarantees             |
+----------+   +---------------+   +---------------------------+

Financial Layer     Agent Identity      Agent Infrastructure
(USDC native)       & Reputation         (Memory + Reasoning)
```

**The dual-chain architecture is a strength, not a weakness:**
- **Arc** = financial settlement layer (USDC treasury, payments, cross-chain deposits)
- **0G** = agent intelligence layer (identity, memory, verifiable reasoning, reputation)

This separation mirrors the real world: your bank (Arc) handles your money, but your brain (0G) handles your decisions. They're complementary, not competing.

---

## 0G Testnet Reference

| Parameter | Value |
|-----------|-------|
| Network Name | 0G-Galileo-Testnet |
| Chain ID | `16602` |
| Native Currency | 0G |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Chain Explorer | `https://chainscan-galileo.0g.ai` |
| Storage Explorer | `https://storagescan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` (0.1 0G/day) |
| EVM Version | Cancun |
| Storage Indexer (Turbo) | `https://indexer-storage-testnet-turbo.0g.ai` |
| Storage Indexer (Standard) | `https://indexer-storage-testnet-standard.0g.ai` |
| Storage Flow Contract | `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` |
| DA Entrance | `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B` |

**Compute Network Providers (Testnet):**

| Model | Provider Address |
|-------|-----------------|
| llama-3.3-70b-instruct (TEE) | `0xf07240Efa67755B5311bc75784a061eDB47165Dd` |
| deepseek-r1-70b (TEE) | `0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3` |
| qwen2.5-vl-72b-instruct (TEE) | `0x6D233D2610c32f630ED53E8a7Cbf759568041f8f` |

**Hardhat Configuration:**
```javascript
networks: {
  "0g-testnet": {
    url: "https://evmrpc-testnet.0g.ai",
    chainId: 16602,
    accounts: [process.env.PRIVATE_KEY]
  }
},
solidity: {
  version: "0.8.19",
  settings: {
    evmVersion: "cancun",
    optimizer: { enabled: true, runs: 200 }
  }
},
etherscan: {
  apiKey: { "0g-testnet": "PLACEHOLDER" },
  customChains: [{
    network: "0g-testnet",
    chainId: 16602,
    urls: {
      apiURL: "https://chainscan-galileo.0g.ai/open/api",
      browserURL: "https://chainscan-galileo.0g.ai"
    }
  }]
}
```

---

## NPM Packages Required

```bash
# 0G Storage SDK
npm install @0gfoundation/0g-ts-sdk ethers

# 0G Compute SDK (Inference)
npm install @0glabs/0g-serving-broker

# 0G Compute CLI (optional, for testing)
pnpm add @0glabs/0g-serving-broker -g
```

---

## What Judges Actually Want — Analysis from Past Events

### From the 0G APAC Hackathon (Official Judging Criteria)

1. **Technical Excellence** — Code quality, architecture, and integration depth
2. **Creative Ideas** — Novel use of 0G infrastructure, not just "hello world" storage
3. **Good Design** — Both UX and system design
4. **Impact/Value** — Real-world applicability
5. **Long-term Sustainability** — Could this be a real product?

**Critical rule:** "Projects without actual 0G integration will be considered invalid. At least one 0G component must be used." We use FOUR (Chain, Storage, Compute, iNFTs).

### From the ETHGlobal Cannes July 2025 Sponsorship

0G CEO Michael Heinrich's signal: they want developers demonstrating "creative and impactful use cases leveraging 0G's unique capabilities — storage throughput, DA layer, decentralized AI compute, and EVM-compatible chain."

**Pattern from past winners:**
- Integration of MULTIPLE 0G components (not just one)
- Real functional demo on testnet (not just slides)
- Clear explanation of WHY 0G is the right infrastructure
- Strong documentation (README, architecture diagram)

### The Agentic Infrastructure Track (0G APAC)

The OpenClaw/Agent track specifically looks for:
- "Building agent frameworks, specialized Skills, and data-processing pipelines"
- "Integration of 0G Compute for model fine-tuning or inference"
- "Projects demonstrating use of 0G Storage for state persistence and long-context memory"

**We hit all three:**
- Claude Code + MCP servers = agent framework with specialized tools
- 0G Compute for verified spending inference
- 0G Storage for persistent trip memory

---

## Track-by-Track Submission Strategy

### Track 1: Best OpenClaw Agent on 0G ($6K) — PRIMARY TARGET

**What to highlight:**
- Claude Code as "alternative Claw agent" — superior reasoning for financial decisions
- 0G Storage KV as persistent trip memory (preferences, itinerary, spending, conversation)
- 0G Compute sealed inference for verifiable spending recommendations
- iNFT (ERC-7857) agent identity with reputation tracking
- Trip Registry contract on 0G Chain linking agent, trip, and storage
- MCP server architecture — clean, composable tool system
- Voice-first interface — the agent talks, listens, and acts autonomously

**The pitch:** "We gave a car a wallet AND a brain. The wallet lives on Arc (USDC treasury). The brain lives on 0G (persistent memory, verifiable reasoning, tokenized identity). Claude is the agent framework — it reasons about budgets, navigates routes, and makes spending decisions. Every recommendation is TEE-verified via 0G Compute. Every piece of trip data persists on 0G Storage. The agent itself is an iNFT — ownable, reputable, tradeable."

**Deliverables:** iNFT minted on 0G Chain, contracts deployed (AgentReputation, TripRegistry), trip data on 0G Storage, verified inference via 0G Compute, GitHub repo, demo video.

### Track 3: Wildcard on 0G ($3K) — SECONDARY TARGET

**What to highlight (different emphasis from Track 1):**
- Focus on the novel cross-chain architecture: financial layer (Arc) + intelligence layer (0G)
- The group coordination + AI autonomy + crypto payments intersection is unique
- Voice-first is an unusual interface for blockchain apps
- Trip memory persistence across devices and sessions

**The pitch:** "RoadTrip Co-Pilot doesn't fit in a box. It's not just an agent, not just DeFi, not just storage. It's a voice-first AI that coordinates group finances across two blockchains. 0G provides the intelligence infrastructure — Storage for memory, Compute for verified reasoning, Chain for agent identity. This is what a real-world agentic economy looks like."

---

## What Makes This Integration Deep, Not Surface-Level

1. **0G Storage isn't just "we uploaded a file."** It's the agent's entire persistent brain — structured KV data for trip state, file storage for artifacts, cross-device sync for multi-member access. Without it, the agent is amnesiac.

2. **0G Compute isn't "we made one API call."** It's the trust layer for financial decisions. Every spending recommendation can be cryptographically verified. This solves the fundamental trust problem of an AI spending other people's money.

3. **iNFTs aren't decorative.** The agent is a genuine on-chain asset with encrypted intelligence, transferable ownership, and accumulating reputation. This transforms a hackathon demo into a product concept — agent marketplaces for travel planning.

4. **0G Chain contracts aren't redundant with Arc.** Arc handles finance (USDC), 0G handles agent identity and reputation. Different chains for different concerns — separation of responsibility.

5. **The alternative Claw agent framing is honest.** We didn't bolt on OpenClaw as a wrapper. We used Claude Code because it's genuinely better for reasoning-heavy, tool-rich, voice-first agent work. The bounty explicitly allows this.

6. **The integration is load-bearing.** Remove 0G and the app is worse: no persistent memory, no verified inference, no agent identity, no reputation system. This isn't a checkbox — it's infrastructure.

---

## Implementation Priority (48-hour Hackathon)

### Must-Have (Core Demo) — Hours 0-24

1. **0G Storage KV — trip memory MCP server** — Store/load trip preferences, itinerary, spending state
2. **0G Storage files — trip artifacts** — Upload conversation transcripts and trip reports
3. **iNFT mint — agent identity** — Deploy AgentNFT contract, mint our agent as an iNFT
4. **0G Chain contracts** — AgentReputation + TripRegistry deployed on Galileo testnet

### Should-Have (Strengthens Bounty Case) — Hours 24-36

5. **0G Compute — verified inference** — Route spending evaluations through sealed inference
6. **0G Compute — verification flow** — Store signed inference receipts to 0G Storage
7. **Agent reputation UI** — Display agent ratings and trip count on dashboard

### Nice-to-Have (Wow Factor) — Hours 36-48

8. **Cross-session memory demo** — Kill the agent session, restart, show it loading state from 0G
9. **Multi-device sync demo** — Show trip state updating on two different browsers
10. **Agent marketplace concept** — UI showing browseable agents with reputation scores

---

## Key Documentation and Resources

| Resource | URL |
|----------|-----|
| 0G Documentation | https://docs.0g.ai/ |
| 0G Builder Hub | https://build.0g.ai/ |
| 0G Hacker Guide | https://build.0g.ai/hacker-guide/ |
| Storage SDK Docs | https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk |
| Compute/Inference Docs | https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference |
| Inference SDK Docs | https://docs.0g.ai/developer-hub/building-on-0g/compute-network/sdk |
| iNFT Overview | https://docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview |
| iNFT Concept | https://docs.0g.ai/concepts/inft |
| Deploy Contracts | https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts |
| Testnet Overview | https://docs.0g.ai/developer-hub/testnet/testnet-overview |
| ERC-7857 Blog Post | https://0g.ai/blog/0g-introducing-erc-7857 |
| Storage TS Starter Kit | https://github.com/0gfoundation/0g-storage-ts-starter-kit |
| Compute TS Starter Kit | https://github.com/0gfoundation/0g-compute-ts-starter-kit |
| Agent NFT Repo | https://github.com/0glabs/0g-agent-nft |
| 0G TS SDK | https://github.com/0gfoundation/0g-ts-sdk |
| Chain Explorer | https://chainscan-galileo.0g.ai |
| Storage Explorer | https://storagescan-galileo.0g.ai |
| Faucet | https://faucet.0g.ai |
| Discord Support | https://discord.gg/0glabs |
| OpenClaw (for reference) | https://github.com/openclaw/openclaw |
| iNFT Deployment Guide (Medium) | See references section |
| Sealed Inference Announcement | See references section |
