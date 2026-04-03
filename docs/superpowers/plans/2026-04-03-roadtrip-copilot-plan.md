# RoadTrip Co-Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a voice-first AI road trip agent with group USDC treasury, WalletConnect auth, and autonomous spending — for ETHGlobal Cannes 2026.

**Architecture:** 5 independent workstreams that can be built and tested in parallel, then integrated. Each produces a working, testable component. The orchestrator ties them together. Reuses the existing claude-superapp voice pipeline (Voice VM for STT/TTS, voice-channel MCP for Claude Code bridging).

**Tech Stack:** Solidity + Foundry (contracts), TypeScript + Bun (MCP servers), Python + FastAPI (orchestrator), Next.js + Reown AppKit (frontend), Claude Code + MCP (agent)

---

## File Structure

```
ethglobal/
├── contracts/                        # WS1: Smart Contracts
│   ├── src/GroupTreasury.sol         # Main treasury contract
│   ├── test/GroupTreasury.t.sol      # Foundry tests
│   ├── script/Deploy.s.sol          # Deployment script
│   ├── foundry.toml
│   └── README.md
├── mcp-servers/                      # WS2: Custom MCP Servers
│   ├── treasury/
│   │   ├── index.ts                  # Treasury MCP server
│   │   ├── abi.ts                    # Contract ABI export
│   │   ├── index.test.ts            # Unit tests
│   │   └── package.json
│   └── trip-memory/
│       ├── index.ts                  # 0G Storage MCP server
│       ├── index.test.ts
│       └── package.json
├── orchestrator/                     # WS3: Backend API
│   ├── main.py                       # FastAPI app — voice pipeline + trip endpoints
│   ├── auth.py                       # SIWE wallet auth
│   ├── trips.py                      # Trip CRUD + management
│   ├── db.py                         # SQLite (adapted from claude-superapp)
│   ├── requirements.txt
│   ├── tests/
│   │   ├── test_auth.py
│   │   └── test_trips.py
│   └── README.md
├── web/                              # WS4: Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Landing / connect wallet
│   │   │   └── trip/
│   │   │       └── [id]/
│   │   │           └── page.tsx      # Trip dashboard
│   │   ├── components/
│   │   │   ├── ConnectButton.tsx
│   │   │   ├── CreateTrip.tsx
│   │   │   ├── TreasuryDashboard.tsx
│   │   │   ├── VoiceInterface.tsx
│   │   │   └── SpendingFeed.tsx
│   │   ├── lib/
│   │   │   ├── wagmi.ts              # Wagmi + WalletConnect config
│   │   │   ├── treasury.ts           # Contract interaction hooks
│   │   │   └── api.ts                # Orchestrator API client
│   │   └── abi/
│   │       └── GroupTreasury.json    # ABI (copied from contracts build)
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── README.md
├── agent/                            # WS5: Agent Config
│   ├── CLAUDE.md                     # Road trip co-pilot persona
│   ├── .mcp.json                     # MCP server configuration
│   └── README.md
└── README.md                         # Root project README
```

---

## Workstream 1: Smart Contracts (GroupTreasury.sol)

**Independent:** Yes — no dependencies on other workstreams.
**Output:** Deployed contract on Arc testnet (or local Anvil for dev), ABI JSON file.

### Task 1.1: Scaffold Foundry Project

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/src/GroupTreasury.sol` (skeleton)
- Create: `contracts/README.md`

- [ ] **Step 1: Initialize Foundry project**

```bash
cd /Users/snojj25/Desktop/505/hackhatons/cannes/ethglobal
mkdir -p contracts/src contracts/test contracts/script
```

- [ ] **Step 2: Create foundry.toml**

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"

[rpc_endpoints]
arc_testnet = "${ARC_TESTNET_RPC_URL}"
local = "http://127.0.0.1:8545"
```

- [ ] **Step 3: Install OpenZeppelin**

```bash
cd contracts && forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

- [ ] **Step 4: Create README**

```markdown
# GroupTreasury Smart Contract

Shared USDC treasury for group road trips. Members deposit USDC, an authorized agent spends from the pool within configurable limits, and settlement returns leftovers proportionally.

## Build & Test
\`\`\`bash
forge build
forge test -vvv
\`\`\`

## Deploy (local)
\`\`\`bash
anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
\`\`\`
```

- [ ] **Step 5: Commit**

```bash
git add contracts/ && git commit -m "feat(contracts): scaffold Foundry project"
```

### Task 1.2: Write GroupTreasury Contract

**Files:**
- Create: `contracts/src/GroupTreasury.sol`

