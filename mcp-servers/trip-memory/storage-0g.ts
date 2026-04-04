/**
 * 0G Storage wrapper — handles data and file operations on the 0G network.
 *
 * Uses 0G file storage (MemData uploads) for all data persistence.
 * Each piece of trip data is uploaded as a content-addressed file,
 * producing a Merkle root hash for permanent retrieval.
 *
 * A local index maps (tripId, key) -> rootHash so data can be looked up.
 */

import { Indexer, ZgFile, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface ZeroGConfig {
  privateKey: string;
  rpcUrl: string;
  indexerUrl: string;
  kvNodeUrl: string;         // kept for config compat, not used
  flowContractAddress: string; // kept for config compat, not used
  indexDir?: string;          // where to store the rootHash index locally
}

export class ZeroGStorage {
  private config: ZeroGConfig;
  private signer: ethers.Wallet | null = null;
  private indexer: Indexer | null = null;
  private initialized = false;
  private indexDir: string;
  // In-memory index: "tripId:key" -> rootHash
  private hashIndex: Map<string, string> = new Map();

  constructor(config: ZeroGConfig) {
    this.config = config;
    this.indexDir = config.indexDir ?? "./trip-data/.0g-index";
  }

  async initialize(): Promise<void> {
    const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.signer = new ethers.Wallet(this.config.privateKey, provider);
    this.indexer = new Indexer(this.config.indexerUrl);

    // Verify connectivity
    const balance = await provider.getBalance(this.signer.address);
    console.error(`[0g-storage] Agent wallet ${this.signer.address} balance: ${ethers.formatEther(balance)} 0G`);

    if (balance === 0n) {
      console.error("[0g-storage] WARNING: Zero balance — uploads will fail. Fund via https://faucet.0g.ai");
    }

    // Load the local hash index
    this.loadIndex();

    this.initialized = true;
  }

  private indexPath(): string {
    mkdirSync(this.indexDir, { recursive: true });
    return join(this.indexDir, "hash-index.json");
  }

  private loadIndex(): void {
    const path = this.indexPath();
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf-8"));
        this.hashIndex = new Map(Object.entries(raw));
      } catch {
        this.hashIndex = new Map();
      }
    }
  }

  private saveIndex(): void {
    const path = this.indexPath();
    const obj: Record<string, string> = {};
    for (const [k, v] of this.hashIndex) obj[k] = v;
    writeFileSync(path, JSON.stringify(obj, null, 2));
  }

  private indexKey(tripId: number, key: string): string {
    return `${tripId}:${key}`;
  }

  /**
   * Store structured data to 0G Storage as a content-addressed file.
   * Returns the Merkle root hash for permanent retrieval.
   */
  async kvSet(tripId: number, key: string, value: any): Promise<{ rootHash: string; txHash: string }> {
    if (!this.initialized || !this.signer || !this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    // Serialize data with metadata envelope
    const envelope = {
      _tripId: tripId,
      _key: key,
      _timestamp: Date.now(),
      data: value,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(envelope, null, 2));

    // Upload as in-memory file to 0G Storage
    const memData = new MemData(bytes);
    const [tx, err] = await this.indexer!.upload(memData, this.config.rpcUrl, this.signer!);
    if (err) {
      throw new Error(`0G upload failed: ${err.message}`);
    }

    const result = tx as any;
    const rootHash = result.rootHash ?? result.rootHashes?.[0] ?? "";
    const txHash = result.txHash ?? result.txHashes?.[0] ?? "";

    // Update local index
    this.hashIndex.set(this.indexKey(tripId, key), rootHash);
    this.saveIndex();

    return { rootHash, txHash };
  }

  /**
   * Load structured data from 0G Storage by looking up the root hash in the index,
   * then downloading the content-addressed file.
   */
  async kvGet(tripId: number, key: string): Promise<any | null> {
    if (!this.indexer) {
      throw new Error("0G Storage not initialized");
    }

    const rootHash = this.hashIndex.get(this.indexKey(tripId, key));
    if (!rootHash) return null;

    // Download to a temp file
    const tmpPath = `/tmp/0g-trip-${tripId}-${key}-${Date.now()}.json`;
    try {
      const err = await this.indexer.download(rootHash, tmpPath, false);
      if (err) {
        throw new Error(`Download failed: ${err.message}`);
      }
      const raw = JSON.parse(readFileSync(tmpPath, "utf-8"));
      return raw.data ?? raw;
    } catch (e: any) {
      console.error(`[0g-storage] kvGet download failed: ${e.message}`);
      return null;
    } finally {
      // Clean up temp file
      try { require("fs").unlinkSync(tmpPath); } catch {}
    }
  }

  /**
   * Upload a file to 0G decentralized storage.
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

  /**
   * Get the root hash for a given trip data key (for verification/explorer links).
   */
  getRootHash(tripId: number, key: string): string | undefined {
    return this.hashIndex.get(this.indexKey(tripId, key));
  }
}
