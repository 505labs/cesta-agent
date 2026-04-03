#!/usr/bin/env bun
/**
 * Trip Treasury MCP Server
 *
 * Exposes tools for the Claude Code agent to interact with the
 * GroupTreasury smart contract: check balances, spend from pool,
 * view history.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { GROUP_TREASURY_ABI } from "./abi.js";

// --- Config ---
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS as
  | `0x${string}`
  | undefined;
const CHAIN_ID = parseInt(process.env.CHAIN_ID ?? "31337", 10);

// --- Viem Clients ---
const chain = { ...foundry, id: CHAIN_ID };
const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain, transport });

let walletClient: ReturnType<typeof createWalletClient> | null = null;
if (AGENT_PRIVATE_KEY) {
  const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
  walletClient = createWalletClient({ account, chain, transport });
}

// --- MCP Server ---
const server = new Server(
  { name: "trip-treasury", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "treasury_balance",
      description:
        "Get the current balance and spending summary for a trip treasury. Returns total deposited, total spent, remaining balance, and per-member deposits.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
        },
        required: ["trip_id"],
      },
    },
    {
      name: "treasury_spend",
      description:
        'Spend USDC from the group treasury. Only the authorized agent can call this. Amount is in USD (e.g., 38.50 for $38.50).',
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
          recipient: {
            type: "string" as const,
            description: "Recipient wallet address",
          },
          amount_usd: {
            type: "number" as const,
            description: "Amount in USD (e.g., 38.50)",
          },
          category: {
            type: "string" as const,
            enum: ["food", "gas", "lodging", "activities"],
            description: "Spending category",
          },
          description: {
            type: "string" as const,
            description: "What was purchased",
          },
        },
        required: [
          "trip_id",
          "recipient",
          "amount_usd",
          "category",
          "description",
        ],
      },
    },
    {
      name: "treasury_history",
      description: "Get the spending history for a trip treasury.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
        },
        required: ["trip_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const addr = TREASURY_ADDRESS;

  if (!addr) {
    return {
      content: [
        { type: "text", text: "Error: TREASURY_ADDRESS not configured" },
      ],
      isError: true,
    };
  }

  try {
    if (name === "treasury_balance") {
      const tripId = BigInt(args!.trip_id as number);
      const [trip, memberAddrs] = await Promise.all([
        publicClient.readContract({
          address: addr,
          abi: GROUP_TREASURY_ABI,
          functionName: "getTrip",
          args: [tripId],
        }),
        publicClient.readContract({
          address: addr,
          abi: GROUP_TREASURY_ABI,
          functionName: "getMembers",
          args: [tripId],
        }),
      ]);

      const memberDeposits = await Promise.all(
        (memberAddrs as readonly `0x${string}`[]).map(async (m) => {
          const dep = await publicClient.readContract({
            address: addr,
            abi: GROUP_TREASURY_ABI,
            functionName: "getMemberDeposit",
            args: [tripId, m],
          });
          return { address: m, deposited: formatUnits(dep as bigint, 6) };
        })
      );

      const t = trip as any;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                trip_id: Number(tripId),
                status: Number(t.status) === 0 ? "active" : "settled",
                total_deposited_usd: formatUnits(t.totalDeposited, 6),
                total_spent_usd: formatUnits(t.totalSpent, 6),
                remaining_usd: formatUnits(
                  t.totalDeposited - t.totalSpent,
                  6
                ),
                spend_limit_usd: formatUnits(t.spendLimit, 6),
                member_count: Number(t.memberCount),
                members: memberDeposits,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "treasury_spend") {
      if (!walletClient) {
        return {
          content: [
            {
              type: "text",
              text: "Error: AGENT_PRIVATE_KEY not configured -- cannot send transactions",
            },
          ],
          isError: true,
        };
      }
      const tripId = BigInt(args!.trip_id as number);
      const amount = parseUnits(String(args!.amount_usd), 6);

      const hash = await walletClient.writeContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: "spend",
        args: [
          tripId,
          args!.recipient as `0x${string}`,
          amount,
          args!.category as string,
          args!.description as string,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                tx_hash: hash,
                block_number: Number(receipt.blockNumber),
                amount_usd: args!.amount_usd,
                category: args!.category,
                description: args!.description,
                recipient: args!.recipient,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "treasury_history") {
      const tripId = BigInt(args!.trip_id as number);
      const rawSpends = (await publicClient.readContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: "getSpends",
        args: [tripId],
      })) as any[];

      const history = rawSpends.map((s: any) => ({
        recipient: s.recipient,
        amount_usd: formatUnits(s.amount, 6),
        category: s.category,
        description: s.description,
        timestamp: new Date(Number(s.timestamp) * 1000).toISOString(),
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// --- Start ---
await server.connect(new StdioServerTransport());
