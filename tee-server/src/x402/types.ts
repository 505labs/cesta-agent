// x402 v2 types — https://docs.x402.org/core-concepts/http-402

export type SupportedChain = 'arc-testnet' | 'hedera-testnet';

export interface PaymentRequirements {
  x402Version: number;
  scheme: 'exact';
  network: SupportedChain;
  maxAmountRequired: string; // in smallest unit (USDC: 6 decimals)
  payTo: string;             // receiver address / account
  asset: string;             // token contract address or token ID
  description?: string;
  extra?: Record<string, unknown>;
}

// EVM (Arc) payment authorization — EIP-3009
export interface EvmAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

export interface EvmPayloadData {
  signature: string;
  authorization: EvmAuthorization;
}

// Hedera payment — partially signed TransferTransaction
export interface HederaPayloadData {
  transactionBytes: string; // base64-encoded partially-signed tx
  fromAccount: string;      // e.g. "0.0.12345"
  toAccount: string;
  amount: string;           // in tinybars or token units
}

export interface PaymentPayload {
  x402Version: number;
  scheme: 'exact';
  network: SupportedChain;
  payload: EvmPayloadData | HederaPayloadData;
  paymentRequirements: PaymentRequirements;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export interface SettlementResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// x402 response headers
export const PAYMENT_REQUIRED_HEADER = 'X-PAYMENT-REQUIRED';
export const PAYMENT_HEADER = 'X-PAYMENT';

export function encodePaymentRequired(req: PaymentRequirements): string {
  return Buffer.from(JSON.stringify(req)).toString('base64');
}

export function decodePaymentPayload(encoded: string): PaymentPayload {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}
