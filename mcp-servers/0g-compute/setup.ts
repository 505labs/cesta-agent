#!/usr/bin/env bun
/**
 * 0G Compute Setup Script
 *
 * Run once to:
 *   1. Create a ledger (deposit 0G tokens)
 *   2. List available providers
 *   3. Transfer funds to chosen provider sub-account
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... bun setup.ts
 *   AGENT_PRIVATE_KEY=0x... bun setup.ts --test   # also runs a test inference
 */

import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const runTest = process.argv.includes("--test");

if (!PRIVATE_KEY) {
  console.error("ERROR: Set AGENT_PRIVATE_KEY environment variable");
  process.exit(1);
}

async function main() {
  console.log("=== 0G Compute Setup ===\n");

  // Connect wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G\n`);

  if (balance === 0n) {
    console.error("ERROR: Wallet has no 0G tokens. Fund via https://faucet.0g.ai");
    process.exit(1);
  }

  // Create broker
  console.log("Creating broker...");
  const broker = await createZGComputeNetworkBroker(wallet);
  console.log("Broker created.\n");

  // Step 1: List available services
  console.log("=== Available Providers ===");
  const services = await broker.inference.listService();

  if (services.length === 0) {
    console.error("No providers available on the network.");
    process.exit(1);
  }

  const chatbots = services.filter(
    (s: any) => !s.model?.includes("image")
  );

  for (const s of services) {
    console.log(`  Provider: ${s.provider}`);
    console.log(`  Model:    ${s.model}`);
    console.log(`  URL:      ${s.url}`);
    console.log(`  Type:     ${s.verifiability}`);
    console.log(`  Price:    ${s.inputPrice?.toString()} in / ${s.outputPrice?.toString()} out`);
    console.log("");
  }

  if (chatbots.length === 0) {
    console.error("No chatbot providers found — only image models available.");
    process.exit(1);
  }

  const chosen = chatbots[0];
  console.log(`Chosen provider: ${chosen.provider} (${chosen.model})\n`);

  // Step 2: Create ledger (or deposit if it already exists)
  console.log("=== Setting Up Ledger ===");
  try {
    // First try addLedger (creates new account with initial deposit)
    console.log("Creating ledger with 3 0G initial deposit...");
    await broker.ledger.addLedger(3);
    console.log("Ledger created and funded.\n");
  } catch (err: any) {
    if (err.message?.includes("already") || err.message?.includes("exists")) {
      console.log("Ledger already exists. Depositing additional funds...");
      try {
        await broker.ledger.depositFund(1);
        console.log("Deposited 1 0G.\n");
      } catch (e: any) {
        console.log(`Deposit note: ${e.message}\n`);
      }
    } else {
      console.log(`Ledger setup note: ${err.message}`);
      console.log("You need at least 3 0G tokens. Fund via https://faucet.0g.ai\n");
    }
  }

  // Step 3: Transfer to provider sub-account
  console.log("=== Funding Provider Sub-Account ===");
  try {
    const oneOG = BigInt(1) * BigInt(10 ** 18);
    console.log(`Transferring 1 0G to provider ${chosen.provider}...`);
    await broker.ledger.transferFund(chosen.provider, "inference", oneOG);
    console.log("Provider sub-account funded.\n");
  } catch (err: any) {
    console.log(`Transfer note: ${err.message}\n`);
  }

  // Step 4 (optional): Test inference
  if (runTest) {
    console.log("=== Test Inference ===");
    try {
      const { endpoint, model } = await broker.inference.getServiceMetadata(chosen.provider);
      const headers = await broker.inference.getRequestHeaders(chosen.provider);

      console.log(`Endpoint: ${endpoint}`);
      console.log(`Model: ${model}`);
      console.log("Sending test prompt...\n");

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a trip spending advisor. Be concise." },
            {
              role: "user",
              content:
                "Compare these two gas stations: Station A at $3.20/gallon (0.5 miles off route) vs Station B at $2.89/gallon (2 miles off route). Which should we stop at for a road trip group with a moderate budget?",
            },
          ],
          max_tokens: 256,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Inference failed (${response.status}): ${errText}`);
      } else {
        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content ?? "No response";
        console.log(`Response: ${answer}\n`);

        // Verify
        const chatID = response.headers.get("ZG-Res-Key") || data.id;
        if (chatID) {
          try {
            const isValid = await broker.inference.processResponse(chosen.provider, chatID);
            console.log(`TEE Verified: ${isValid}`);
            console.log(`Chat ID: ${chatID}`);
          } catch (err: any) {
            console.log(`Verification: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`Test inference failed: ${err.message}`);
    }
  }

  console.log("\n=== Setup Complete ===");
  console.log("The 0g-compute MCP server should now work with:");
  console.log(`  AGENT_PRIVATE_KEY=${PRIVATE_KEY?.slice(0, 10)}...`);
  console.log(`  OG_RPC_URL=${RPC_URL}`);
  console.log(`  OG_COMPUTE_ENABLED=true`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
