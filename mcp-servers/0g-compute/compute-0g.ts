/**
 * 0G Compute wrapper — TEE-verified AI inference via 0G Compute Network.
 *
 * Uses @0glabs/0g-serving-broker with ethers v6.
 */

import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

export interface ZeroGComputeConfig {
  privateKey: string;
  rpcUrl: string;
}

export interface VerifiedResult {
  result: string;
  verified: boolean;
  model: string;
  provider: string;
  chatId?: string;
}

export interface ProviderInfo {
  address: string;
  model: string;
  url: string;
  verifiability: string;
  inputPrice: string;
  outputPrice: string;
}

export class ZeroGCompute {
  private config: ZeroGComputeConfig;
  private broker: any = null;
  private initialized = false;

  constructor(config: ZeroGComputeConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    const wallet = new ethers.Wallet(this.config.privateKey, provider);

    this.broker = await createZGComputeNetworkBroker(wallet);
    this.initialized = true;
    console.error("[0g-compute] Broker created successfully");
  }

  /**
   * List available inference providers on the 0G Compute Network.
   */
  async listProviders(): Promise<ProviderInfo[]> {
    if (!this.broker) throw new Error("Broker not initialized");

    const services = await this.broker.inference.listService();
    return services.map((s: any) => ({
      address: s.provider,
      model: s.model,
      url: s.url,
      verifiability: s.verifiability,
      inputPrice: s.inputPrice?.toString() ?? "0",
      outputPrice: s.outputPrice?.toString() ?? "0",
    }));
  }

  /**
   * Find the best available chatbot provider.
   * Prefers TEE-verified models.
   */
  private async findProvider(): Promise<{ address: string; endpoint: string; model: string } | null> {
    const services = await this.broker.inference.listService();

    // Filter for chatbot services (not image generation)
    const chatServices = services.filter(
      (s: any) => !s.model?.includes("image") && s.verifiability === "TeeML"
    );

    if (chatServices.length === 0) {
      // Try any service
      const anyChatService = services.find((s: any) => !s.model?.includes("image"));
      if (!anyChatService) return null;
      return {
        address: anyChatService.provider,
        endpoint: anyChatService.url,
        model: anyChatService.model,
      };
    }

    const chosen = chatServices[0];
    return {
      address: chosen.provider,
      endpoint: chosen.url,
      model: chosen.model,
    };
  }

  /**
   * Run inference through 0G Compute with TEE verification.
   */
  async inference(prompt: string, systemPrompt?: string): Promise<VerifiedResult> {
    if (!this.broker) throw new Error("Broker not initialized");

    // Find a provider
    const provider = await this.findProvider();
    if (!provider) {
      throw new Error("No inference providers available on 0G Compute");
    }

    // Get service metadata and auth headers
    const { endpoint, model } = await this.broker.inference.getServiceMetadata(provider.address);
    const headers = await this.broker.inference.getRequestHeaders(provider.address);

    // Make the inference call
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt
            ? [{ role: "system", content: systemPrompt }]
            : []),
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inference request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Verify the response was produced inside TEE
    const chatID = response.headers.get("ZG-Res-Key") || data.id;
    let verified = false;

    if (chatID) {
      try {
        const usageContent = data.usage ? JSON.stringify(data.usage) : undefined;
        const isValid = await this.broker.inference.processResponse(
          provider.address,
          chatID,
          usageContent
        );
        verified = !!isValid;
      } catch (err: any) {
        console.error(`[0g-compute] Verification failed: ${err.message}`);
      }
    }

    const resultText =
      data.choices?.[0]?.message?.content ?? JSON.stringify(data);

    return {
      result: resultText,
      verified,
      model: model || "unknown",
      provider: provider.address,
      chatId: chatID ?? undefined,
    };
  }
}
