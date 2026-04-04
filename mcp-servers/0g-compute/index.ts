#!/usr/bin/env bun
/**
 * 0G Compute MCP Server
 *
 * Provides TEE-verified AI inference via 0G Compute Network.
 * Falls back to a simple local response when 0G providers are unavailable.
 *
 * Used by the RoadTrip Co-Pilot agent for verifiable spending recommendations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZeroGCompute, type VerifiedResult } from "./compute-0g.js";

// --- Config ---
const OG_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY ?? "";
const OG_RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const OG_ENABLED = process.env.OG_COMPUTE_ENABLED !== "false";

// --- Compute Backend ---
let compute: ZeroGCompute | null = null;
let computeMode: "0g" | "fallback" = "fallback";

async function initCompute(): Promise<void> {
  if (!OG_ENABLED || !OG_PRIVATE_KEY) {
    console.error("[0g-compute] Disabled or no private key — using fallback mode");
    return;
  }

  try {
    compute = new ZeroGCompute({ privateKey: OG_PRIVATE_KEY, rpcUrl: OG_RPC });
    await compute.initialize();
    computeMode = "0g";
    console.error("[0g-compute] 0G Compute initialized successfully");
  } catch (err: any) {
    console.error(`[0g-compute] Init failed: ${err.message} — using fallback mode`);
    compute = null;
  }
}

// --- Fallback: simple local evaluation (no TEE verification) ---
function fallbackEvaluate(prompt: string): VerifiedResult {
  return {
    result: `[LOCAL FALLBACK — not TEE-verified]\n\nEvaluation request received but 0G Compute is unavailable. The agent should use its own reasoning to evaluate this request:\n\n${prompt}`,
    verified: false,
    model: "fallback",
    provider: "local",
  };
}

// --- MCP Server ---
const server = new Server(
  { name: "0g-compute", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "verified_evaluate",
      description:
        "Evaluate a spending recommendation or trip decision using 0G Compute's TEE-sealed inference. The response is cryptographically verified — proving the AI model actually produced this output without tampering. Use this for spending decisions, restaurant comparisons, route evaluations, or any recommendation involving group money.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prompt: {
            type: "string" as const,
            description:
              "The evaluation prompt. Include all context: options to compare, budget constraints, group preferences.",
          },
          system_prompt: {
            type: "string" as const,
            description:
              "Optional system prompt to set the evaluation context. Defaults to trip spending advisor.",
          },
        },
        required: ["prompt"],
      },
    },
    {
      name: "list_providers",
      description: "List available 0G Compute providers and their models.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "compute_status",
      description: "Check 0G Compute connection status and mode (0g or fallback).",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "verified_evaluate") {
      const prompt = args!.prompt as string;
      const systemPrompt = (args?.system_prompt as string) ??
        "You are an objective trip spending advisor. Evaluate options based on price, quality, distance, and group preferences. Be concise and decisive.";

      let result: VerifiedResult;

      if (compute && computeMode === "0g") {
        try {
          result = await compute.inference(prompt, systemPrompt);
        } catch (err: any) {
          console.error(`[0g-compute] Inference failed: ${err.message} — using fallback`);
          result = fallbackEvaluate(prompt);
        }
      } else {
        result = fallbackEvaluate(prompt);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                evaluation: result.result,
                verified: result.verified,
                model: result.model,
                provider: result.provider,
                chatId: result.chatId,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (name === "list_providers") {
      if (compute && computeMode === "0g") {
        try {
          const providers = await compute.listProviders();
          return {
            content: [{ type: "text", text: JSON.stringify(providers, null, 2) }],
          };
        } catch (err: any) {
          return {
            content: [{ type: "text", text: `Failed to list providers: ${err.message}` }],
            isError: true,
          };
        }
      }
      return {
        content: [{ type: "text", text: "0G Compute not connected — no providers available" }],
      };
    }

    if (name === "compute_status") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: computeMode,
                enabled: OG_ENABLED,
                hasPrivateKey: !!OG_PRIVATE_KEY,
                rpcUrl: OG_RPC,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err: any) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

await initCompute();
await server.connect(new StdioServerTransport());