- [ ] **Step 1: Write the contract**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract GroupTreasury {
    using SafeERC20 for IERC20;

    // --- Types ---
    enum TripStatus { Active, Settled }

    struct Trip {
        address organizer;
        address agent;           // Authorized AI agent wallet
        address usdc;            // USDC token address
        uint256 spendLimit;      // Per-tx auto-spend limit (in USDC base units)
        uint256 totalDeposited;
        uint256 totalSpent;
        TripStatus status;
        uint256 memberCount;
    }

    struct Spend {
        address recipient;
        uint256 amount;
        string category;         // "food", "gas", "lodging", "activities"
        string description;
        uint256 timestamp;
    }

    // --- State ---
    uint256 public nextTripId;
    mapping(uint256 => Trip) public trips;
    mapping(uint256 => mapping(address => uint256)) public deposits;   // tripId => member => amount
    mapping(uint256 => address[]) public members;                      // tripId => member list
    mapping(uint256 => Spend[]) public spends;                         // tripId => spend history
    mapping(uint256 => mapping(address => bool)) public isMember;

    // --- Events ---
    event TripCreated(uint256 indexed tripId, address indexed organizer, address agent, address usdc);
    event MemberJoined(uint256 indexed tripId, address indexed member, uint256 amount);
    event FundsSpent(uint256 indexed tripId, address indexed recipient, uint256 amount, string category, string description);
    event TripSettled(uint256 indexed tripId, uint256 totalSpent, uint256 totalReturned);
    event EmergencyWithdraw(uint256 indexed tripId, address indexed member, uint256 amount);

    // --- Create Trip ---
    function createTrip(
        address _usdc,
        address _agent,
        uint256 _spendLimit
    ) external returns (uint256 tripId) {
        tripId = nextTripId++;
        trips[tripId] = Trip({
            organizer: msg.sender,
            agent: _agent,
            usdc: _usdc,
            spendLimit: _spendLimit,
            totalDeposited: 0,
            totalSpent: 0,
            status: TripStatus.Active,
            memberCount: 0
        });
        emit TripCreated(tripId, msg.sender, _agent, _usdc);
    }

    // --- Join & Deposit ---
    function deposit(uint256 _tripId, uint256 _amount) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(_amount > 0, "Zero amount");

        IERC20(trip.usdc).safeTransferFrom(msg.sender, address(this), _amount);

        if (!isMember[_tripId][msg.sender]) {
            isMember[_tripId][msg.sender] = true;
            members[_tripId].push(msg.sender);
            trip.memberCount++;
        }
        deposits[_tripId][msg.sender] += _amount;
        trip.totalDeposited += _amount;

        emit MemberJoined(_tripId, msg.sender, _amount);
    }

    // --- Agent Spend ---
    function spend(
        uint256 _tripId,
        address _recipient,
        uint256 _amount,
        string calldata _category,
        string calldata _description
    ) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.agent, "Not authorized agent");
        require(_amount <= trip.spendLimit, "Exceeds spend limit");
        require(_amount <= trip.totalDeposited - trip.totalSpent, "Insufficient funds");

        trip.totalSpent += _amount;
        spends[_tripId].push(Spend({
            recipient: _recipient,
            amount: _amount,
            category: _category,
            description: _description,
            timestamp: block.timestamp
        }));

        IERC20(trip.usdc).safeTransfer(_recipient, _amount);

        emit FundsSpent(_tripId, _recipient, _amount, _category, _description);
    }

    // --- Settle Trip ---
    function settle(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(msg.sender == trip.organizer || isMember[_tripId][msg.sender], "Not a member");

        trip.status = TripStatus.Settled;

        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        if (remaining > 0) {
            // Return proportionally to depositors
            for (uint256 i = 0; i < members[_tripId].length; i++) {
                address member = members[_tripId][i];
                uint256 share = (remaining * deposits[_tripId][member]) / trip.totalDeposited;
                if (share > 0) {
                    IERC20(trip.usdc).safeTransfer(member, share);
                }
            }
        }

        emit TripSettled(_tripId, trip.totalSpent, remaining);
    }

    // --- Emergency Withdraw ---
    function emergencyWithdraw(uint256 _tripId) external {
        Trip storage trip = trips[_tripId];
        require(trip.status == TripStatus.Active, "Trip not active");
        require(isMember[_tripId][msg.sender], "Not a member");

        uint256 remaining = trip.totalDeposited - trip.totalSpent;
        uint256 share = (remaining * deposits[_tripId][msg.sender]) / trip.totalDeposited;
        require(share > 0, "Nothing to withdraw");

        // Reduce deposit record so proportions remain correct
        uint256 originalDeposit = deposits[_tripId][msg.sender];
        deposits[_tripId][msg.sender] = 0;
        trip.totalDeposited -= originalDeposit;

        IERC20(trip.usdc).safeTransfer(msg.sender, share);

        emit EmergencyWithdraw(_tripId, msg.sender, share);
    }

    // --- View Helpers ---
    function getTrip(uint256 _tripId) external view returns (Trip memory) {
        return trips[_tripId];
    }

    function getMembers(uint256 _tripId) external view returns (address[] memory) {
        return members[_tripId];
    }

    function getSpends(uint256 _tripId) external view returns (Spend[] memory) {
        return spends[_tripId];
    }

    function getBalance(uint256 _tripId) external view returns (uint256) {
        Trip storage trip = trips[_tripId];
        return trip.totalDeposited - trip.totalSpent;
    }

    function getMemberDeposit(uint256 _tripId, address _member) external view returns (uint256) {
        return deposits[_tripId][_member];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add contracts/src/ && git commit -m "feat(contracts): add GroupTreasury contract"
```

### Task 1.3: Write Contract Tests

**Files:**
- Create: `contracts/test/GroupTreasury.t.sol`

- [ ] **Step 1: Write comprehensive Foundry tests**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract GroupTreasuryTest is Test {
    GroupTreasury treasury;
    MockUSDC usdc;

    address organizer = makeAddr("organizer");
    address agent = makeAddr("agent");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address restaurant = makeAddr("restaurant");

    uint256 constant SPEND_LIMIT = 100e6;  // $100 USDC
    uint256 constant DEPOSIT_AMOUNT = 200e6; // $200 USDC each

    function setUp() public {
        treasury = new GroupTreasury();
        usdc = new MockUSDC();

        // Mint USDC to members
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
    }

    function _createTrip() internal returns (uint256) {
        vm.prank(organizer);
        return treasury.createTrip(address(usdc), agent, SPEND_LIMIT);
    }

    function _depositAs(address member, uint256 tripId, uint256 amount) internal {
        vm.startPrank(member);
        usdc.approve(address(treasury), amount);
        treasury.deposit(tripId, amount);
        vm.stopPrank();
    }

    // --- Creation Tests ---

    function test_createTrip() public {
        uint256 tripId = _createTrip();
        GroupTreasury.Trip memory trip = treasury.getTrip(tripId);

        assertEq(trip.organizer, organizer);
        assertEq(trip.agent, agent);
        assertEq(trip.usdc, address(usdc));
        assertEq(trip.spendLimit, SPEND_LIMIT);
        assertEq(uint(trip.status), uint(GroupTreasury.TripStatus.Active));
    }

    function test_createTrip_incrementsId() public {
        uint256 id1 = _createTrip();
        uint256 id2 = _createTrip();
        assertEq(id2, id1 + 1);
    }

    // --- Deposit Tests ---

    function test_deposit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        assertEq(treasury.getMemberDeposit(tripId, alice), DEPOSIT_AMOUNT);
        assertEq(treasury.getBalance(tripId), DEPOSIT_AMOUNT);
        assertEq(usdc.balanceOf(address(treasury)), DEPOSIT_AMOUNT);
    }

    function test_deposit_multipleMembers() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);
        _depositAs(bob, tripId, DEPOSIT_AMOUNT);
        _depositAs(carol, tripId, DEPOSIT_AMOUNT);

        assertEq(treasury.getBalance(tripId), 600e6);
        assertEq(treasury.getMembers(tripId).length, 3);
    }

    function test_deposit_additionalDeposit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 100e6);
        _depositAs(alice, tripId, 100e6);

        assertEq(treasury.getMemberDeposit(tripId, alice), 200e6);
        // Member count should still be 1
        assertEq(treasury.getMembers(tripId).length, 1);
    }

    function test_deposit_revertZero() public {
        uint256 tripId = _createTrip();
        vm.startPrank(alice);
        usdc.approve(address(treasury), 0);
        vm.expectRevert("Zero amount");
        treasury.deposit(tripId, 0);
        vm.stopPrank();
    }

    // --- Spend Tests ---

    function test_spend() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(agent);
        treasury.spend(tripId, restaurant, 38_500000, "food", "3x pulled pork combos");

        assertEq(usdc.balanceOf(restaurant), 38_500000);
        assertEq(treasury.getBalance(tripId), DEPOSIT_AMOUNT - 38_500000);

        GroupTreasury.Spend[] memory history = treasury.getSpends(tripId);
        assertEq(history.length, 1);
        assertEq(history[0].amount, 38_500000);
        assertEq(history[0].category, "food");
    }

    function test_spend_revertNotAgent() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert("Not authorized agent");
        treasury.spend(tripId, restaurant, 50e6, "food", "dinner");
    }

    function test_spend_revertExceedsLimit() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(agent);
        vm.expectRevert("Exceeds spend limit");
        treasury.spend(tripId, restaurant, 150e6, "lodging", "hotel");
    }

    function test_spend_revertInsufficientFunds() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 50e6);

        vm.prank(agent);
        vm.expectRevert("Insufficient funds");
        treasury.spend(tripId, restaurant, 80e6, "food", "dinner");
    }

    // --- Settlement Tests ---

    function test_settle_returnsProportionally() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);  // 1/3
        _depositAs(bob, tripId, 200e6);    // 1/3
        _depositAs(carol, tripId, 200e6);  // 1/3

        // Spend $300 of $600
        vm.startPrank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");
        treasury.spend(tripId, restaurant, 100e6, "gas", "fuel");
        treasury.spend(tripId, restaurant, 100e6, "food", "dinner");
        vm.stopPrank();

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        treasury.settle(tripId);

        // Each should get $100 back (1/3 of $300 remaining)
        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);
        assertEq(usdc.balanceOf(bob), 900e6); // 1000 - 200 deposit + 100 return
        assertEq(usdc.balanceOf(carol), 900e6);
    }

    function test_settle_revertAlreadySettled() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        treasury.settle(tripId);

        vm.prank(alice);
        vm.expectRevert("Trip not active");
        treasury.settle(tripId);
    }

    function test_spend_revertAfterSettle() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, DEPOSIT_AMOUNT);

        vm.prank(alice);
        treasury.settle(tripId);

        vm.prank(agent);
        vm.expectRevert("Trip not active");
        treasury.spend(tripId, restaurant, 50e6, "food", "late snack");
    }

    // --- Emergency Withdraw Tests ---

    function test_emergencyWithdraw() public {
        uint256 tripId = _createTrip();
        _depositAs(alice, tripId, 200e6);
        _depositAs(bob, tripId, 400e6);

        // Spend $150
        vm.prank(agent);
        treasury.spend(tripId, restaurant, 100e6, "food", "lunch");

        // Alice emergency withdraws her proportional share
        // Remaining: 600 - 100(spent) = 500. Alice's share: 500 * 200/600 = 166.666...
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        treasury.emergencyWithdraw(tripId);

        uint256 aliceGot = usdc.balanceOf(alice) - aliceBefore;
        assertApproxEqAbs(aliceGot, 166_666666, 1); // allow 1 wei rounding
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd contracts && forge test -vvv
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add contracts/test/ && git commit -m "test(contracts): comprehensive GroupTreasury tests"
```

### Task 1.4: Deployment Script + ABI Export

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write deployment script**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {GroupTreasury} from "../src/GroupTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        vm.startBroadcast();
        GroupTreasury treasury = new GroupTreasury();
        vm.stopBroadcast();
        console.log("GroupTreasury deployed at:", address(treasury));
    }
}
```

- [ ] **Step 2: Build and export ABI**

```bash
cd contracts && forge build
# ABI is at contracts/out/GroupTreasury.sol/GroupTreasury.json
# Copy to web app
mkdir -p ../web/src/abi
cp out/GroupTreasury.sol/GroupTreasury.json ../web/src/abi/
```

- [ ] **Step 3: Test local deployment**

```bash
# Start local node
anvil &
# Deploy
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Kill anvil
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add contracts/script/ && git commit -m "feat(contracts): add deployment script"
```

---

## Workstream 2: Custom MCP Servers

**Independent:** Mostly — needs the contract ABI from WS1 for the treasury MCP, but can use the ABI committed above.
**Output:** Two working MCP servers that can be loaded into Claude Code.

### Task 2.1: Treasury MCP Server

**Files:**
- Create: `mcp-servers/treasury/package.json`
- Create: `mcp-servers/treasury/index.ts`
- Create: `mcp-servers/treasury/abi.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "trip-treasury-mcp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "bun index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 2: Create abi.ts with the contract ABI**

