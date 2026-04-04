"use client";

import { useState, useEffect } from "react";

interface StorageStatus {
  mode: "0g" | "local";
  ogEnabled: boolean;
  hasPrivateKey: boolean;
  rpcUrl: string;
  indexerUrl: string;
}

interface ComputeStatus {
  mode: "0g" | "fallback";
  enabled: boolean;
  hasPrivateKey: boolean;
  rpcUrl: string;
}

export default function ZeroGStatus() {
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [computeStatus, setComputeStatus] = useState<ComputeStatus | null>(null);

  const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8080";

  useEffect(() => {
    // In production, these would come from the orchestrator or MCP servers
    // For now, show static status based on env vars
    setStorageStatus({
      mode: process.env.NEXT_PUBLIC_OG_STORAGE_MODE === "0g" ? "0g" : "local",
      ogEnabled: process.env.NEXT_PUBLIC_OG_STORAGE_MODE !== "disabled",
      hasPrivateKey: !!process.env.NEXT_PUBLIC_OG_HAS_KEY,
      rpcUrl: "https://evmrpc-testnet.0g.ai",
      indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    });
    setComputeStatus({
      mode: process.env.NEXT_PUBLIC_OG_COMPUTE_MODE === "0g" ? "0g" : "fallback",
      enabled: process.env.NEXT_PUBLIC_OG_COMPUTE_MODE !== "disabled",
      hasPrivateKey: !!process.env.NEXT_PUBLIC_OG_HAS_KEY,
      rpcUrl: "https://evmrpc-testnet.0g.ai",
    });
  }, []);

  return (
    <div className="glass-card p-4 space-y-3">
      <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
          <polyline points="7.5 19.79 7.5 14.6 3 12" />
          <polyline points="21 12 16.5 14.6 16.5 19.79" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        0G Infrastructure
      </h4>

      <div className="space-y-2">
        {/* Storage Status */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={storageStatus?.mode === "0g"} />
            <span className="text-sm">Storage</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {storageStatus?.mode === "0g" ? "0G Network" : "Local Fallback"}
          </span>
        </div>

        {/* Compute Status */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={computeStatus?.mode === "0g"} />
            <span className="text-sm">Compute (TEE)</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {computeStatus?.mode === "0g" ? "Sealed Inference" : "Fallback"}
          </span>
        </div>

        {/* Chain Status */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <StatusDot active={true} />
            <span className="text-sm">Chain</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            Galileo Testnet
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div className="relative">
      <div
        className={`w-2 h-2 rounded-full ${
          active ? "bg-[var(--accent-green)]" : "bg-[var(--text-secondary)]"
        }`}
      />
      {active && (
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-[var(--accent-green)] animate-ping opacity-75" />
      )}
    </div>
  );
}
