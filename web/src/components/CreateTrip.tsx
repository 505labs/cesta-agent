"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useCreateTripOnChain } from "@/lib/treasury";

export default function CreateTrip() {
  const router = useRouter();
  const { address } = useAccount();
  const { createTrip, isPending } = useCreateTripOnChain();

  const [name, setName] = useState("");
  const [spendLimit, setSpendLimit] = useState("50");
  const [agentAddress, setAgentAddress] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !agentAddress) return;

    setIsCreating(true);
    try {
      // Create trip on-chain
      await createTrip(agentAddress as `0x${string}`, spendLimit);

      // Navigate to trip page (using trip ID 0 as placeholder — in production,
      // you'd parse the TripCreated event log for the actual ID)
      router.push(`/trip/0`);
    } catch (err) {
      console.error("Failed to create trip:", err);
    } finally {
      setIsCreating(false);
    }
  };

  if (!showForm) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowForm(true)}
          className="w-full glass-card p-6 text-left hover:border-[var(--accent-blue)]/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center text-2xl group-hover:bg-[var(--accent-blue)]/20 transition-colors">
              +
            </div>
            <div>
              <h3 className="font-semibold text-lg">Create New Trip</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Set up a group treasury and hit the road
              </p>
            </div>
          </div>
        </button>

        {/* Demo trip card */}
        <button
          onClick={() => router.push("/trip/0")}
          className="w-full glass-card p-6 text-left hover:border-[var(--accent-green)]/40 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-green)]/10 text-[var(--accent-green)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.2-3.3C13 5.6 12 5 11 5H5c-1 0-2 .5-2.8 1.2L0 8" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Demo Trip</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Preview the trip dashboard with mock data
                </p>
              </div>
            </div>
            <div className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 max-w-lg">
      <h3 className="text-xl font-semibold mb-6">Create New Trip</h3>

      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Trip Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cannes Road Trip 2026"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Agent Wallet Address
          </label>
          <input
            type="text"
            value={agentAddress}
            onChange={(e) => setAgentAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors font-mono text-sm"
            required
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            The AI agent wallet that can spend from the treasury
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Per-Transaction Spend Limit (USDC)
          </label>
          <input
            type="number"
            value={spendLimit}
            onChange={(e) => setSpendLimit(e.target.value)}
            placeholder="50"
            min="1"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            required
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-5 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || isCreating}
            className="flex-1 px-5 py-3 rounded-xl bg-[var(--accent-blue)] text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending || isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Trip"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
