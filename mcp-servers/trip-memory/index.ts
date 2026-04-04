#!/usr/bin/env bun
/**
 * Trip Memory MCP Server v2
 *
 * Persists trip data using 0G decentralized storage (KV store + file storage).
 * Falls back to local JSON files when 0G is unavailable.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { ZeroGStorage } from "./storage-0g.js";

// --- Config ---
const DATA_DIR = process.env.TRIP_MEMORY_DIR ?? "./trip-data";
mkdirSync(DATA_DIR, { recursive: true });

const OG_ENABLED = process.env.OG_STORAGE_ENABLED !== "false";
const OG_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY ?? "";
const OG_RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const OG_INDEXER = process.env.OG_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai";
const OG_KV_NODE = process.env.OG_KV_NODE_URL ?? "http://3.101.147.150:6789";
const OG_FLOW_CONTRACT = process.env.OG_FLOW_CONTRACT ?? "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296";

// --- Storage Backend ---
let zgStorage: ZeroGStorage | null = null;
let storageMode: "0g" | "local" = "local";

async function initStorage(): Promise<void> {
  if (!OG_ENABLED || !OG_PRIVATE_KEY) {
    console.error("[trip-memory] 0G Storage disabled or no private key — using local fallback");
    return;
  }

  try {
    zgStorage = new ZeroGStorage({
      privateKey: OG_PRIVATE_KEY,
      rpcUrl: OG_RPC,
      indexerUrl: OG_INDEXER,
      kvNodeUrl: OG_KV_NODE,
      flowContractAddress: OG_FLOW_CONTRACT,
    });
    await zgStorage.initialize();
    storageMode = "0g";
    console.error("[trip-memory] 0G Storage initialized successfully");
  } catch (err: any) {
    console.error(`[trip-memory] 0G Storage init failed: ${err.message} — using local fallback`);
    zgStorage = null;
  }
}

// --- Local Filesystem Helpers ---
function localDataPath(tripId: number, key: string): string {
  const tripDir = join(DATA_DIR, `trip-${tripId}`);
  mkdirSync(tripDir, { recursive: true });
  return join(tripDir, `${key}.json`);
}

function localFilePath(tripId: number, filename: string): string {
  const tripDir = join(DATA_DIR, `trip-${tripId}`, "files");
  mkdirSync(tripDir, { recursive: true });
  return join(tripDir, filename);
}

// --- Save Trip Data ---
async function saveTripData(tripId: number, key: string, data: any): Promise<string> {
  // Always save locally as cache
  const localPath = localDataPath(tripId, key);
  writeFileSync(localPath, JSON.stringify(data, null, 2));

  if (zgStorage && storageMode === "0g") {
    try {
      const result = await zgStorage.kvSet(tripId, key, data);
      return `Saved "${key}" for trip ${tripId} to 0G Storage (tx: ${result.txHash ?? "batched"})`;
    } catch (err: any) {
      console.error(`[trip-memory] 0G KV write failed: ${err.message} — saved locally`);
      return `Saved "${key}" for trip ${tripId} locally (0G unavailable: ${err.message})`;
    }
  }

  return `Saved "${key}" for trip ${tripId} locally`;
}

// --- Load Trip Data ---
async function loadTripData(tripId: number, key: string): Promise<{ data: any; source: string } | null> {
  if (zgStorage && storageMode === "0g") {
    try {
      const data = await zgStorage.kvGet(tripId, key);
      if (data !== null) {
        return { data, source: "0g" };
      }
    } catch (err: any) {
      console.error(`[trip-memory] 0G KV read failed: ${err.message} — trying local`);
    }
  }

  // Fallback to local
  const localPath = localDataPath(tripId, key);
  if (!existsSync(localPath)) {
    return null;
  }
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  return { data, source: "local" };
}

// --- List Trip Keys ---
async function listTripKeys(tripId: number): Promise<string[]> {
  const tripDir = join(DATA_DIR, `trip-${tripId}`);
  if (!existsSync(tripDir)) return [];
  return readdirSync(tripDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

// --- Save Trip File ---
async function saveTripFile(tripId: number, filePath: string): Promise<{ rootHash?: string; localPath: string }> {
  const filename = filePath.split("/").pop() ?? "file";
  const localDest = localFilePath(tripId, filename);

  const content = readFileSync(filePath);
  writeFileSync(localDest, content);

  if (zgStorage && storageMode === "0g") {
    try {
      const result = await zgStorage.uploadFile(filePath);
      return { rootHash: result.rootHash, localPath: localDest };
    } catch (err: any) {
      console.error(`[trip-memory] 0G file upload failed: ${err.message} — saved locally only`);
    }
  }

  return { localPath: localDest };
}

// --- Load Trip File ---
async function loadTripFile(rootHash: string, outputPath: string): Promise<{ success: boolean; source: string }> {
  if (zgStorage && storageMode === "0g") {
    try {
      await zgStorage.downloadFile(rootHash, outputPath);
      return { success: true, source: "0g" };
    } catch (err: any) {
      console.error(`[trip-memory] 0G file download failed: ${err.message}`);
      return { success: false, source: "error" };
    }
  }
  return { success: false, source: "0g-unavailable" };
}

// --- MCP Server ---
const server = new Server(
  { name: "trip-memory", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "save_trip_data",
      description:
        "Save structured trip data to 0G decentralized storage (with local fallback). Use for preferences, itinerary, spending state, conversation history.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
          key: {
            type: "string" as const,
            description: 'Data key (e.g., "preferences", "itinerary", "spending:latest")',
          },
          data: { type: "object" as const, description: "The data to save (any JSON object)" },
        },
        required: ["trip_id", "key", "data"],
      },
    },
    {
      name: "load_trip_data",
      description:
        "Load structured trip data from 0G decentralized storage (with local fallback). Retrieves persisted state that survives session restarts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
          key: { type: "string" as const, description: "Data key to load" },
        },
        required: ["trip_id", "key"],
      },
    },
    {
      name: "list_trip_keys",
      description: "List all saved data keys for a trip.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
        },
        required: ["trip_id"],
      },
    },
    {
      name: "save_trip_file",
      description:
        "Upload a file (photo, report, receipt) to 0G decentralized storage. Returns content-addressed root hash for permanent retrieval.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: { type: "number" as const, description: "The trip ID" },
          file_path: { type: "string" as const, description: "Absolute path to the file to upload" },
        },
        required: ["trip_id", "file_path"],
      },
    },
    {
      name: "load_trip_file",
      description: "Download a file from 0G decentralized storage by its root hash.",
      inputSchema: {
        type: "object" as const,
        properties: {
          root_hash: { type: "string" as const, description: "0G Storage root hash of the file" },
          output_path: { type: "string" as const, description: "Path to save the downloaded file" },
        },
        required: ["root_hash", "output_path"],
      },
    },
    {
      name: "storage_status",
      description: "Check whether 0G Storage is connected or using local fallback.",
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
    if (name === "save_trip_data") {
      const msg = await saveTripData(args!.trip_id as number, args!.key as string, args!.data);
      return { content: [{ type: "text", text: msg }] };
    }

    if (name === "load_trip_data") {
      const result = await loadTripData(args!.trip_id as number, args!.key as string);
      if (!result) {
        return {
          content: [{ type: "text", text: `No data found for key "${args!.key}" in trip ${args!.trip_id}` }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ ...result.data, _source: result.source }, null, 2) }],
      };
    }

    if (name === "list_trip_keys") {
      const keys = await listTripKeys(args!.trip_id as number);
      return { content: [{ type: "text", text: JSON.stringify(keys) }] };
    }

    if (name === "save_trip_file") {
      const result = await saveTripFile(args!.trip_id as number, args!.file_path as string);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === "load_trip_file") {
      const result = await loadTripFile(args!.root_hash as string, args!.output_path as string);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    if (name === "storage_status") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: storageMode,
                ogEnabled: OG_ENABLED,
                hasPrivateKey: !!OG_PRIVATE_KEY,
                rpcUrl: OG_RPC,
                indexerUrl: OG_INDEXER,
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

// Initialize 0G storage then start MCP server
await initStorage();
await server.connect(new StdioServerTransport());
