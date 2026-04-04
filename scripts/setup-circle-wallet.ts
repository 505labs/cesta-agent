#!/usr/bin/env bun
/**
 * Circle Programmable Wallets Setup Script
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  initiateDeveloperControlledWalletsClient,
  registerEntitySecretCiphertext,
} from "@circle-fin/developer-controlled-wallets";

const ENV_PATH = path.join(import.meta.dir, "../.env");

function readEnv(): Record<string, string> {
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  }
  return env;
}

function writeEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");
}

function fixApiKey(key: string): string {
  return key.replace(/^TEST_API_KEY=/, "TEST_API_KEY:");
}

async function main() {
  console.log("=== Circle Programmable Wallets Setup ===\n");

  const env = readEnv();
  const apiKey = fixApiKey(env.CIRCLE_API_KEY || "");
  if (!apiKey) {
    console.error("ERROR: CIRCLE_API_KEY not found in .env");
    process.exit(1);
  }
  console.log("API Key: " + apiKey.slice(0, 20) + "...");

  // Generate or reuse entity secret
  let entitySecret = env.CIRCLE_ENTITY_SECRET;
  let needsRegistration = false;
  if (entitySecret) {
    console.log("Reusing existing entity secret");
  } else {
    entitySecret = crypto.randomBytes(32).toString("hex");
    needsRegistration = true;
    console.log("Generated new entity secret: " + entitySecret.slice(0, 16) + "...");
  }

  // Register entity secret if new
  if (needsRegistration) {
    console.log("\nRegistering entity secret with Circle...");
    const recoveryDir = path.join(import.meta.dir, "../.circle-recovery");
    if (!fs.existsSync(recoveryDir)) fs.mkdirSync(recoveryDir, { recursive: true });

    try {
      await registerEntitySecretCiphertext({
        apiKey,
        entitySecret,
        recoveryFileDownloadPath: recoveryDir,
      });
      console.log("Entity secret registered!");
    } catch (err: any) {
      console.log("Registration result:", err.message || err);
      // May already be registered
    }
  }

  // Initialize SDK client
  console.log("\nInitializing Circle SDK...");
  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // Create wallet set
  let walletSetId = env.CIRCLE_WALLET_SET_ID;
  if (walletSetId) {
    console.log("Reusing wallet set: " + walletSetId);
  } else {
    console.log("Creating wallet set...");
    try {
      const wsResp = await client.createWalletSet({
        name: "RoadTrip Co-Pilot Agent",
      });
      walletSetId = wsResp.data?.walletSet?.id;
      console.log("Created wallet set: " + walletSetId);
    } catch (err: any) {
      console.error("Failed:", err.message || err);
      env.CIRCLE_API_KEY = apiKey;
      env.CIRCLE_ENTITY_SECRET = entitySecret;
      writeEnv(env);
      process.exit(1);
    }
  }

  // Create agent wallet
  let agentWalletId = env.CIRCLE_AGENT_WALLET_ID;
  let agentWalletAddress = env.CIRCLE_AGENT_WALLET_ADDRESS;

  if (agentWalletId && agentWalletAddress) {
    console.log("Reusing agent wallet: " + agentWalletAddress);
  } else if (walletSetId) {
    console.log("Creating agent wallet...");
    for (const blockchain of ["ARC-TESTNET", "ETH-SEPOLIA"]) {
      try {
        console.log(`  Trying ${blockchain}...`);
        const wResp = await client.createWallets({
          walletSetId,
          blockchains: [blockchain],
          count: 1,
          accountType: "EOA",
        });
        const wallet = wResp.data?.wallets?.[0];
        if (wallet) {
          agentWalletId = wallet.id;
          agentWalletAddress = wallet.address;
          console.log(`  Created on ${blockchain}: ${agentWalletAddress}`);
          break;
        }
      } catch (err: any) {
        console.log(`  ${blockchain}: ${err.message || "failed"}`);
      }
    }
  }

  // Save
  env.CIRCLE_API_KEY = apiKey;
  env.CIRCLE_ENTITY_SECRET = entitySecret;
  if (walletSetId) env.CIRCLE_WALLET_SET_ID = walletSetId;
  if (agentWalletId) env.CIRCLE_AGENT_WALLET_ID = agentWalletId;
  if (agentWalletAddress) env.CIRCLE_AGENT_WALLET_ADDRESS = agentWalletAddress;
  writeEnv(env);

  console.log("\n=== Done ===");
  console.log("Wallet Set: " + (walletSetId || "N/A"));
  console.log("Agent Wallet: " + (agentWalletAddress || "N/A"));
}

main().catch(console.error);
