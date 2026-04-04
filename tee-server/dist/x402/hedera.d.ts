import type { PaymentRequirements, PaymentPayload, VerificationResult, SettlementResult } from './types.js';
export declare function verifyHederaPayment(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerificationResult>;
export declare function settleHederaPayment(payload: PaymentPayload): Promise<SettlementResult>;