Extract the ABI array from the Foundry build output (`contracts/out/GroupTreasury.sol/GroupTreasury.json`). Export it as a TypeScript constant. This file is generated — just copy the `abi` field from the JSON.

```typescript
// Auto-generated from contracts/out/GroupTreasury.sol/GroupTreasury.json
// Re-export just the ABI array for viem
export const GROUP_TREASURY_ABI = [/* paste ABI from forge build output */] as const;
```

- [ ] **Step 3: Create the MCP server**

```typescript
#!/usr/bin/env bun
/**
 * Trip Treasury MCP Server
 *
 * Exposes tools for the Claude Code agent to interact with the
 * GroupTreasury smart contract: check balances, spend from pool,
 * view history.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { GROUP_TREASURY_ABI } from './abi.js'

// --- Config ---
const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545'
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS as `0x${string}` | undefined
const CHAIN_ID = parseInt(process.env.CHAIN_ID ?? '31337', 10)

// --- Viem Clients ---
const chain = { ...foundry, id: CHAIN_ID }
const transport = http(RPC_URL)
const publicClient = createPublicClient({ chain, transport })

let walletClient: ReturnType<typeof createWalletClient> | null = null
if (AGENT_PRIVATE_KEY) {
  const account = privateKeyToAccount(AGENT_PRIVATE_KEY)
  walletClient = createWalletClient({ account, chain, transport })
}

// --- MCP Server ---
const server = new Server(
  { name: 'trip-treasury', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'treasury_balance',
      description: 'Get the current balance and spending summary for a trip treasury. Returns total deposited, total spent, remaining balance, and per-member deposits.',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
        },
        required: ['trip_id'],
      },
    },
    {
      name: 'treasury_spend',
      description: 'Spend USDC from the group treasury. Only the authorized agent can call this. Amount is in USD (e.g., 38.50 for $38.50).',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
          recipient: { type: 'string', description: 'Recipient wallet address' },
          amount_usd: { type: 'number', description: 'Amount in USD (e.g., 38.50)' },
          category: { type: 'string', enum: ['food', 'gas', 'lodging', 'activities'], description: 'Spending category' },
          description: { type: 'string', description: 'What was purchased' },
        },
        required: ['trip_id', 'recipient', 'amount_usd', 'category', 'description'],
      },
    },
    {
      name: 'treasury_history',
      description: 'Get the spending history for a trip treasury.',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
        },
        required: ['trip_id'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const addr = TREASURY_ADDRESS

  if (!addr) {
    return { content: [{ type: 'text', text: 'Error: TREASURY_ADDRESS not configured' }], isError: true }
  }

  try {
    if (name === 'treasury_balance') {
      const tripId = BigInt(args.trip_id as number)
      const [trip, memberAddrs] = await Promise.all([
        publicClient.readContract({ address: addr, abi: GROUP_TREASURY_ABI, functionName: 'getTrip', args: [tripId] }),
        publicClient.readContract({ address: addr, abi: GROUP_TREASURY_ABI, functionName: 'getMembers', args: [tripId] }),
      ])

      const memberDeposits = await Promise.all(
        (memberAddrs as string[]).map(async (m) => {
          const dep = await publicClient.readContract({
            address: addr, abi: GROUP_TREASURY_ABI, functionName: 'getMemberDeposit', args: [tripId, m as `0x${string}`],
          })
          return { address: m, deposited: formatUnits(dep as bigint, 6) }
        })
      )

      const t = trip as any
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            trip_id: Number(tripId),
            status: Number(t.status) === 0 ? 'active' : 'settled',
            total_deposited_usd: formatUnits(t.totalDeposited, 6),
            total_spent_usd: formatUnits(t.totalSpent, 6),
            remaining_usd: formatUnits(t.totalDeposited - t.totalSpent, 6),
            spend_limit_usd: formatUnits(t.spendLimit, 6),
            member_count: Number(t.memberCount),
            members: memberDeposits,
          }, null, 2),
        }],
      }
    }

    if (name === 'treasury_spend') {
      if (!walletClient) {
        return { content: [{ type: 'text', text: 'Error: AGENT_PRIVATE_KEY not configured — cannot send transactions' }], isError: true }
      }
      const tripId = BigInt(args.trip_id as number)
      const amount = parseUnits(String(args.amount_usd), 6)

      const hash = await walletClient.writeContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: 'spend',
        args: [tripId, args.recipient as `0x${string}`, amount, args.category as string, args.description as string],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            tx_hash: hash,
            block_number: Number(receipt.blockNumber),
            amount_usd: args.amount_usd,
            category: args.category,
            description: args.description,
            recipient: args.recipient,
          }, null, 2),
        }],
      }
    }

    if (name === 'treasury_history') {
      const tripId = BigInt(args.trip_id as number)
      const rawSpends = await publicClient.readContract({
        address: addr, abi: GROUP_TREASURY_ABI, functionName: 'getSpends', args: [tripId],
      }) as any[]

      const history = rawSpends.map((s: any) => ({
        recipient: s.recipient,
        amount_usd: formatUnits(s.amount, 6),
        category: s.category,
        description: s.description,
        timestamp: new Date(Number(s.timestamp) * 1000).toISOString(),
      }))

      return { content: [{ type: 'text', text: JSON.stringify(history, null, 2) }] }
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
  }
})

// --- Start ---
await server.connect(new StdioServerTransport())
```

