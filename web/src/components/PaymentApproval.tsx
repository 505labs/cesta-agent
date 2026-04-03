"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { approvePayment, type PaymentData } from "@/lib/api";

interface PaymentApprovalProps {
  payment: PaymentData;
  tripId: string;
  onStatusChange?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "var(--accent-amber)",
  gas: "var(--accent-red)",
  lodging: "var(--accent-purple)",
  activities: "var(--accent-blue)",
};

export default function PaymentApproval({
  payment,
  tripId,
  onStatusChange,
}: PaymentApprovalProps) {
  const { token } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [localStatus, setLocalStatus] = useState(payment.status);

  const accentColor =
    CATEGORY_COLORS[payment.category] || "var(--accent-blue)";

  const handleApprove = async () => {
    if (!token) return;
    setIsApproving(true);
    try {
      const result = await approvePayment(tripId, payment.id, token);
      setLocalStatus(result.status);
      onStatusChange?.();
    } catch (err) {
      console.error("Approval failed:", err);
    } finally {
      setIsApproving(false);
    }
  };

  const isPending = localStatus === "pending";
  const isSucceeded = localStatus === "succeeded" || localStatus === "approved";

  return (
    <div
      className="glass-card p-4 border-l-4"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-medium">{payment.description}</p>
          <p className="text-xs text-[var(--text-secondary)] capitalize">
            {payment.category}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-mono font-semibold" style={{ color: accentColor }}>
            ${Number(payment.amount).toFixed(2)}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isPending
                ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                : isSucceeded
                ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
            }`}
          >
            {localStatus}
          </span>
        </div>
      </div>

      <div className="text-xs text-[var(--text-secondary)] mb-3 font-mono">
        To: {payment.recipient.slice(0, 8)}...{payment.recipient.slice(-6)}
      </div>

      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex-1 px-4 py-2 rounded-xl bg-[var(--accent-green)] text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {isApproving ? "Approving..." : "Approve"}
          </button>
          <button className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors">
            Reject
          </button>
        </div>
      )}

      {payment.tx_hash && (
        <div className="mt-2 text-xs text-[var(--text-secondary)] font-mono">
          Tx: {payment.tx_hash.slice(0, 10)}...{payment.tx_hash.slice(-8)}
        </div>
      )}
    </div>
  );
}
