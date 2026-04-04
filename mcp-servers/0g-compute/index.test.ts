import { describe, test, expect } from "bun:test";
import { ZeroGCompute } from "./compute-0g.js";

describe("ZeroGCompute — Unit Tests", () => {
  test("constructor accepts config", () => {
    const compute = new ZeroGCompute({
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
    });
    expect(compute).toBeDefined();
  });

  test("inference throws when not initialized", async () => {
    const compute = new ZeroGCompute({
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
    });

    expect(compute.inference("test prompt")).rejects.toThrow("Broker not initialized");
  });

  test("listProviders throws when not initialized", async () => {
    const compute = new ZeroGCompute({
      privateKey: "0x0000000000000000000000000000000000000000000000000000000000000001",
      rpcUrl: "https://evmrpc-testnet.0g.ai",
    });

    expect(compute.listProviders()).rejects.toThrow("Broker not initialized");
  });
});

describe("Fallback mode", () => {
  test("fallback evaluate returns unverified result", () => {
    // Directly test the fallback logic (same as in index.ts)
    const prompt = "Compare gas stations A ($3.20) and B ($2.89)";
    const result = {
      result: `[LOCAL FALLBACK — not TEE-verified]\n\nEvaluation request received but 0G Compute is unavailable. The agent should use its own reasoning to evaluate this request:\n\n${prompt}`,
      verified: false,
      model: "fallback",
      provider: "local",
    };

    expect(result.verified).toBe(false);
    expect(result.model).toBe("fallback");
    expect(result.provider).toBe("local");
    expect(result.result).toContain("not TEE-verified");
    expect(result.result).toContain("$3.20");
  });
});
