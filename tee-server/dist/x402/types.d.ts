export type SupportedChain = 'arc-testnet' | 'hedera-testnet';
export interface PaymentRequirements {
    x402Version: number;
    scheme: 'exact';
    network: SupportedChain;
    maxAmountRequired: string;
    payTo: string;
    asset: string;
    description?: string;
    extra?: Record<string, unknown>;
}
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
export interface HederaPayloadData {
    transactionBytes: string;
    fromAccount: string;
    toAccount: string;
    amount: string;
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
export declare const PAYMENT_REQUIRED_HEADER = "X-PAYMENT-REQUIRED";
export declare const PAYMENT_HEADER = "X-PAYMENT";
export declare function encodePaymentRequired(req: PaymentRequirements): string;
export declare function decodePaymentPayload(encoded: string): PaymentPayload;
