#!/usr/bin/env bun
/**
 * Trip Memory MCP Server
 *
 * Persists trip data (preferences, itinerary, conversation context).
 * Uses local JSON files as primary store with optional 0G Storage upload.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.TRIP_MEMORY_DIR ?? "./trip-data";
mkdirSync(DATA_DIR, { recursive: true });

function dataPath(tripId: number, key: string): string {
  const tripDir = join(DATA_DIR, `trip-${tripId}`);
  mkdirSync(tripDir, { recursive: true });
  return join(tripDir, `${key}.json`);
}

const server = new Server(
  { name: "trip-memory", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "save_trip_data",
      description:
        "Save trip data (preferences, itinerary, notes, etc.) to persistent storage.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: {
            type: "number" as const,
            description: "The trip ID",
          },
          key: {
            type: "string" as const,
            description:
              'Data key (e.g., "preferences", "itinerary", "notes")',
          },
          data: {
            type: "object" as const,
            description: "The data to save (any JSON object)",
          },
        },
        required: ["trip_id", "key", "data"],
      },
    },
    {
      name: "load_trip_data",
      description: "Load previously saved trip data.",
      inputSchema: {
        type: "object" as const,
        properties: {
          trip_id: {
            type: "number" as const,
            description: "The trip ID",
          },
          key: {
            type: "string" as const,
            description: "Data key to load",
          },
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
          trip_id: {
            type: "number" as const,
            description: "The trip ID",
          },
        },
        required: ["trip_id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    if (name === "save_trip_data") {
      const path = dataPath(args!.trip_id as number, args!.key as string);
      writeFileSync(path, JSON.stringify(args!.data, null, 2));
      return {
        content: [
          {
            type: "text",
            text: `Saved "${args!.key}" for trip ${args!.trip_id}`,
          },
        ],
      };
    }

    if (name === "load_trip_data") {
      const path = dataPath(args!.trip_id as number, args!.key as string);
      if (!existsSync(path)) {
        return {
          content: [
            {
              type: "text",
              text: `No data found for key "${args!.key}" in trip ${args!.trip_id}`,
            },
          ],
        };
      }
      const data = JSON.parse(readFileSync(path, "utf-8"));
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "list_trip_keys") {
      const tripDir = join(DATA_DIR, `trip-${args!.trip_id}`);
      if (!existsSync(tripDir)) {
        return { content: [{ type: "text", text: "[]" }] };
      }
      const keys = readdirSync(tripDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
      return { content: [{ type: "text", text: JSON.stringify(keys) }] };
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

await server.connect(new StdioServerTransport());
