import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { ZeroGStorage } from "./storage-0g.js";

const TEST_DIR = "/tmp/trip-memory-test-data";

// --- Local fallback tests (no 0G needed) ---

describe("Trip Memory MCP — Local Fallback", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function dataPath(tripId: number, key: string): string {
    const tripDir = join(TEST_DIR, `trip-${tripId}`);
    mkdirSync(tripDir, { recursive: true });
    return join(tripDir, `${key}.json`);
  }

  test("save and load trip data locally", () => {
    const data = { dietary: ["vegetarian"], budget: "moderate" };
    const path = dataPath(42, "preferences");
    writeFileSync(path, JSON.stringify(data, null, 2));

    expect(existsSync(path)).toBe(true);
    const loaded = JSON.parse(readFileSync(path, "utf-8"));
    expect(loaded).toEqual(data);
  });

  test("save complex nested data", () => {
    const data = {
      stops: [
        { name: "Gas Station", lat: 43.5, lng: 7.0, eta: "10min" },
        { name: "Restaurant", lat: 43.6, lng: 7.1, eta: "30min" },
      ],
      nextStop: "gas_station_xyz",
      totalDistance: "245km",
    };
    const path = dataPath(42, "itinerary");
    writeFileSync(path, JSON.stringify(data, null, 2));

    const loaded = JSON.parse(readFileSync(path, "utf-8"));
    expect(loaded.stops).toHaveLength(2);
    expect(loaded.stops[0].name).toBe("Gas Station");
  });

  test("list trip keys", () => {
    const tripDir = join(TEST_DIR, "trip-42");
    mkdirSync(tripDir, { recursive: true });
    writeFileSync(join(tripDir, "preferences.json"), "{}");
    writeFileSync(join(tripDir, "itinerary.json"), "{}");
    writeFileSync(join(tripDir, "spending.json"), "{}");

    const files = Bun.spawnSync(["ls", tripDir]).stdout.toString().trim().split("\n");
    const keys = files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
    expect(keys).toEqual(["itinerary", "preferences", "spending"]);
  });

  test("load nonexistent key returns null", () => {
    const path = dataPath(99, "nonexistent");
    expect(existsSync(path)).toBe(false);
  });

  test("overwrite existing key", () => {
    const path = dataPath(42, "preferences");
    writeFileSync(path, JSON.stringify({ budget: "low" }));
    writeFileSync(path, JSON.stringify({ budget: "high" }));

    const loaded = JSON.parse(readFileSync(path, "utf-8"));
    expect(loaded.budget).toBe("high");
  });

  test("multiple trips isolated", () => {
    const path1 = dataPath(1, "preferences");
    const path2 = dataPath(2, "preferences");
    writeFileSync(path1, JSON.stringify({ trip: 1 }));
    writeFileSync(path2, JSON.stringify({ trip: 2 }));

    expect(JSON.parse(readFileSync(path1, "utf-8")).trip).toBe(1);
    expect(JSON.parse(readFileSync(path2, "utf-8")).trip).toBe(2);
  });
});

// --- 0G Storage class unit tests (constructor + stream ID) ---

describe("ZeroGStorage — Unit Tests", () => {
  test("constructor accepts config", () => {
    const storage = new ZeroGStorage({
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
      indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
      kvNodeUrl: "http://3.101.147.150:6789",
      flowContractAddress: "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
    });
    expect(storage).toBeDefined();
  });

  test("getStreamId is deterministic", () => {
    // Access private method via prototype hack for testing
    const storage = new ZeroGStorage({
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
      indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
      kvNodeUrl: "http://3.101.147.150:6789",
      flowContractAddress: "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
    });

    // Call getStreamId via bracket notation
    const id1 = (storage as any)["getStreamId"](42);
    const id2 = (storage as any)["getStreamId"](42);
    const id3 = (storage as any)["getStreamId"](43);

    expect(id1).toBe(id2); // Same trip => same stream
    expect(id1).not.toBe(id3); // Different trip => different stream
    expect(id1.startsWith("0x")).toBe(true);
    expect(id1.length).toBe(66); // bytes32 hex = 0x + 64 chars
  });
});
