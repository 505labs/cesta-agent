"use client";

import { formatUnits } from "viem";
import { useTripSpends, useNanopaymentTotal, useDailySpending } from "@/lib/treasury";

interface SpendingFeedProps {
  tripId: bigint;
}

const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  food: { color: "var(--accent-amber)", bg: "var(--accent-amber)", label: "F" },
  gas: { color: "var(--accent-red)", bg: "var(--accent-red)", label: "G" },
  lodging: { color: "var(--accent-purple)", bg: "var(--accent-purple)", label: "L" },
  activities: { color: "var(--accent-blue)", bg: "var(--accent-blue)", label: "A" },
  parking: { color: "#6366f1", bg: "#6366f1", label: "P" },
  tolls: { color: "#f97316", bg: "#f97316", label: "T" },
  data: { color: "#06b6d4", bg: "#06b6d4", label: "D" },
  fares: { color: "#8b5cf6", bg: "#8b5cf6", label: "$" },
};

// Nanopayment categories — these are autonomous agent micro-transactions
const NANOPAYMENT_CATEGORIES = new Set(["parking", "tolls", "data", "fares"]);

export default function SpendingFeed({ tripId }: SpendingFeedProps) {
  const { data: spends, isLoading } = useTripSpends(tripId);
  const { data: nanopaymentTotal } = useNanopaymentTotal(tripId);
  const { data: dailySpending } = useDailySpending(tripId);

  const spendList = (spends as any[]) || [];

  // Reverse to show newest first
  const sortedSpends = [...spendList].reverse();

  // Calculate category totals
  const categoryTotals: Record<string, bigint> = {};
  for (const s of spendList) {
    const cat = s.category?.toLowerCase() || "other";
    categoryTotals[cat] = (categoryTotals[cat] || BigInt(0)) + BigInt(s.amount || 0);
  }

  const nanopaymentUsd = nanopaymentTotal ? Number(formatUnits(nanopaymentTotal as bigint, 6)) : 0;
  const dailyUsd = dailySpending ? Number(formatUnits(dailySpending as bigint, 6)) : 0;

  return (
    <div className="space-y-4">
      {/* Nanopayment & Daily Stats */}
      {(nanopaymentUsd > 0 || dailyUsd > 0) && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#06b6d4] animate-pulse" />
            <h4 className="text-sm font-medium text-[var(--text-secondary)]">
              Arc Nanopayments
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="py-2 px-3 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-secondary)]">Autonomous spending</p>
              <p className="text-lg font-mono font-medium" style={{ color: "#06b6d4" }}>
                ${nanopaymentUsd.toFixed(4)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">gas-free on Arc</p>
            </div>
            <div className="py-2 px-3 rounded-lg bg-[var(--bg-secondary)]">
              <p className="text-xs text-[var(--text-secondary)]">Today&apos;s spending</p>
              <p className="text-lg font-mono font-medium">
                ${dailyUsd.toFixed(2)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">daily total</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="glass-card p-4">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
            Spending by Category
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(categoryTotals).map(([cat, total]) => {
              const config = CATEGORY_CONFIG[cat] || {
                color: "var(--text-secondary)",
                bg: "var(--text-secondary)",
              };
              return (
                <div
                  key={cat}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-secondary)]"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: config.bg, opacity: 0.8 }}
                  >
                    {CATEGORY_CONFIG[cat]?.label || "?"}
                  </div>
                  <div>
                    <p className="text-sm capitalize font-medium">{cat}</p>
                    <p className="text-xs font-mono" style={{ color: config.color }}>
                      ${Number(formatUnits(total, 6)).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="glass-card p-4">
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Recent Transactions
        </h4>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--accent-blue)]/30 border-t-[var(--accent-blue)] rounded-full animate-spin" />
          </div>
        ) : sortedSpends.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs mt-1">
              The AI agent will manage spending from the pool
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSpends.map((spend: any, i: number) => {
              const cat = spend.category?.toLowerCase() || "other";
              const config = CATEGORY_CONFIG[cat] || {
                color: "var(--text-secondary)",
                bg: "var(--text-secondary)",
              };
              const amount = formatUnits(BigInt(spend.amount || 0), 6);
              const timestamp = new Date(
                Number(spend.timestamp || 0) * 1000
              );

              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 px-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: config.bg, opacity: 0.8 }}
                  >
                    {CATEGORY_CONFIG[cat]?.label || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {spend.description || "Payment"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                      <span className="capitalize">{cat}</span>
                      {NANOPAYMENT_CATEGORIES.has(cat) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#06b6d4]/10 text-[#06b6d4]">
                          nanopayment
                        </span>
                      )}
                      {" / "}
                      <span className="font-mono">
                        {spend.recipient
                          ? `${spend.recipient.slice(0, 6)}...${spend.recipient.slice(-4)}`
                          : "Unknown"}
                      </span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-mono font-medium"
                      style={{ color: config.color }}
                    >
                      -${Number(amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {timestamp.getTime() > 0
                        ? timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
