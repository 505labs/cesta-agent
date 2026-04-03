"use client";

export interface PaymentRequest {
  tripId: number;
  amount: string; // USD amount as string e.g. "45.00"
  category: string;
  description: string;
  recipientAddress: string;
}

export type PaymentStatus =
  | "pending"
  | "approved"
  | "processing"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled";

export interface TripPayment {
  paymentId: string;
  amount: string;
  category: string;
  description: string;
  recipient: string;
  status: PaymentStatus;
  createdAt: string;
  txHash?: string;
  approvals?: string[]; // wallet addresses that approved
}

// WC Pay App ID -- obtained from dashboard.walletconnect.com
const WC_PAY_APP_ID = process.env.NEXT_PUBLIC_WC_PAY_APP_ID || "";

/**
 * Check if WalletConnect Pay is configured
 */
export function isWcPayConfigured(): boolean {
  return !!WC_PAY_APP_ID;
}

/**
 * Create a WC Pay payment for a trip expense.
 * Returns payment metadata for tracking.
 *
 * In production, this would call the WC Pay SDK to create a real payment.
 * For the hackathon, we track payments in our backend and create WC Pay
 * payment links when the SDK is available.
 */
export async function createTripPayment(req: PaymentRequest): Promise<TripPayment> {
  return {
    paymentId: `trip-${req.tripId}-${Date.now()}`,
    amount: req.amount,
    category: req.category,
    description: req.description,
    recipient: req.recipientAddress,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate a WalletConnect Pay payment link for QR display.
 * Falls back to a placeholder if WC Pay is not configured.
 */
export function getPaymentLink(paymentId: string): string {
  if (WC_PAY_APP_ID) {
    return `https://pay.walletconnect.com/p/${paymentId}`;
  }
  return `https://pay.walletconnect.com/demo/${paymentId}`;
}
