/**
 * 0G Storage wrapper — handles KV store and file operations on the 0G network.
 *
 * Uses @0glabs/0g-ts-sdk with ethers v6.
 */

import { Indexer, ZgFile, MemData, KvClient, Batcher, getFlowContract } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";

export interface ZeroGConfig {
  privateKey: string;
  rpcUrl: string;
  indexerUrl: string;
  kvNodeUrl: string;
  flowContractAddress: string;
}

export class ZeroGStorage {
  private config: ZeroGConfig;
  private signer: ethers.Wallet | null = null;
  private indexer: Indexer | null = null;
  private kvClient: KvClient | null = null;
  private initialized = false;

  constructor(config: ZeroGConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.signer = new ethers.Wallet(this.config.privateKey, provider);
    this.indexer = new Indexer(this.config.indexerUrl);
    this.kvClient = new KvClient(this.config.kvNodeUrl);

    // Verify connectivity by checking signer balance
    const balance = await provider.getBalance(this.signer.address);
    console.error(`[0g-storage] Agent wallet ${this.signer.address} balance: ${ethers.formatEther(balance)} 0G`);

    if (balance === 0n) {
      console.error("[0g-storage] WARNING: Zero balance — KV writes will fail. Fund via https://faucet.0g.ai");
    }

    this.initialized = true;
  }

  /**
   * Generate a deterministic stream ID for a trip.
   * Stream IDs are bytes32 hex strings used as KV namespaces.
   */
  private getStreamId(tripId: number): string {
    return ethers.keccak256(ethers.toUtf8Bytes(`roadtrip-copilot:trip:${tripId}`));
  }

  /**
   * Write a key-value pair to 0G KV store.
   * Requires on-chain transaction (costs gas).
   */
  async kvSet(tripId: number, key: string, value: any): Promise<{ txHash?: string }> {
    if (!this.initialized || !this.signer || !this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    const streamId = this.getStreamId(tripId);
    const keyBytes = new TextEncoder().encode(key);
    const valueBytes = new TextEncoder().encode(JSON.stringify(value));

    // Select storage nodes
    const [nodes, nodesErr] = await this.indexer.selectNodes(1);
    if (nodesErr || !nodes || nodes.length === 0) {
      throw new Error(`Failed to select storage nodes: ${nodesErr?.message ?? "no nodes available"}`);
    }

    // Get flow contract
    const flowContract = getFlowContract(this.config.flowContractAddress, this.signer);

    // Create batcher and set KV pair
    const batcher = new Batcher(1, nodes, flowContract, this.config.rpcUrl);
    batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);

    // Send on-chain tx + upload to storage nodes
    const [tx, batchErr] = await batcher.exec();
    if (batchErr) {
      throw new Error(`KV write failed: ${batchErr.message}`);
    }

    return { txHash: tx?.txHash };
  }

  /**
   * Read a key-value pair from 0G KV store (read-only, no gas).
   */
  async kvGet(tripId: number, key: string): Promise<any | null> {
    if (!this.kvClient) {
      throw new Error("0G Storage not initialized");
    }

    const streamId = this.getStreamId(tripId);
    const keyBytes = new TextEncoder().encode(key);

    try {
      const value = await this.kvClient.getValue(streamId, keyBytes);
      if (!value || !value.data) return null;

      const decoded = Buffer.from(value.data, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch (err: any) {
      // Key not found is not an error
      if (err.message?.includes("not found") || err.message?.includes("null")) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Upload a file to 0G decentralized storage.
   * Returns content-addressed root hash for permanent retrieval.
   */
  async uploadFile(filePath: string): Promise<{ rootHash: string; txHash: string }> {
    if (!this.initialized || !this.signer || !this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    const file = await ZgFile.fromFilePath(filePath);

    try {
      const [tx, err] = await this.indexer.upload(file, this.config.rpcUrl, this.signer);
      if (err) {
        throw new Error(`File upload failed: ${err.message}`);
      }

      // Handle both single and fragmented upload results
      const result = tx as any;
      return {
        rootHash: result.rootHash ?? result.rootHashes?.[0] ?? "",
        txHash: result.txHash ?? result.txHashes?.[0] ?? "",
      };
    } finally {
      await file.close();
    }
  }

  /**
   * Upload in-memory data as a file to 0G Storage.
   */
  async uploadData(data: Uint8Array): Promise<{ rootHash: string; txHash: string }> {
    if (!this.initialized || !this.signer || !this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    const memData = new MemData(data);
    const [tx, err] = await this.indexer.upload(memData, this.config.rpcUrl, this.signer);
    if (err) {
      throw new Error(`Data upload failed: ${err.message}`);
    }

    const result = tx as any;
    return {
      rootHash: result.rootHash ?? result.rootHashes?.[0] ?? "",
      txHash: result.txHash ?? result.txHashes?.[0] ?? "",
    };
  }

  /**
   * Download a file from 0G Storage by root hash.
   */
  async downloadFile(rootHash: string, outputPath: string): Promise<void> {
    if (!this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    const err = await this.indexer.download(rootHash, outputPath, false);
    if (err) {
      throw new Error(`File download failed: ${err.message}`);
    }
  }
}