- [ ] **Step 4: Install deps and verify it starts**

```bash
cd mcp-servers/treasury && bun install
# Quick smoke test — server should start and wait for stdio
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 bun index.ts || true
```

- [ ] **Step 5: Commit**

```bash
git add mcp-servers/treasury/ && git commit -m "feat(mcp): add trip treasury MCP server"
```

### Task 2.2: Trip Memory MCP Server (0G Storage)

**Files:**
- Create: `mcp-servers/trip-memory/package.json`
- Create: `mcp-servers/trip-memory/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "trip-memory-mcp",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "bun index.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 2: Create the MCP server**

For hackathon, use local JSON file storage as the primary backend with 0G Storage as an optional upload. This lets us demo without 0G infra being required, but show the integration.

```typescript
#!/usr/bin/env bun
/**
 * Trip Memory MCP Server
 *
 * Persists trip data (preferences, itinerary, conversation context).
 * Uses local JSON files as primary store with optional 0G Storage upload.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.TRIP_MEMORY_DIR ?? './trip-data'
mkdirSync(DATA_DIR, { recursive: true })

function dataPath(tripId: number, key: string): string {
  const tripDir = join(DATA_DIR, `trip-${tripId}`)
  mkdirSync(tripDir, { recursive: true })
  return join(tripDir, `${key}.json`)
}

const server = new Server(
  { name: 'trip-memory', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'save_trip_data',
      description: 'Save trip data (preferences, itinerary, notes, etc.) to persistent storage.',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
          key: { type: 'string', description: 'Data key (e.g., "preferences", "itinerary", "notes")' },
          data: { type: 'object', description: 'The data to save (any JSON object)' },
        },
        required: ['trip_id', 'key', 'data'],
      },
    },
    {
      name: 'load_trip_data',
      description: 'Load previously saved trip data.',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
          key: { type: 'string', description: 'Data key to load' },
        },
        required: ['trip_id', 'key'],
      },
    },
    {
      name: 'list_trip_keys',
      description: 'List all saved data keys for a trip.',
      inputSchema: {
        type: 'object',
        properties: {
          trip_id: { type: 'number', description: 'The trip ID' },
        },
        required: ['trip_id'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  try {
    if (name === 'save_trip_data') {
      const path = dataPath(args.trip_id as number, args.key as string)
      writeFileSync(path, JSON.stringify(args.data, null, 2))
      return { content: [{ type: 'text', text: `Saved "${args.key}" for trip ${args.trip_id}` }] }
    }

    if (name === 'load_trip_data') {
      const path = dataPath(args.trip_id as number, args.key as string)
      if (!existsSync(path)) {
        return { content: [{ type: 'text', text: `No data found for key "${args.key}" in trip ${args.trip_id}` }] }
      }
      const data = JSON.parse(readFileSync(path, 'utf-8'))
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }

    if (name === 'list_trip_keys') {
      const tripDir = join(DATA_DIR, `trip-${args.trip_id}`)
      if (!existsSync(tripDir)) {
        return { content: [{ type: 'text', text: '[]' }] }
      }
      const { readdirSync } = await import('fs')
      const keys = readdirSync(tripDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      return { content: [{ type: 'text', text: JSON.stringify(keys) }] }
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
  }
})

await server.connect(new StdioServerTransport())
```

- [ ] **Step 3: Install deps and test**

```bash
cd mcp-servers/trip-memory && bun install
```

- [ ] **Step 4: Commit**

```bash
git add mcp-servers/trip-memory/ && git commit -m "feat(mcp): add trip memory MCP server (0G Storage)"
```

### Task 2.3: MCP Server README

**Files:**
- Create: `mcp-servers/README.md`

- [ ] **Step 1: Write README**

```markdown
# MCP Servers

Custom MCP (Model Context Protocol) servers that give the Claude Code road trip agent its capabilities.

## Treasury MCP (`treasury/`)
Interacts with the GroupTreasury smart contract on Arc. Tools: `treasury_balance`, `treasury_spend`, `treasury_history`.

**Env vars:**
- `RPC_URL` — Chain RPC endpoint
- `TREASURY_ADDRESS` — Deployed contract address
- `AGENT_PRIVATE_KEY` — Agent wallet private key (for spending)
- `CHAIN_ID` — Chain ID (default: 31337 for local Anvil)

## Trip Memory MCP (`trip-memory/`)
Persists trip data (preferences, itinerary, notes) to local JSON files with optional 0G Storage upload.

**Env vars:**
- `TRIP_MEMORY_DIR` — Data directory (default: `./trip-data`)

## Usage with Claude Code
Configure in `.mcp.json`:
\`\`\`json
{
  "mcpServers": {
    "treasury": {
      "command": "bun",
      "args": ["mcp-servers/treasury/index.ts"],
      "env": { "RPC_URL": "...", "TREASURY_ADDRESS": "...", "AGENT_PRIVATE_KEY": "..." }
    },
    "trip-memory": {
      "command": "bun",
      "args": ["mcp-servers/trip-memory/index.ts"]
    }
  }
}
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add mcp-servers/README.md && git commit -m "docs(mcp): add MCP servers README"
```

---

## Workstream 3: Orchestrator (Backend API)

**Depends on:** WS1 contract ABI (for trip creation/management). Can develop in parallel using mock data.
**Output:** FastAPI server with wallet auth, trip management, and voice pipeline.

### Task 3.1: Scaffold Orchestrator

**Files:**
- Create: `orchestrator/requirements.txt`
- Create: `orchestrator/db.py` (adapted from claude-superapp)
- Create: `orchestrator/README.md`

- [ ] **Step 1: Create requirements.txt**

```
fastapi>=0.115.0
uvicorn>=0.34.0
httpx>=0.28.0
python-multipart>=0.0.18
siwe>=4.3.0
eth-account>=0.13.0
pydantic>=2.0.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

- [ ] **Step 2: Create db.py** — adapted from claude-superapp, adding trips table

```python
"""
SQLite database for RoadTrip Co-Pilot.

Tables:
- users: wallet-based user records
- trips: group trip metadata
- trip_members: members of each trip
- conversations: voice interaction history
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", "./data/roadtrip.db")


def _ensure_dir():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db():
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT UNIQUE NOT NULL,
                display_name TEXT DEFAULT '',
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                organizer_wallet TEXT NOT NULL,
                contract_trip_id INTEGER,
                treasury_address TEXT,
                spend_limit_usd REAL DEFAULT 100.0,
                status TEXT NOT NULL DEFAULT 'active',
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS trip_members (
                trip_id INTEGER NOT NULL REFERENCES trips(id),
                wallet_address TEXT NOT NULL,
                display_name TEXT DEFAULT '',
                joined_at REAL NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (trip_id, wallet_address)
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER REFERENCES trips(id),
                wallet_address TEXT,
                user_transcript TEXT,
                assistant_response TEXT,
                duration_ms INTEGER,
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );
        """)


def get_or_create_user(wallet_address: str) -> dict:
    wallet = wallet_address.lower()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE wallet_address = ?", (wallet,)).fetchone()
        if row:
            return dict(row)
        conn.execute("INSERT INTO users (wallet_address) VALUES (?)", (wallet,))
        row = conn.execute("SELECT * FROM users WHERE wallet_address = ?", (wallet,)).fetchone()
        return dict(row)


def create_trip(name: str, organizer_wallet: str, contract_trip_id: int = None,
                treasury_address: str = None, spend_limit_usd: float = 100.0) -> dict:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO trips (name, organizer_wallet, contract_trip_id, treasury_address, spend_limit_usd) VALUES (?, ?, ?, ?, ?)",
            (name, organizer_wallet.lower(), contract_trip_id, treasury_address, spend_limit_usd),
        )
        trip_id = cursor.lastrowid
        # Add organizer as first member
        conn.execute(
            "INSERT INTO trip_members (trip_id, wallet_address) VALUES (?, ?)",
            (trip_id, organizer_wallet.lower()),
        )
        row = conn.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)).fetchone()
        return dict(row)


def get_trip(trip_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)).fetchone()
        return dict(row) if row else None


def list_trips(wallet_address: str) -> list[dict]:
    wallet = wallet_address.lower()
    with get_db() as conn:
        rows = conn.execute(
            """SELECT t.* FROM trips t
               JOIN trip_members tm ON t.id = tm.trip_id
               WHERE tm.wallet_address = ?
               ORDER BY t.created_at DESC""",
            (wallet,),
        ).fetchall()
        return [dict(r) for r in rows]


def add_trip_member(trip_id: int, wallet_address: str, display_name: str = "") -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO trip_members (trip_id, wallet_address, display_name) VALUES (?, ?, ?)",
            (trip_id, wallet_address.lower(), display_name),
        )


def get_trip_members(trip_id: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trip_members WHERE trip_id = ?", (trip_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def log_conversation(trip_id: int, wallet_address: str, user_transcript: str,
                     assistant_response: str, duration_ms: int):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (trip_id, wallet_address, user_transcript, assistant_response, duration_ms) VALUES (?, ?, ?, ?, ?)",
            (trip_id, wallet_address.lower(), user_transcript, assistant_response, duration_ms),
        )
```

- [ ] **Step 3: Create README**

```markdown
# Orchestrator

FastAPI backend for RoadTrip Co-Pilot. Handles wallet auth (SIWE), trip management, and the voice pipeline (STT → Claude Code → TTS).

## Setup
\`\`\`bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
\`\`\`

## Run
\`\`\`bash
uvicorn main:app --reload --port 8080
\`\`\`

## Test
\`\`\`bash
pytest tests/ -v
\`\`\`

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| POST | /v1/auth/nonce | No | Get SIWE nonce |
| POST | /v1/auth/verify | No | Verify SIWE signature, get session |
| POST | /v1/trips | Yes | Create a trip |
| GET | /v1/trips | Yes | List my trips |
| GET | /v1/trips/:id | Yes | Get trip details |
| POST | /v1/trips/:id/join | Yes | Join a trip |
| POST | /v1/voice/converse | Yes | Voice pipeline (audio in → audio out) |
```

- [ ] **Step 4: Commit**

```bash
git add orchestrator/ && git commit -m "feat(orchestrator): scaffold with db and README"
```

### Task 3.2: SIWE Wallet Auth

**Files:**
- Create: `orchestrator/auth.py`
- Create: `orchestrator/tests/test_auth.py`

- [ ] **Step 1: Write auth module**

```python
"""
Wallet-based authentication using Sign-In with Ethereum (SIWE).

Flow:
1. Frontend requests a nonce via GET /v1/auth/nonce
2. Frontend signs a SIWE message with the wallet
3. Frontend sends signature to POST /v1/auth/verify
4. Backend verifies and returns a session token
"""

import os
import secrets
import time
from dataclasses import dataclass

from siwe import SiweMessage

# In-memory nonce store (good enough for hackathon)
_nonces: dict[str, float] = {}  # nonce -> expiry timestamp
NONCE_TTL = 300  # 5 minutes

# In-memory session store
_sessions: dict[str, dict] = {}  # token -> {wallet_address, created_at}
SESSION_TTL = 86400  # 24 hours


def generate_nonce() -> str:
    nonce = secrets.token_hex(16)
    _nonces[nonce] = time.time() + NONCE_TTL
    return nonce


def verify_siwe(message: str, signature: str) -> str:
    """Verify a SIWE message and return the wallet address."""
    siwe_msg = SiweMessage.from_message(message)

    # Check nonce
    nonce = siwe_msg.nonce
    expiry = _nonces.pop(nonce, None)
    if expiry is None or time.time() > expiry:
        raise ValueError("Invalid or expired nonce")

    siwe_msg.verify(signature)
    return siwe_msg.address


def create_session(wallet_address: str) -> str:
    """Create a session token for an authenticated wallet."""
    token = secrets.token_hex(32)
    _sessions[token] = {
        "wallet_address": wallet_address.lower(),
        "created_at": time.time(),
    }
    return token


def get_session(token: str) -> dict | None:
    """Get session data from a token. Returns None if invalid/expired."""
    session = _sessions.get(token)
    if not session:
        return None
    if time.time() - session["created_at"] > SESSION_TTL:
        _sessions.pop(token, None)
        return None
    return session


def get_wallet_from_request(authorization: str | None) -> str | None:
    """Extract wallet address from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    session = get_session(token)
    return session["wallet_address"] if session else None
```

- [ ] **Step 2: Write auth tests**

```python
"""Tests for SIWE wallet authentication."""

import pytest
from auth import generate_nonce, verify_siwe, create_session, get_session, get_wallet_from_request, _nonces, _sessions


class TestNonce:
    def test_generate_nonce_unique(self):
        n1 = generate_nonce()
        n2 = generate_nonce()
        assert n1 != n2
        assert len(n1) == 32  # 16 bytes hex

    def test_generate_nonce_stored(self):
        nonce = generate_nonce()
        assert nonce in _nonces


class TestSession:
    def test_create_and_get_session(self):
        token = create_session("0xAbC123")
        session = get_session(token)
        assert session is not None
        assert session["wallet_address"] == "0xabc123"  # lowercased

    def test_invalid_token(self):
        assert get_session("nonexistent") is None

    def test_get_wallet_from_request(self):
        token = create_session("0xDEF456")
        wallet = get_wallet_from_request(f"Bearer {token}")
        assert wallet == "0xdef456"

    def test_get_wallet_no_header(self):
        assert get_wallet_from_request(None) is None

    def test_get_wallet_bad_header(self):
        assert get_wallet_from_request("Basic abc") is None
```

- [ ] **Step 3: Run tests**

```bash
cd orchestrator && python -m pytest tests/test_auth.py -v
```

- [ ] **Step 4: Commit**

```bash
git add orchestrator/auth.py orchestrator/tests/ && git commit -m "feat(orchestrator): add SIWE wallet auth"
```

### Task 3.3: Trip Management Endpoints

**Files:**
- Create: `orchestrator/trips.py`
- Create: `orchestrator/tests/test_trips.py`

- [ ] **Step 1: Write trip routes**

```python
"""Trip management endpoints."""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from auth import get_wallet_from_request
from db import create_trip, get_trip, list_trips, add_trip_member, get_trip_members

router = APIRouter(prefix="/v1/trips", tags=["trips"])


class CreateTripRequest(BaseModel):
    name: str
    spend_limit_usd: float = 100.0
    contract_trip_id: int | None = None
    treasury_address: str | None = None


class JoinTripRequest(BaseModel):
    display_name: str = ""


def _require_wallet(authorization: str | None) -> str:
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return wallet


@router.post("")
async def create_trip_endpoint(body: CreateTripRequest, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = create_trip(
        name=body.name,
        organizer_wallet=wallet,
        contract_trip_id=body.contract_trip_id,
        treasury_address=body.treasury_address,
        spend_limit_usd=body.spend_limit_usd,
    )
    return trip


@router.get("")
async def list_trips_endpoint(authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    return list_trips(wallet)


@router.get("/{trip_id}")
async def get_trip_endpoint(trip_id: int, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return {**trip, "members": get_trip_members(trip_id)}


@router.post("/{trip_id}/join")
async def join_trip_endpoint(trip_id: int, body: JoinTripRequest, authorization: str = Header(None)):
    wallet = _require_wallet(authorization)
    trip = get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    add_trip_member(trip_id, wallet, body.display_name)
    return {"status": "joined", "trip_id": trip_id}
```

- [ ] **Step 2: Write trip tests**

```python
"""Tests for trip management endpoints."""

import pytest
from fastapi.testclient import TestClient

# Setup: need to import and configure the app
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from auth import create_session

client = TestClient(app)


def auth_header(wallet: str = "0xAlice") -> dict:
    token = create_session(wallet)
    return {"Authorization": f"Bearer {token}"}


class TestTrips:
    def test_create_trip(self):
        resp = client.post("/v1/trips", json={"name": "Cannes Road Trip"}, headers=auth_header())
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Cannes Road Trip"
        assert data["organizer_wallet"] == "0xalice"

    def test_list_trips(self):
        headers = auth_header("0xBob")
        client.post("/v1/trips", json={"name": "Trip 1"}, headers=headers)
        client.post("/v1/trips", json={"name": "Trip 2"}, headers=headers)

        resp = client.get("/v1/trips", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_get_trip_with_members(self):
        headers = auth_header("0xCarol")
        resp = client.post("/v1/trips", json={"name": "Test Trip"}, headers=headers)
        trip_id = resp.json()["id"]

        resp = client.get(f"/v1/trips/{trip_id}", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()["members"]) == 1

    def test_join_trip(self):
        headers_org = auth_header("0xOrg")
        resp = client.post("/v1/trips", json={"name": "Join Test"}, headers=headers_org)
        trip_id = resp.json()["id"]

        headers_joiner = auth_header("0xJoiner")
        resp = client.post(f"/v1/trips/{trip_id}/join", json={}, headers=headers_joiner)
        assert resp.status_code == 200

        resp = client.get(f"/v1/trips/{trip_id}", headers=headers_org)
        assert len(resp.json()["members"]) == 2

    def test_unauthorized(self):
        resp = client.post("/v1/trips", json={"name": "No Auth"})
        assert resp.status_code == 401

    def test_trip_not_found(self):
        resp = client.get("/v1/trips/99999", headers=auth_header())
        assert resp.status_code == 404
```

- [ ] **Step 3: Run tests**

```bash
cd orchestrator && python -m pytest tests/test_trips.py -v
```

- [ ] **Step 4: Commit**

```bash
git add orchestrator/trips.py orchestrator/tests/test_trips.py && git commit -m "feat(orchestrator): add trip management endpoints with tests"
```

### Task 3.4: Main App + Voice Pipeline

**Files:**
- Create: `orchestrator/main.py`

- [ ] **Step 1: Write main.py** — combines auth endpoints, trip routes, voice pipeline (adapted from claude-superapp), and health checks.

```python
"""
RoadTrip Co-Pilot — Orchestrator

Central hub: wallet auth, trip management, and voice pipeline
(STT → Claude Code → TTS).
"""

import asyncio
import logging
import os
import time
import uuid

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth import generate_nonce, verify_siwe, create_session, get_wallet_from_request
from db import init_db, get_or_create_user, log_conversation
from trips import router as trips_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RoadTrip Co-Pilot Orchestrator", version="0.1.0")

# CORS for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount trip routes
app.include_router(trips_router)

# --- Config ---
VOICE_VM_INTERNAL_IP = os.environ.get("VOICE_VM_INTERNAL_IP", "")
VOICE_API_KEY = os.environ.get("VOICE_API_KEY", "")
VOICE_CHANNEL_URL = os.environ.get("VOICE_CHANNEL_URL", "http://localhost:9000")
TTS_SERVICE_URL = os.environ.get("TTS_SERVICE_URL", "http://localhost:8000")
TTS_VOICE = os.environ.get("TTS_VOICE", "en_GB-cori-high")

START_TIME = time.time()


def voice_base_url() -> str:
    return f"http://{VOICE_VM_INTERNAL_IP}:8000" if VOICE_VM_INTERNAL_IP else ""


def voice_headers() -> dict:
    return {"Authorization": f"Bearer {VOICE_API_KEY}"} if VOICE_API_KEY else {}


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("RoadTrip Co-Pilot orchestrator started")


# --- Health ---

@app.get("/health")
async def health():
    return {"status": "ok", "service": "roadtrip-orchestrator", "uptime_seconds": int(time.time() - START_TIME)}


# --- Auth Endpoints ---

@app.get("/v1/auth/nonce")
async def auth_nonce():
    return {"nonce": generate_nonce()}


@app.post("/v1/auth/verify")
async def auth_verify(request: Request):
    body = await request.json()
    message = body.get("message")
    signature = body.get("signature")
    if not message or not signature:
        raise HTTPException(status_code=400, detail="Missing message or signature")

    try:
        wallet_address = verify_siwe(message, signature)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Verification failed: {e}")

    get_or_create_user(wallet_address)
    token = create_session(wallet_address)
    return {"token": token, "wallet_address": wallet_address}


# --- Voice Pipeline (adapted from claude-superapp) ---

VOICE_POLL_INTERVAL = float(os.environ.get("VOICE_POLL_INTERVAL", "2.0"))
VOICE_POLL_TIMEOUT = float(os.environ.get("VOICE_POLL_TIMEOUT", "300.0"))


async def _speech_to_text(base_url: str, audio_bytes: bytes, filename: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/v1/audio/transcriptions",
                headers=voice_headers(),
                files={"file": (filename, audio_bytes, "audio/wav")},
                data={"model": "Systran/faster-whisper-small"},
            )
            if resp.status_code != 200:
                raise Exception(f"STT returned {resp.status_code}")
            return resp.json().get("text", "").strip()
    except httpx.ConnectError:
        raise Exception("Voice VM unreachable")


async def _voice_channel_request(text: str, user_id: str, detail_level: str = "standard") -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{VOICE_CHANNEL_URL}/voice",
                json={"text": text, "user_id": user_id, "detail_level": detail_level, "type": "voice"},
            )
        if resp.status_code != 202 and resp.status_code != 200:
            return "I encountered an error submitting your request."

        data = resp.json()
        if "response" in data:
            return data["response"]

        request_id = data.get("request_id")
        if not request_id:
            return "I encountered an error."
    except (httpx.ConnectError, httpx.TimeoutException):
        return "The voice service is temporarily unavailable."

    # Poll for result
    deadline = time.time() + VOICE_POLL_TIMEOUT
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while time.time() < deadline:
                await asyncio.sleep(VOICE_POLL_INTERVAL)
                try:
                    poll_resp = await client.get(f"{VOICE_CHANNEL_URL}/voice/{request_id}")
                except (httpx.ConnectError, httpx.TimeoutException):
                    continue
                data = poll_resp.json()
                if data.get("status") == "completed":
                    return data.get("response", "")
                elif data.get("status") == "error":
                    return "The request timed out."
    except Exception:
        return "Error waiting for response."

    return "Request timed out."


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 22050) -> bytes:
    import struct
    data_size = len(pcm_data)
    byte_rate = sample_rate * 1 * 16 // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, 1, sample_rate, byte_rate, 2, 16,
        b"data", data_size,
    )
    return header + pcm_data


async def _text_to_speech(text: str) -> bytes:
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{TTS_SERVICE_URL}/v1/tts/stream",
                json={"text": text, "voice": TTS_VOICE, "speed": 1.0},
            )
            if resp.status_code != 200:
                raise Exception(f"TTS returned {resp.status_code}")
            sample_rate = int(resp.headers.get("X-Sample-Rate", "22050"))
            return _pcm_to_wav(resp.content, sample_rate=sample_rate)
    except httpx.ConnectError:
        raise Exception("TTS service unreachable")


@app.post("/v1/voice/converse")
async def voice_converse(
    audio: UploadFile = File(...),
    trip_id: int = Form(None),
    detail_level: str = Form("standard"),
    authorization: str = Header(None),
):
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")

    base = voice_base_url()
    if not base:
        raise HTTPException(status_code=503, detail="Voice VM not configured")

    audio_bytes = await audio.read()
    filename = audio.filename or "audio.wav"

    # STT
    user_transcript = await _speech_to_text(base, audio_bytes, filename)
    if not user_transcript:
        raise HTTPException(status_code=400, detail="No speech detected")

    # Claude Code via voice channel
    assistant_text = await _voice_channel_request(user_transcript, wallet, detail_level)

    # TTS
    try:
        response_audio = await _text_to_speech(assistant_text)
    except Exception:
        # Return text-only if TTS fails
        return JSONResponse(content={
            "user_transcript": user_transcript,
            "assistant_text": assistant_text,
            "audio": None,
        })

    return Response(
        content=response_audio,
        media_type="audio/wav",
        headers={
            "X-User-Transcript": user_transcript[:200],
            "X-Trip-Id": str(trip_id or ""),
        },
    )


# --- Text converse (for web frontend without mic) ---

@app.post("/v1/text/converse")
async def text_converse(request: Request, authorization: str = Header(None)):
    wallet = get_wallet_from_request(authorization)
    if not wallet:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    text = body.get("text", "")
    trip_id = body.get("trip_id")

    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    assistant_text = await _voice_channel_request(text, wallet)

    if trip_id:
        log_conversation(trip_id, wallet, text, assistant_text, 0)

    return {"user_text": text, "assistant_text": assistant_text}
```

- [ ] **Step 2: Run all tests**

```bash
cd orchestrator && python -m pytest tests/ -v
```

- [ ] **Step 3: Commit**

```bash
git add orchestrator/main.py && git commit -m "feat(orchestrator): main app with auth, trips, voice pipeline"
```

---

## Workstream 4: Web Frontend

**Depends on:** Orchestrator API shape (Task 3.3-3.4), contract ABI (Task 1.2).
**Output:** Next.js web app with WalletConnect login, trip dashboard, voice interface.

### Task 4.1: Scaffold Next.js + Reown AppKit

**Files:**
- Create: `web/package.json`, `web/next.config.ts`, `web/tailwind.config.ts`
- Create: `web/src/app/layout.tsx`, `web/src/app/page.tsx`
- Create: `web/src/lib/wagmi.ts`

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/snojj25/Desktop/505/hackhatons/cannes/ethglobal
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

- [ ] **Step 2: Install WalletConnect / Reown AppKit + wagmi + viem**

```bash
cd web && npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query
```

- [ ] **Step 3: Create wagmi config** (`web/src/lib/wagmi.ts`)

Configure with Arc testnet chain and WalletConnect project ID. The agent will need to look up the Arc testnet chain ID and RPC URL, and use a WalletConnect project ID (obtainable from cloud.walletconnect.com — for hackathon, use a placeholder that the user fills in).

- [ ] **Step 4: Create app layout with providers** (`web/src/app/layout.tsx`)

Wrap the app with WagmiProvider, QueryClientProvider, and Reown AppKit context.

- [ ] **Step 5: Create landing page** (`web/src/app/page.tsx`)

Show "Give your car a wallet" hero + Reown AppKit connect button. When connected, show trip creation or trip list.

- [ ] **Step 6: Verify it runs**

```bash
cd web && npm run dev
# Visit http://localhost:3000 — should show connect wallet button
```

- [ ] **Step 7: Commit**

```bash
git add web/ && git commit -m "feat(web): scaffold Next.js with Reown AppKit"
```

### Task 4.2: Trip Creation & Dashboard Components

**Files:**
- Create: `web/src/components/CreateTrip.tsx`
- Create: `web/src/components/TreasuryDashboard.tsx`
- Create: `web/src/components/SpendingFeed.tsx`
- Create: `web/src/lib/api.ts`
- Create: `web/src/app/trip/[id]/page.tsx`

- [ ] **Step 1: Create API client** (`web/src/lib/api.ts`)

Wrapper around fetch to call orchestrator endpoints with auth token.

- [ ] **Step 2: Create trip creation form** (`web/src/components/CreateTrip.tsx`)

Form with trip name, spend limit, submit to orchestrator.

- [ ] **Step 3: Create treasury dashboard** (`web/src/components/TreasuryDashboard.tsx`)

Show pool balance, per-member deposits, category budgets, spending progress bars.

- [ ] **Step 4: Create spending feed** (`web/src/components/SpendingFeed.tsx`)

Real-time list of transactions from the treasury.

- [ ] **Step 5: Create trip page** (`web/src/app/trip/[id]/page.tsx`)

Combines dashboard + spending feed + voice interface.

- [ ] **Step 6: Verify components render**

```bash
cd web && npm run dev
```

- [ ] **Step 7: Commit**

```bash
git add web/src/ && git commit -m "feat(web): add trip creation and dashboard components"
```

### Task 4.3: Voice Interface Component

**Files:**
- Create: `web/src/components/VoiceInterface.tsx`

- [ ] **Step 1: Create voice interface**

Uses browser MediaRecorder API to capture audio, sends to orchestrator `/v1/voice/converse`, plays back WAV response. Also has a text fallback input that calls `/v1/text/converse`.

- [ ] **Step 2: Test in browser**

Open the trip page, test mic recording and text input.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/VoiceInterface.tsx && git commit -m "feat(web): add voice interface component"
```

### Task 4.4: Smart Contract Integration (Deposit + Read)

**Files:**
- Create: `web/src/lib/treasury.ts`
- Modify: `web/src/components/TreasuryDashboard.tsx`

- [ ] **Step 1: Create contract hooks** (`web/src/lib/treasury.ts`)

Use wagmi's `useReadContract` and `useWriteContract` to interact with GroupTreasury: deposit USDC, read balance, read members, read spend history.

- [ ] **Step 2: Wire dashboard to live contract data**

Replace mock data in TreasuryDashboard with real contract reads.

- [ ] **Step 3: Add deposit button**

USDC approve + deposit flow.

- [ ] **Step 4: Commit**

```bash
git add web/src/ && git commit -m "feat(web): wire contract reads and deposit flow"
```

### Task 4.5: Web README

**Files:**
- Create: `web/README.md`

- [ ] **Step 1: Write README**

```markdown
# RoadTrip Co-Pilot — Web Frontend

Next.js web app with WalletConnect login, trip management, treasury dashboard, and voice interface.

## Setup
\`\`\`bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and NEXT_PUBLIC_ORCHESTRATOR_URL
\`\`\`

## Run
\`\`\`bash
npm run dev
\`\`\`

## Environment Variables
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from cloud.walletconnect.com
- `NEXT_PUBLIC_ORCHESTRATOR_URL` — backend URL (default: http://localhost:8080)
- `NEXT_PUBLIC_TREASURY_ADDRESS` — deployed GroupTreasury contract address
- `NEXT_PUBLIC_USDC_ADDRESS` — USDC token address on Arc testnet
```

- [ ] **Step 2: Commit**

```bash
git add web/README.md && git commit -m "docs(web): add frontend README"
```

---

## Workstream 5: Agent Config & Integration

**Depends on:** MCP servers (WS2), voice-channel from claude-superapp.
**Output:** CLAUDE.md persona + .mcp.json config that turns Claude Code into a road trip co-pilot.

### Task 5.1: Agent CLAUDE.md

**Files:**
- Create: `agent/CLAUDE.md`

- [ ] **Step 1: Write the road trip co-pilot persona**

```markdown
# RoadTrip Co-Pilot Agent

You are the RoadTrip Co-Pilot — an AI voice assistant that manages group road trips. You help find stops, manage the group's shared USDC treasury, and keep everyone on track.

## Your Capabilities

You have access to these tools via MCP:

### Google Maps (`google-maps` MCP)
- `maps_search_places` — find restaurants, gas stations, hotels, attractions
- `maps_place_details` — get hours, ratings, reviews for a place
- `maps_directions` — get routes and directions
- `maps_distance_matrix` — calculate travel times

### Treasury (`treasury` MCP)
- `treasury_balance` — check the group pool balance, per-member spending, category budgets
- `treasury_spend` — pay for something from the group pool (you are the authorized agent)
- `treasury_history` — view recent spending

### Trip Memory (`trip-memory` MCP)
- `save_trip_data` — remember preferences, itinerary, notes
- `load_trip_data` — recall saved information
- `list_trip_keys` — see what data is saved

### Voice Channel
- `voice_reply` — respond to voice messages (your response will be spoken via TTS)

## Behavior Rules

1. **Be concise.** Responses are spoken aloud via TTS. Keep them short (1-3 sentences).
2. **Be proactive.** If you notice something useful (cheap gas ahead, weather change, time for a break), mention it.
3. **Spend wisely.** Always state the amount before spending. For anything over the auto-limit, explain why and request approval.
4. **Track categories.** Every spend must have a category (food, gas, lodging, activities).
5. **Know the budget.** Check `treasury_balance` before suggesting expensive options.
6. **Remember preferences.** Use `save_trip_data` to remember dietary restrictions, preferred stops, etc.

## Voice Response Style

- Natural, conversational tone — you're a friend in the car, not a robot
- No markdown, no URLs, no code in voice replies
- Use numbers naturally: "about thirty-eight fifty" not "$38.50"
- Keep it under 30 seconds of speech per response
```

- [ ] **Step 2: Commit**

```bash
git add agent/CLAUDE.md && git commit -m "feat(agent): add road trip co-pilot persona"
```

### Task 5.2: MCP Server Config

**Files:**
- Create: `agent/.mcp.json`

- [ ] **Step 1: Write .mcp.json**

```json
{
  "mcpServers": {
    "google-maps": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-google-maps"],
      "env": {
        "GOOGLE_MAPS_API_KEY": "${GOOGLE_MAPS_API_KEY}"
      }
    },
    "weather": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-weather"]
    },
    "treasury": {
      "command": "bun",
      "args": ["../mcp-servers/treasury/index.ts"],
      "env": {
        "RPC_URL": "${RPC_URL}",
        "TREASURY_ADDRESS": "${TREASURY_ADDRESS}",
        "AGENT_PRIVATE_KEY": "${AGENT_PRIVATE_KEY}",
        "CHAIN_ID": "${CHAIN_ID}"
      }
    },
    "trip-memory": {
      "command": "bun",
      "args": ["../mcp-servers/trip-memory/index.ts"],
      "env": {
        "TRIP_MEMORY_DIR": "${TRIP_MEMORY_DIR}"
      }
    }
  }
}
```

- [ ] **Step 2: Create agent README**

```markdown
# Agent Config

Claude Code configuration for the RoadTrip Co-Pilot agent.

## Setup

1. Copy `.mcp.json` to the Claude Code working directory
2. Set environment variables (see below)
3. Start Claude Code with voice-channel loaded

## Environment Variables
- `GOOGLE_MAPS_API_KEY` — Google Maps Platform API key
- `RPC_URL` — Arc testnet RPC URL
- `TREASURY_ADDRESS` — Deployed GroupTreasury contract address
- `AGENT_PRIVATE_KEY` — Agent wallet private key
- `CHAIN_ID` — Chain ID
- `TRIP_MEMORY_DIR` — Directory for trip data (default: ./trip-data)
```

- [ ] **Step 3: Commit**

```bash
git add agent/ && git commit -m "feat(agent): add MCP config and README"
```

### Task 5.3: Root README + Project Setup

**Files:**
- Create: `README.md` (root)

- [ ] **Step 1: Write root README**

```markdown
# RoadTrip Co-Pilot 🚗

**"Give your car a wallet."**

Voice-first AI agent for group road trips. Friends pool USDC into a shared on-chain treasury. The AI agent manages the trip: finds stops, recommends options, and autonomously spends from the pool.

Built for ETHGlobal Cannes 2026.

## Architecture

```
Web App (voice + dashboard)
        │
  [orchestrator :8080]  ← FastAPI, SIWE auth, trip mgmt
     │         │
[Voice VM]  [voice-channel :9000]  ← MCP bridge
 STT/TTS         │
            [Claude Code session]
              with MCP servers:
              ├── google-maps (places, directions)
              ├── treasury (smart contract)
              ├── trip-memory (0G storage)
              └── weather
                      │
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

See each component's README for setup instructions.

## Sponsor Tracks

- **Arc** — Nanopayments, Stablecoin Logic, Chain Abstraction
- **WalletConnect** — Pay, Reown SDK
- **0G** — OpenClaw Agent
```

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add root project README"
```

---

## Integration Testing (after all workstreams complete)

### Task 6.1: End-to-End Smoke Test

- [ ] **Step 1: Start local Anvil node and deploy contract**

```bash
cd contracts && anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

- [ ] **Step 2: Start orchestrator**

```bash
cd orchestrator && uvicorn main:app --port 8080
```

- [ ] **Step 3: Start web frontend**

```bash
cd web && npm run dev
```

- [ ] **Step 4: Test wallet connect flow in browser**

Open http://localhost:3000, connect wallet, create trip, verify it shows in list.

- [ ] **Step 5: Test treasury MCP server manually**

```bash
cd mcp-servers/treasury
TREASURY_ADDRESS=<deployed_address> AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 bun index.ts
# In another terminal, send MCP requests
```

- [ ] **Step 6: Commit integration test notes**

```bash
git commit --allow-empty -m "test: verify e2e smoke test passes"
```
