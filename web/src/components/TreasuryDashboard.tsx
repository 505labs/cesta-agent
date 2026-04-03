// @ts-nocheck
"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  useTripData,
  useTripBalance,
  useTripMembers,
  useMemberDeposit,
  useUsdcBalance,
  useDeposit,
} from "@/lib/treasury";

interface TreasuryDashboardProps {
  tripId: bigint;
}

export default function TreasuryDashboard({ tripId }: TreasuryDashboardProps) {
  const { address } = useAccount();
  const { data: trip } = useTripData(tripId);
  const { data: balance } = useTripBalance(tripId);
  const { data: members } = useTripMembers(tripId);
  const { data: myDeposit } = useMemberDeposit(
    tripId,
    address || "0x0000000000000000000000000000000000000000"
  );
  const { data: usdcBalance } = useUsdcBalance(address);
  const { approveUsdc, deposit, isPending } = useDeposit();

  const [depositAmount, setDepositAmount] = useState("");
  const [depositStep, setDepositStep] = useState<
    "idle" | "approving" | "depositing" | "done"
  >("idle");

  // Format values for display
  const tripData = trip as any;
  const totalDeposited = tripData
    ? formatUnits(tripData.totalDeposited || BigInt(0), 6)
    : "0";
  const totalSpent = tripData
    ? formatUnits(tripData.totalSpent || BigInt(0), 6)
    : "0";
  const poolBalance = balance
    ? formatUnits(balance as bigint, 6)
    : "0";
  const memberCount = tripData ? Number(tripData.memberCount || 0) : 0;
  const spendLimitFormatted = tripData
    ? formatUnits(tripData.spendLimit || BigInt(0), 6)
    : "0";
  const myDepositFormatted = myDeposit
    ? formatUnits(myDeposit as bigint, 6)
    : "0";
  const walletBalance = usdcBalance
    ? formatUnits(usdcBalance as bigint, 6)
    : "0";

  const spentPct =
    Number(totalDeposited) > 0
      ? (Number(totalSpent) / Number(totalDeposited)) * 100
      : 0;

  const isActive = tripData ? Number(tripData.status) === 0 : true;

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    try {
      setDepositStep("approving");
      await approveUsdc(depositAmount);
      setDepositStep("depositing");
      await deposit(tripId, depositAmount);
      setDepositStep("done");
      setDepositAmount("");
      setTimeout(() => setDepositStep("idle"), 2000);
    } catch (err) {
      console.error("Deposit failed:", err);
      setDepositStep("idle");
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isActive ? "bg-[var(--accent-green)]" : "bg-[var(--text-secondary)]"
          }`}
        />
        <span className="text-sm font-medium">
          {isActive ? "Active Trip" : "Settled"}
        </span>
        <span className="text-sm text-[var(--text-secondary)] ml-auto">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Pool Balance"
          value={`$${Number(poolBalance).toFixed(2)}`}
          accent="blue"
        />
        <StatCard
          label="Total Deposited"
          value={`$${Number(totalDeposited).toFixed(2)}`}
          accent="green"
        />
        <StatCard
          label="Total Spent"
          value={`$${Number(totalSpent).toFixed(2)}`}
          accent="amber"
        />
        <StatCard
          label="Spend Limit"
          value={`$${Number(spendLimitFormatted).toFixed(2)}/tx`}
          accent="purple"
        />
      </div>

      {/* Spending Progress */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-secondary)]">
            Budget Used
          </span>
          <span className="text-sm font-mono">
            {spentPct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(spentPct, 100)}%`,
              background:
                spentPct > 80
                  ? "var(--accent-red)"
                  : spentPct > 50
                  ? "var(--accent-amber)"
                  : "var(--accent-green)",
            }}
          />
        </div>
      </div>

      {/* My Deposit + Deposit Form */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">My Deposit</p>
            <p className="text-xl font-semibold">
              ${Number(myDepositFormatted).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-[var(--text-secondary)]">
              Wallet USDC
            </p>
            <p className="text-lg font-mono">
              ${Number(walletBalance).toFixed(2)}
            </p>
          </div>
        </div>

        {isActive && (
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount (USDC)"
              min="0"
              step="0.01"
              className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
            />
            <button
              onClick={handleDeposit}
              disabled={
                isPending ||
                depositStep !== "idle" ||
                !depositAmount ||
                Number(depositAmount) <= 0
              }
              className="px-5 py-2.5 rounded-xl bg-[var(--accent-green)] text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {depositStep === "approving"
                ? "Approving..."
                : depositStep === "depositing"
                ? "Depositing..."
                : depositStep === "done"
                ? "Done!"
                : "Deposit"}
            </button>
          </div>
        )}
      </div>

      {/* Members List */}
      {members && (members as any[]).length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Members
          </h4>
          <div className="space-y-2">
            {(members as `0x${string}`[]).map((member, i) => (
              <MemberRow
                key={member}
                address={member}
                tripId={tripId}
                isOrganizer={tripData && member.toLowerCase() === tripData.organizer?.toLowerCase()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "green" | "amber" | "purple";
}) {
  const colors = {
    blue: "var(--accent-blue)",
    green: "var(--accent-green)",
    amber: "var(--accent-amber)",
    purple: "var(--accent-purple)",
  };

  return (
    <div className="glass-card p-4">
      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
      <p
        className="text-lg font-semibold font-mono"
        style={{ color: colors[accent] }}
      >
        {value}
      </p>
    </div>
  );
}

function MemberRow({
  address,
  tripId,
  isOrganizer,
}: {
  address: `0x${string}`;
  tripId: bigint;
  isOrganizer: boolean;
}) {
  const { data: deposit } = useMemberDeposit(tripId, address);
  const formatted = deposit ? formatUnits(deposit as bigint, 6) : "0";

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0" />
        <span className="text-sm font-mono text-[var(--text-secondary)]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {isOrganizer && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-purple)]/10 text-[var(--accent-purple)]">
            Organizer
          </span>
        )}
      </div>
      <span className="text-sm font-mono">
        ${Number(formatted).toFixed(2)}
      </span>
    </div>
  );
}
