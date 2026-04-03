"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { sepolia, baseSepolia } from "viem/chains";
import { anvilLocal } from "@/lib/wagmi";
import { useState } from "react";
import { useDeposit } from "@/lib/treasury";

const CHAINS = [
  { chain: anvilLocal, name: "Anvil Local", color: "var(--accent-blue)" },
  { chain: sepolia, name: "Sepolia", color: "var(--accent-purple)" },
  { chain: baseSepolia, name: "Base Sepolia", color: "var(--accent-green)" },
];

interface MultiChainDepositProps {
  tripId: bigint;
}

export default function MultiChainDeposit({ tripId }: MultiChainDepositProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { approveUsdc, deposit, isPending } = useDeposit();
  const [depositAmount, setDepositAmount] = useState("");
  const [status, setStatus] = useState<
    "idle" | "switching" | "approving" | "depositing" | "done"
  >("idle");

  const handleDeposit = async (targetChainId: number) => {
    if (!depositAmount || Number(depositAmount) <= 0) return;

    try {
      if (chainId !== targetChainId) {
        setStatus("switching");
        await switchChain({ chainId: targetChainId });
      }

      setStatus("approving");
      await approveUsdc(depositAmount);

      setStatus("depositing");
      await deposit(tripId, depositAmount);

      setStatus("done");
      setDepositAmount("");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error("Multi-chain deposit failed:", err);
      setStatus("idle");
    }
  };

  return (
    <div className="glass-card p-4">
      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
        Deposit from Any Chain
      </h4>

      <input
        type="number"
        value={depositAmount}
        onChange={(e) => setDepositAmount(e.target.value)}
        placeholder="Amount (USDC)"
        min="0"
        step="0.01"
        className="w-full mb-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
      />

      <div className="space-y-2">
        {CHAINS.map(({ chain, name, color }) => (
          <button
            key={chain.id}
            onClick={() => handleDeposit(chain.id)}
            disabled={isPending || status !== "idle" || !depositAmount}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium">{name}</span>
              {chainId === chain.id && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-green)]/10 text-[var(--accent-green)]">
                  connected
                </span>
              )}
            </div>
            <span className="text-sm text-[var(--text-secondary)]">
              Deposit
            </span>
          </button>
        ))}

        {/* Solana indicator */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] opacity-60">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: "var(--accent-amber)" }}
            />
            <span className="text-sm font-medium">Solana</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            Bridge coming soon
          </span>
        </div>
      </div>

      {status !== "idle" && status !== "done" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--accent-blue)]">
          <span className="w-4 h-4 border-2 border-[var(--accent-blue)]/30 border-t-[var(--accent-blue)] rounded-full animate-spin" />
          {status === "switching" && "Switching chain..."}
          {status === "approving" && "Approving USDC..."}
          {status === "depositing" && "Depositing..."}
        </div>
      )}
      {status === "done" && (
        <div className="mt-3 text-sm text-[var(--accent-green)]">
          Deposit successful!
        </div>
      )}
    </div>
  );
}
