#!/usr/bin/env bun
/**
 * Trip Treasury MCP Server
 *
 * Exposes tools for the Claude Code agent to interact with the
 * GroupTreasury smart contract: check balances, spend from pool,
 * view history, nanopayments, x402 data requests, category budgets,
 * and group voting.
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
const X402_SERVER_URL =
  process.env.X402_SERVER_URL ?? "http://localhost:4402";

// --- Viem Clients ---
const chain = { ...foundry, id: CHAIN_ID };
const transport = http(RPC_URL);
const publicClient = createPublicClient({ chain, transport });

let walletClient: ReturnType<typeof createWalletClient> | null = null;
let agentAddress: `0x${string}` | undefined;
if (AGENT_PRIVATE_KEY) {
  const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
  agentAddress = account.address;
  walletClient = createWalletClient({ account, chain, transport });
}

// --- MCP Server ---
const server = new Server(
  { name: "trip-treasury", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "treasury_balance",
      description:
        "Get the current balance and spending summary for a trip treasury. Returns total deposited, total spent, remaining balance, per-member deposits, nanopayment total, and daily spending.",
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
    {
      name: "nanopayment_spend",
      description:
        "Send a micro-transaction (nanopayment) from the group treasury. Used for small purchases like parking, tolls, data fees, and transit fares. Amount is in USD (e.g., 0.003 for $0.003).",
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
            description: "Amount in USD (e.g., 0.003 for $0.003)",
          },
          category: {
            type: "string" as const,
            enum: ["parking", "tolls", "data", "fares"],
            description: "Nanopayment category",
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
      name: "x402_data_request",
      description:
        "Fetch paid data from an x402-compatible API endpoint. Handles the 402 payment flow automatically: detects payment requirement, creates a nanopayment on-chain, and retries with the payment header.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
          endpoint: {
            type: "string" as const,
            enum: [
              "gas-prices",
              "restaurants",
              "weather",
              "route-optimization",
            ],
            description: "The x402 data endpoint to query",
          },
        },
        required: ["trip_id", "endpoint"],
      },
    },
    {
      name: "treasury_category_budgets",
      description:
        "Get category budgets and spending for a trip. Returns budget and amount spent for common categories: food, gas, lodging, activities, parking, tolls, data.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
        },
        required: ["trip_id"],
      },
    },
    {
      name: "group_vote_request",
      description:
        "Request a group vote for a large spend. Members must approve before the funds are released. Returns the vote ID for tracking.",
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
            description: "Amount in USD (e.g., 150.00)",
          },
          category: {
            type: "string" as const,
            description: "Spending category",
          },
          description: {
            type: "string" as const,
            description: "What the funds are for",
          },
          threshold: {
            type: "number" as const,
            description:
              "Number of votes needed to approve (default: 2)",
          },
        },
        required: ["trip_id", "recipient", "amount_usd", "category", "description"],
      },
    },
    {
      name: "group_vote_status",
      description:
        "Check the status of a group vote request. Returns vote details, current vote count, threshold, and whether it has been executed.",
      inputSchema: {
        type: "object" as const,
        properties: {
          vote_id: {
            type: "number" as const,
            description: "The vote ID returned from group_vote_request",
          },
        },
        required: ["vote_id"],
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
    // ----------------------------------------------------------------
    // treasury_balance
    // ----------------------------------------------------------------
    if (name === "treasury_balance") {
      const tripId = BigInt(args!.trip_id as number);
      const [trip, memberAddrs, nanopaymentTotal, dailySpending] =
        await Promise.all([
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
          publicClient.readContract({
            address: addr,
            abi: GROUP_TREASURY_ABI,
            functionName: "getNanopaymentTotal",
            args: [tripId],
          }),
          publicClient.readContract({
            address: addr,
            abi: GROUP_TREASURY_ABI,
            functionName: "getDailySpending",
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
                nanopayment_total_usd: formatUnits(
                  nanopaymentTotal as bigint,
                  6
                ),
                daily_spending_usd: formatUnits(
                  dailySpending as bigint,
                  6
                ),
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

    // ----------------------------------------------------------------
    // treasury_spend
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // treasury_history
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // nanopayment_spend
    // ----------------------------------------------------------------
    if (name === "nanopayment_spend") {
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
        functionName: "nanopayment",
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
                type: "nanopayment",
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

    // ----------------------------------------------------------------
    // x402_data_request
    // ----------------------------------------------------------------
    if (name === "x402_data_request") {
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
      const endpoint = args!.endpoint as string;
      const url = `${X402_SERVER_URL}/${endpoint}`;

      // Step 1: Initial request -- expect a 402 Payment Required
      const initialResponse = await fetch(url);

      if (initialResponse.status !== 402) {
        // If the server did not require payment, return data directly
        const data = await initialResponse.json();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  endpoint,
                  payment_required: false,
                  data,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Step 2: Parse payment requirements from the 402 response
      const paymentReqs = await initialResponse.json();
      const paymentAmount = paymentReqs.amount ?? paymentReqs.maxAmountRequired ?? 1000; // amount in smallest unit (e.g., 1000 = $0.001)
      const paymentRecipient =
        (paymentReqs.recipient ?? paymentReqs.payTo) as `0x${string}`;

      // Step 3: Build the payment header
      const paymentHeader = btoa(
        JSON.stringify({
          agent: agentAddress,
          amount: paymentAmount,
          recipient: paymentRecipient,
          tripId: Number(tripId),
          timestamp: Date.now(),
        })
      );

      // Step 4: Record the nanopayment on-chain
      const amountBigInt = BigInt(paymentAmount);
      const hash = await walletClient.writeContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: "nanopayment",
        args: [
          tripId,
          paymentRecipient,
          amountBigInt,
          "data",
          `x402: ${endpoint}`,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Step 5: Retry with payment header
      const paidResponse = await fetch(url, {
        headers: { "X-PAYMENT": paymentHeader },
      });
      const data = await paidResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                endpoint,
                payment_required: true,
                payment: {
                  tx_hash: hash,
                  block_number: Number(receipt.blockNumber),
                  amount_raw: paymentAmount,
                  amount_usd: formatUnits(amountBigInt, 6),
                  recipient: paymentRecipient,
                },
                data,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ----------------------------------------------------------------
    // treasury_category_budgets
    // ----------------------------------------------------------------
    if (name === "treasury_category_budgets") {
      const tripId = BigInt(args!.trip_id as number);
      const categories = [
        "food",
        "gas",
        "lodging",
        "activities",
        "parking",
        "tolls",
        "data",
      ];

      const results = await Promise.all(
        categories.map(async (cat) => {
          const [budget, spent] = (await publicClient.readContract({
            address: addr,
            abi: GROUP_TREASURY_ABI,
            functionName: "getCategoryBudget",
            args: [tripId, cat],
          })) as [bigint, bigint];
          return {
            category: cat,
            budget_usd: formatUnits(budget, 6),
            spent_usd: formatUnits(spent, 6),
            remaining_usd: formatUnits(budget - spent, 6),
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { trip_id: Number(tripId), categories: results },
              null,
              2
            ),
          },
        ],
      };
    }

    // ----------------------------------------------------------------
    // group_vote_request
    // ----------------------------------------------------------------
    if (name === "group_vote_request") {
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
      const threshold = BigInt((args!.threshold as number) ?? 2);

      const hash = await walletClient.writeContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: "requestVote",
        args: [
          tripId,
          args!.recipient as `0x${string}`,
          amount,
          args!.category as string,
          args!.description as string,
          threshold,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Extract voteId from the VoteRequested event log
      let voteId: string | null = null;
      for (const log of receipt.logs) {
        // The VoteRequested event topic
        // We look for a log with 3 topics (event sig + 2 indexed params)
        if (log.topics.length >= 2) {
          // The first indexed param (topics[1]) is the voteId
          const possibleVoteId = BigInt(log.topics[1]!);
          // The second indexed param (topics[2]) is the tripId
          if (log.topics.length >= 3) {
            const possibleTripId = BigInt(log.topics[2]!);
            if (possibleTripId === tripId) {
              voteId = possibleVoteId.toString();
              break;
            }
          }
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                tx_hash: hash,
                block_number: Number(receipt.blockNumber),
                vote_id: voteId,
                trip_id: Number(tripId),
                amount_usd: args!.amount_usd,
                category: args!.category,
                description: args!.description,
                threshold: Number(threshold),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // ----------------------------------------------------------------
    // group_vote_status
    // ----------------------------------------------------------------
    if (name === "group_vote_status") {
      const voteId = BigInt(args!.vote_id as number);

      const result = (await publicClient.readContract({
        address: addr,
        abi: GROUP_TREASURY_ABI,
        functionName: "getVoteRequest",
        args: [voteId],
      })) as [bigint, `0x${string}`, bigint, string, string, bigint, bigint, boolean];

      const [tripId, recipient, amount, category, description, threshold, voteCount, executed] =
        result;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                vote_id: Number(voteId),
                trip_id: Number(tripId),
                recipient,
                amount_usd: formatUnits(amount, 6),
                category,
                description,
                threshold: Number(threshold),
                vote_count: Number(voteCount),
                executed,
                status: executed
                  ? "executed"
                  : Number(voteCount) >= Number(threshold)
                    ? "ready_to_execute"
                    : "pending",
              },
              null,
              2
            ),
          },
        ],
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
