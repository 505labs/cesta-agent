import type { PaymentRequirements, PaymentPayload, VerificationResult, SettlementResult } from './types.js';
export declare function verifyArcPayment(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerificationResult>;
export declare function settleArcPayment(payload: PaymentPayload): Promise<SettlementResult>;
