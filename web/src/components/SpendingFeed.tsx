"use client";

import { formatUnits } from "viem";
import { useTripSpends } from "@/lib/treasury";

interface SpendingFeedProps {
  tripId: bigint;
}

const CATEGORY_CONFIG: Record<
  string,
  { color: string; icon: string; bg: string }
> = {
  food: {
    color: "var(--accent-amber)",
    bg: "var(--accent-amber)",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  },
  gas: {
    color: "var(--accent-red)",
    bg: "var(--accent-red)",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  },
  lodging: {
    color: "var(--accent-purple)",
    bg: "var(--accent-purple)",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  },
  activities: {
    color: "var(--accent-blue)",
    bg: "var(--accent-blue)",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
  },
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: "F",
  gas: "G",
  lodging: "L",
  activities: "A",
};

export default function SpendingFeed({ tripId }: SpendingFeedProps) {
  const { data: spends, isLoading } = useTripSpends(tripId);

  const spendList = (spends as any[]) || [];

  // Reverse to show newest first
  const sortedSpends = [...spendList].reverse();

  // Calculate category totals
  const categoryTotals: Record<string, bigint> = {};
  for (const s of spendList) {
    const cat = s.category?.toLowerCase() || "other";
    categoryTotals[cat] = (categoryTotals[cat] || BigInt(0)) + BigInt(s.amount || 0);
  }

  return (
    <div className="space-y-4">
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
                    {CATEGORY_EMOJI[cat] || "?"}
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
                    {CATEGORY_EMOJI[cat] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {spend.description || "Payment"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      <span className="capitalize">{cat}</span>
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
