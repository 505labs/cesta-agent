"use client";

import { useEffect, useState } from "react";

interface PaymentQRProps {
  paymentId: string;
  amount: string;
  description: string;
  onClose: () => void;
}

export default function PaymentQR({
  paymentId,
  amount,
  description,
  onClose,
}: PaymentQRProps) {
  const [timeLeft, setTimeLeft] = useState(300); // 5 min expiry

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const paymentLink = `https://pay.walletconnect.com/p/${paymentId}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-6 max-w-sm w-full text-center">
        <h3 className="text-lg font-semibold mb-2">Scan to Pay</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {description}
        </p>

        <div className="w-48 h-48 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center">
          <div className="text-black text-center p-4">
            <div className="text-2xl font-bold">${Number(amount).toFixed(2)}</div>
            <div className="text-xs mt-2 font-mono text-gray-500 break-all">
              {paymentLink}
            </div>
          </div>
        </div>

        <p className="text-2xl font-mono font-bold mb-2" style={{ color: "var(--accent-green)" }}>
          ${Number(amount).toFixed(2)}
        </p>

        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Expires in {minutes}:{seconds.toString().padStart(2, "0")}
        </p>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
